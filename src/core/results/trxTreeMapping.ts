import { DomainGroup } from "../gherkin/model";
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

export interface TreeMappingReport extends TreeMappingStats {
  unmappedLeaves: UnmappedLeaf[];
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

/** Applies TRX rows to the store; returns keys that received a TRX match. */
export function applyTrxMatchesToStore(
  store: OutcomeStoreTrxWriter,
  domains: DomainGroup[],
  summary: TrxMatchSummary,
): Set<string> {
  const matchedKeys = new Set<string>();

  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            const match = summary.results.find((r) =>
              findOutlineExampleMatchInFeature(r.testName, feature, scenario, [example]),
            );
            if (!match) {
              continue;
            }
            const key = outlineRowKey(feature, scenario, example.rowIndex);
            store.set(key, match.outcome, match.durationMs, match.errorMessage);
            store.clearSkipReason(key);
            matchedKeys.add(key);
          }
        } else {
          const match = summary.results.find((r) =>
            matchesScenarioInFeature(r.testName, feature, scenario),
          );
          if (!match) {
            continue;
          }
          const key = scenarioKey(feature, scenario);
          store.set(key, match.outcome, match.durationMs, match.errorMessage);
          store.clearSkipReason(key);
          matchedKeys.add(key);
        }
      }
    }
  }

  return matchedKeys;
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

function leafLabel(featureName: string, scenarioName: string, outlineLabel?: string): string {
  const base = `${featureName} · ${scenarioName}`;
  return outlineLabel ? `${base} · ${outlineLabel}` : base;
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

  const matchedKeys = applyTrxMatchesToStore(store, domains, summary);
  finalizeScopedRunOutcomes(store, scope, matchedKeys, !!options?.canceled);
  return computeTreeMappingReport(scope, store, domains);
}
