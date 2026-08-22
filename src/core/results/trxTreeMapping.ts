import { DomainGroup, FeatureInfo, OutlineExample, ScenarioInfo } from "../gherkin/model";
import { collectOutcomeKeysForTargets, outlineRowKey, scenarioKey } from "../runner/runScope";
import { RunTarget } from "../runner/filterBuilder";
import { findOutlineExampleMatchInFeature, matchesScenarioInFeature } from "./scenarioMatch";
import { SkipReason } from "./skipReason";
import { TestOutcome, TestResult } from "./trxParser";
import { UnifiedSummary } from "./resultLoader";

export type TrxMatchSummary = Pick<UnifiedSummary, "results"> | { results: TestResult[] };

export interface TreeMappingStats {
  inScope: number;
  mapped: number;
  unmapped: number;
}

/** Leaf in run scope that did not receive a mapped TRX outcome. */
export interface UnmappedLeaf {
  outcomeKey: string;
  featureName: string;
  /** Absolute .feature path (discovery). */
  featurePath: string;
  scenarioName: string;
  /** 1-based line for editor reveal (scenario or Examples row). */
  line: number;
  outlineLabel?: string;
  /** Human label: `Feature · Scenario` or `Feature · Scenario · row`. */
  label: string;
}

/** TRX row that was never the chosen match for any Gherkin leaf. */
export interface UnusedTrxRow {
  testName: string;
  outcome: TestOutcome;
}

/** Gherkin leaf with 2+ TRX rows matching the same predicate (first still applied). */
export interface AmbiguousMappedLeaf {
  label: string;
  candidateCount: number;
  chosenTestName: string;
}

export interface TreeMappingReport extends TreeMappingStats {
  unmappedLeaves: UnmappedLeaf[];
  /** Absent on skip-snapshot lite reports (≡ empty). */
  unusedTrx?: UnusedTrxRow[];
  ambiguousLeaves?: AmbiguousMappedLeaf[];
  /** How many TRX indices were chosen by ≥2 Gherkin leaves. */
  sharedChosenCount?: number;
  /** `summary.results.length` of the applied run. */
  trxTotal?: number;
}

export interface OutcomeStoreTrxWriter {
  set(key: string, outcome: TestOutcome, durationMs?: number, errorMessage?: string): void;
  get(key: string): TestOutcome | undefined;
  setSkipReason(key: string, reason: SkipReason): void;
  clearSkipReason(key: string): void;
}

function isMappedOutcome(outcome: TestOutcome | undefined): boolean {
  return outcome === "passed" || outcome === "failed" || outcome === "skipped";
}

function leafLabel(featureName: string, scenarioName: string, outlineLabel?: string): string {
  const base = `${featureName} · ${scenarioName}`;
  return outlineLabel ? `${base} · ${outlineLabel}` : base;
}

function trxRowMatchesLeaf(
  result: TestResult,
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  example?: OutlineExample,
): boolean {
  if (example) {
    return Boolean(
      findOutlineExampleMatchInFeature(result.testName, feature, scenario, [example]),
    );
  }
  return matchesScenarioInFeature(result.testName, feature, scenario);
}

interface TrxApplyHonesty {
  matchedKeys: Set<string>;
  unusedTrx: UnusedTrxRow[];
  ambiguousLeaves: AmbiguousMappedLeaf[];
  sharedChosenCount: number;
}

/**
 * Same first-match apply as today, plus unused / ambiguous / shared classification
 * by **result index** (not testName).
 */
function applyTrxMatchesWithHonesty(
  store: OutcomeStoreTrxWriter,
  domains: DomainGroup[],
  summary: TrxMatchSummary,
): TrxApplyHonesty {
  const matchedKeys = new Set<string>();
  const chosenCounts = new Array<number>(summary.results.length).fill(0);
  const ambiguousLeaves: AmbiguousMappedLeaf[] = [];

  const applyChosen = (
    chosenIndex: number,
    key: string,
    label: string,
    candidateCount: number,
  ): void => {
    const match = summary.results[chosenIndex];
    store.set(key, match.outcome, match.durationMs, match.errorMessage);
    store.clearSkipReason(key);
    matchedKeys.add(key);
    chosenCounts[chosenIndex] += 1;
    if (candidateCount > 1) {
      ambiguousLeaves.push({
        label,
        candidateCount,
        chosenTestName: match.testName,
      });
    }
  };

  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            const candidates: number[] = [];
            for (let i = 0; i < summary.results.length; i++) {
              if (trxRowMatchesLeaf(summary.results[i], feature, scenario, example)) {
                candidates.push(i);
              }
            }
            if (candidates.length === 0) {
              continue;
            }
            applyChosen(
              candidates[0],
              outlineRowKey(feature, scenario, example.rowIndex),
              leafLabel(feature.name, scenario.name, example.label),
              candidates.length,
            );
          }
        } else {
          const candidates: number[] = [];
          for (let i = 0; i < summary.results.length; i++) {
            if (trxRowMatchesLeaf(summary.results[i], feature, scenario)) {
              candidates.push(i);
            }
          }
          if (candidates.length === 0) {
            continue;
          }
          applyChosen(
            candidates[0],
            scenarioKey(feature, scenario),
            leafLabel(feature.name, scenario.name),
            candidates.length,
          );
        }
      }
    }
  }

  const unusedTrx: UnusedTrxRow[] = [];
  for (let i = 0; i < summary.results.length; i++) {
    if (chosenCounts[i] === 0) {
      const row = summary.results[i];
      unusedTrx.push({ testName: row.testName, outcome: row.outcome });
    }
  }

  return {
    matchedKeys,
    unusedTrx,
    ambiguousLeaves,
    sharedChosenCount: chosenCounts.filter((count) => count >= 2).length,
  };
}

/** Applies TRX rows to the store; returns keys that received a TRX match. */
export function applyTrxMatchesToStore(
  store: OutcomeStoreTrxWriter,
  domains: DomainGroup[],
  summary: TrxMatchSummary,
): Set<string> {
  return applyTrxMatchesWithHonesty(store, domains, summary).matchedKeys;
}

export function computeTreeMappingStats(
  scopeKeys: Set<string>,
  store: { get(key: string): TestOutcome | undefined },
): TreeMappingStats {
  let mapped = 0;
  for (const key of scopeKeys) {
    if (isMappedOutcome(store.get(key))) {
      mapped++;
    }
  }
  const inScope = scopeKeys.size;
  return { inScope, mapped, unmapped: inScope - mapped };
}

/** Unmapped scoped leaves in domain/feature/scenario order (stable). */
export function listUnmappedScopedLeaves(
  scopeKeys: Set<string>,
  store: { get(key: string): TestOutcome | undefined },
  domains: DomainGroup[],
): UnmappedLeaf[] {
  const leaves: UnmappedLeaf[] = [];
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            const key = outlineRowKey(feature, scenario, example.rowIndex);
            if (!scopeKeys.has(key) || isMappedOutcome(store.get(key))) {
              continue;
            }
            leaves.push({
              outcomeKey: key,
              featureName: feature.name,
              featurePath: feature.filePath,
              scenarioName: scenario.name,
              line: example.line,
              outlineLabel: example.label,
              label: leafLabel(feature.name, scenario.name, example.label),
            });
          }
        } else {
          const key = scenarioKey(feature, scenario);
          if (!scopeKeys.has(key) || isMappedOutcome(store.get(key))) {
            continue;
          }
          leaves.push({
            outcomeKey: key,
            featureName: feature.name,
            featurePath: feature.filePath,
            scenarioName: scenario.name,
            line: scenario.line,
            label: leafLabel(feature.name, scenario.name),
          });
        }
      }
    }
  }
  return leaves;
}

export function computeTreeMappingReport(
  scopeKeys: Set<string>,
  store: { get(key: string): TestOutcome | undefined },
  domains: DomainGroup[],
): TreeMappingReport {
  const stats = computeTreeMappingStats(scopeKeys, store);
  return {
    ...stats,
    unmappedLeaves: listUnmappedScopedLeaves(scopeKeys, store, domains),
  };
}

export function finalizeScopedRunOutcomes(
  store: OutcomeStoreTrxWriter,
  scopeKeys: Set<string>,
  matchedKeys: Set<string>,
  canceled: boolean,
): void {
  for (const key of scopeKeys) {
    if (matchedKeys.has(key)) {
      continue;
    }
    const outcome = store.get(key);
    if (canceled && outcome && outcome !== "unknown" && isMappedOutcome(outcome)) {
      continue;
    }
    store.setSkipReason(key, canceled ? "canceled" : "not_in_trx");
  }
}

/** Applies TRX to store and marks unmapped scoped leaves (not for run-all). */
export function applyScopedTrxResults(
  store: OutcomeStoreTrxWriter,
  domains: DomainGroup[],
  summary: TrxMatchSummary,
  targets: RunTarget[],
  options?: { canceled?: boolean },
): TreeMappingReport | undefined {
  const scope = collectOutcomeKeysForTargets(targets, domains);
  if (scope === "all" || scope.size === 0) {
    applyTrxMatchesToStore(store, domains, summary);
    return undefined;
  }

  const honesty = applyTrxMatchesWithHonesty(store, domains, summary);
  finalizeScopedRunOutcomes(store, scope, honesty.matchedKeys, !!options?.canceled);
  return {
    ...computeTreeMappingReport(scope, store, domains),
    unusedTrx: honesty.unusedTrx,
    ambiguousLeaves: honesty.ambiguousLeaves,
    sharedChosenCount: honesty.sharedChosenCount,
    trxTotal: summary.results.length,
  };
}
