import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";
import { FailureBucket, classifyOneMessage } from "../diagnostics/classifyFailedTests";
import { TestOutcome } from "./trxParser";
import { outlineRowKey, scenarioKey } from "../runner/runScope";

/** Minimal outcome lookup (matches OutcomeStore / OutcomeReader). */
export interface FailedLeafOutcomeReader {
  get(key: string): TestOutcome | undefined;
  /** When present, used to classify failed leaves for review-first jump. */
  getErrorMessage?(key: string): string | undefined;
}

export interface FirstFailedLeaf {
  outcomeKey: string;
  featurePath: string;
  /** 1-based line in the .feature file (scenario or Examples row). */
  scenarioLine: number;
  label: string;
  feature: FeatureInfo;
  scenario: ScenarioInfo;
  /** Set when the failed leaf is an outline row. */
  outlineRowIndex?: number;
}

export type AutoShowOutputMode = "off" | "onFailure" | "always";

export function isAutoShowOutputMode(value: string | undefined): value is AutoShowOutputMode {
  return value === "off" || value === "onFailure" || value === "always";
}

export type ClassifyFailedLeaf = (leaf: FirstFailedLeaf) => FailureBucket | undefined;

/**
 * Classify a failed leaf from stored error text (TRX-backed).
 * Returns undefined when there is no message — leaf is skipped for bucket jump.
 */
export function classifyFailedLeafFromStore(
  outcomes: FailedLeafOutcomeReader,
  outcomeKey: string,
): FailureBucket | undefined {
  const message = outcomes.getErrorMessage?.(outcomeKey);
  if (!message?.trim()) {
    return undefined;
  }
  return classifyOneMessage(message);
}

function walkFailedLeaves(
  domains: readonly DomainGroup[],
  outcomes: FailedLeafOutcomeReader,
  visit: (leaf: FirstFailedLeaf) => boolean,
): FirstFailedLeaf | undefined {
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            const key = outlineRowKey(feature, scenario, example.rowIndex);
            if (outcomes.get(key) !== "failed") {
              continue;
            }
            const leaf: FirstFailedLeaf = {
              outcomeKey: key,
              featurePath: feature.filePath,
              scenarioLine: example.line,
              label: `${scenario.name} · ${example.label}`,
              feature,
              scenario,
              outlineRowIndex: example.rowIndex,
            };
            if (visit(leaf)) {
              return leaf;
            }
          }
          continue;
        }
        const key = scenarioKey(feature, scenario);
        if (outcomes.get(key) !== "failed") {
          continue;
        }
        const leaf: FirstFailedLeaf = {
          outcomeKey: key,
          featurePath: feature.filePath,
          scenarioLine: scenario.line,
          label: scenario.name,
          feature,
          scenario,
        };
        if (visit(leaf)) {
          return leaf;
        }
      }
    }
  }
  return undefined;
}

/**
 * First failed leaf in discovery order: domain → feature → scenario → outline row.
 */
export function findFirstFailedLeaf(
  domains: readonly DomainGroup[],
  outcomes: FailedLeafOutcomeReader,
): FirstFailedLeaf | undefined {
  return walkFailedLeaves(domains, outcomes, () => true);
}

/**
 * First failed leaf in discovery order whose TRX/store classification matches `bucket`.
 * Leaves without a classifiable error message are skipped.
 */
export function findFirstFailedLeafForBucket(
  domains: readonly DomainGroup[],
  outcomes: FailedLeafOutcomeReader,
  bucket: FailureBucket,
  classifyLeaf: ClassifyFailedLeaf = (leaf) =>
    classifyFailedLeafFromStore(outcomes, leaf.outcomeKey),
): FirstFailedLeaf | undefined {
  return walkFailedLeaves(domains, outcomes, (leaf) => classifyLeaf(leaf) === bucket);
}

/**
 * Outcome keys of failed leaves that match an optional bucket filter.
 */
export function collectFailedOutcomeKeys(
  domains: readonly DomainGroup[],
  outcomes: FailedLeafOutcomeReader,
  options?: {
    bucket?: FailureBucket;
    classifyLeaf?: ClassifyFailedLeaf;
  },
): string[] {
  const keys: string[] = [];
  const classify =
    options?.classifyLeaf ??
    ((leaf: FirstFailedLeaf) => classifyFailedLeafFromStore(outcomes, leaf.outcomeKey));
  walkFailedLeaves(domains, outcomes, (leaf) => {
    if (options?.bucket != null && classify(leaf) !== options.bucket) {
      return false;
    }
    keys.push(leaf.outcomeKey);
    return false;
  });
  return keys;
}

/** Count failed leaves per failure bucket (TRX/store message). */
export function countFailedLeavesByBucket(
  domains: readonly DomainGroup[],
  outcomes: FailedLeafOutcomeReader,
): Partial<Record<FailureBucket, number>> {
  const tallies: Partial<Record<FailureBucket, number>> = {};
  walkFailedLeaves(domains, outcomes, (leaf) => {
    const bucket = classifyFailedLeafFromStore(outcomes, leaf.outcomeKey);
    if (bucket) {
      tallies[bucket] = (tallies[bucket] ?? 0) + 1;
    }
    return false;
  });
  return tallies;
}

export type FailureNavContainerKind = "domain" | "feature" | "scenarioOutline";

export interface FailureNavContainerKey {
  kind: FailureNavContainerKind;
  /** Domain name, feature filePath, or scenario outcome key for outline parents. */
  id: string;
}

export interface ExpandFailuresOptions {
  /** When set, only failed leaves that pass the predicate contribute containers. */
  includeOutcomeKey?: (outcomeKey: string) => boolean;
}

/**
 * Container ids that must stay expanded so every failed leaf is reachable
 * after collapseAll + re-expand.
 */
export function containerKeysToExpandForFailures(
  domains: readonly DomainGroup[],
  outcomes: FailedLeafOutcomeReader,
  options?: ExpandFailuresOptions,
): FailureNavContainerKey[] {
  const seen = new Set<string>();
  const keys: FailureNavContainerKey[] = [];
  const include = options?.includeOutcomeKey ?? (() => true);

  const add = (kind: FailureNavContainerKind, id: string): void => {
    const token = `${kind}:${id}`;
    if (seen.has(token)) {
      return;
    }
    seen.add(token);
    keys.push({ kind, id });
  };

  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          let outlineHasFailed = false;
          for (const example of scenario.examples) {
            const key = outlineRowKey(feature, scenario, example.rowIndex);
            if (outcomes.get(key) === "failed" && include(key)) {
              outlineHasFailed = true;
              break;
            }
          }
          if (outlineHasFailed) {
            add("domain", domain.name);
            add("feature", feature.filePath);
            add("scenarioOutline", scenarioKey(feature, scenario));
          }
          continue;
        }
        const key = scenarioKey(feature, scenario);
        if (outcomes.get(key) === "failed" && include(key)) {
          add("domain", domain.name);
          add("feature", feature.filePath);
        }
      }
    }
  }

  return keys;
}

export function shouldAutoShowOutput(
  mode: AutoShowOutputMode,
  opts: {
    exitCode: number | null;
    failed: number;
    canceled?: boolean;
  },
): boolean {
  if (mode === "off") {
    return false;
  }
  if (mode === "always") {
    return true;
  }
  if (opts.failed > 0) {
    return true;
  }
  if (opts.exitCode !== null && opts.exitCode !== 0) {
    return true;
  }
  return false;
}
