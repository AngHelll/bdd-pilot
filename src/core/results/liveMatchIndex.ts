import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";
import { DEFAULT_FILTER_MAPPING, FilterMappingConfig } from "../runner/filterMapping";
import { featureClassName, sanitizeIdentifier } from "../runner/filterBuilder";
import { outlineRowKey, scenarioKey } from "../runner/runScope";
import {
  findOutlineExampleMatchInFeature,
  looksLikeFeatureClassFqn,
  matchesScenarioInFeature,
} from "./scenarioMatch";

/**
 * Candidate index for live stdout matching.
 *
 * The yes/no decision stays in {@link matchesScenarioInFeature} and
 * {@link findOutlineExampleMatchInFeature}. This module only chooses which
 * scenarios are worth asking. Feature-class FQN names consult `Class.Method`
 * buckets. Any other name keeps the full discovery-order scan, because the
 * legacy substring rule is not safe to narrow by normalized name alone.
 *
 * Discarded: an index keyed only by normalized scenario title. Homonyms and
 * `PlaceOrder` / `PlaceOrderBatch` would either collide or drop a real match.
 *
 * Invalidation follows the identity of the `DomainGroup[]` passed to
 * {@link buildLiveMatchIndex}. `TestTreeProvider` keeps the index while
 * `allDomains` is that same array and rebuilds when discovery replaces it:
 * `refresh`, a saved feature, a deleted feature, or a renamed feature.
 * An unchanged save returns the same array, so the index stays. Example rows
 * are not stored in the index; they are read when a result arrives, so
 * in-place Theory enrichment does not require a rebuild.
 */

export interface LiveScenarioRef {
  feature: FeatureInfo;
  scenario: ScenarioInfo;
  /** Discovery order. Writes follow this order, as the full scan does. */
  order: number;
}

export interface LiveMatchIndex {
  /** Identity of the domain array this index was built from. */
  domains: DomainGroup[];
  scenarioCount: number;
  byFqn: Map<string, LiveScenarioRef[]>;
  all: LiveScenarioRef[];
}

export interface LiveMatchSelection {
  scenarios: LiveScenarioRef[];
  /** `fqn` when the test name looks like a feature-class FQN; otherwise the full scan. */
  mode: "fqn" | "fallback";
}

const IDENTIFIER = /[\p{L}\p{Nl}\p{Pc}][\p{L}\p{Nl}\p{Nd}\p{Pc}]*/gu;

/**
 * `Σ`, `σ`, and `ς` compare equal under the case-insensitive regex in
 * `matchesScenarioFqn`, but `toLowerCase` does not map them to one key.
 * A feature-class FQN that contains any of them keeps the full scan.
 */
const GREEK_SIGMA = /[Σσς]/u;

export function buildLiveMatchIndex(
  domains: DomainGroup[],
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): LiveMatchIndex {
  const byFqn = new Map<string, LiveScenarioRef[]>();
  const all: LiveScenarioRef[] = [];
  let order = 0;
  for (const domain of domains) {
    for (const feature of domain.features) {
      const className = featureClassName(feature.name, mapping);
      for (const scenario of feature.scenarios) {
        const ref: LiveScenarioRef = { feature, scenario, order };
        all.push(ref);
        order += 1;
        const methodName = sanitizeIdentifier(scenario.name);
        if (!className || !methodName) {
          continue;
        }
        const key = fqnKey(className, methodName);
        const bucket = byFqn.get(key);
        if (bucket) {
          bucket.push(ref);
        } else {
          byFqn.set(key, [ref]);
        }
      }
    }
  }
  return { domains, scenarioCount: all.length, byFqn, all };
}

export function selectLiveMatchCandidates(
  index: LiveMatchIndex,
  testName: string,
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): LiveMatchSelection {
  if (!looksLikeFeatureClassFqn(testName, mapping) || GREEK_SIGMA.test(testName)) {
    return { scenarios: index.all, mode: "fallback" };
  }
  const seen = new Set<number>();
  const scenarios: LiveScenarioRef[] = [];
  for (const key of fqnPairKeys(testName)) {
    const bucket = index.byFqn.get(key);
    if (!bucket) {
      continue;
    }
    for (const ref of bucket) {
      if (seen.has(ref.order)) {
        continue;
      }
      seen.add(ref.order);
      scenarios.push(ref);
    }
  }
  scenarios.sort((a, b) => a.order - b.order);
  return { scenarios, mode: "fqn" };
}

/**
 * Outcome key `applyLiveResult` would write for this scenario, or undefined.
 * Outline rows are chosen with the current Theory / cell / pickle rules.
 */
export function liveOutcomeKey(
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  testName: string,
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): string | undefined {
  if (scenario.examples && scenario.examples.length > 0) {
    const example = findOutlineExampleMatchInFeature(
      testName,
      feature,
      scenario,
      scenario.examples,
      mapping,
    );
    if (!example) {
      return undefined;
    }
    return outlineRowKey(feature, scenario, example.rowIndex);
  }
  if (matchesScenarioInFeature(testName, feature, scenario, mapping)) {
    return scenarioKey(feature, scenario);
  }
  return undefined;
}

/** Full scan. Reference implementation for equivalence tests. */
export function collectLiveOutcomeKeysScan(
  domains: DomainGroup[],
  testName: string,
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): string[] {
  const keys: string[] = [];
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        const key = liveOutcomeKey(feature, scenario, testName, mapping);
        if (key) {
          keys.push(key);
        }
      }
    }
  }
  return keys;
}

/** Indexed lookup, then the same per-scenario decision as the scan. */
export function collectLiveOutcomeKeysIndexed(
  index: LiveMatchIndex,
  testName: string,
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): { keys: string[]; candidates: number; mode: LiveMatchSelection["mode"] } {
  const selection = selectLiveMatchCandidates(index, testName, mapping);
  const keys: string[] = [];
  for (const ref of selection.scenarios) {
    const key = liveOutcomeKey(ref.feature, ref.scenario, testName, mapping);
    if (key) {
      keys.push(key);
    }
  }
  return { keys, candidates: selection.scenarios.length, mode: selection.mode };
}

function fqnKey(className: string, methodName: string): string {
  return `${className.toLowerCase()}\0${methodName.toLowerCase()}`;
}

/**
 * Adjacent identifier tokens separated by a single dot, with the same
 * boundaries as `matchesScenarioFqn`: the class starts at the beginning or
 * after a dot, and the method ends at the end, a dot, or `(`.
 * Overlapping pairs (`A.B.C` → `A.B` and `B.C`) are both returned.
 */
function fqnPairKeys(testName: string): string[] {
  IDENTIFIER.lastIndex = 0;
  const tokens: Array<{ text: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = IDENTIFIER.exec(testName)) !== null) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }
  const keys: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const left = tokens[i];
    const right = tokens[i + 1];
    if (testName.slice(left.end, right.start) !== ".") {
      continue;
    }
    if (left.start !== 0 && testName[left.start - 1] !== ".") {
      continue;
    }
    const after = testName[right.end];
    if (after !== undefined && after !== "." && after !== "(") {
      continue;
    }
    keys.push(fqnKey(left.text, right.text));
  }
  return keys;
}
