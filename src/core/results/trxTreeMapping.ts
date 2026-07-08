import { DomainGroup } from "../gherkin/model";
import { collectOutcomeKeysForTargets, outlineRowKey, scenarioKey } from "../runner/runScope";
import { RunTarget } from "../runner/filterBuilder";
import { findOutlineExampleMatch, matchesScenario } from "./scenarioMatch";
import { SkipReason } from "./skipReason";
import { TestOutcome, TestResult } from "./trxParser";
import { UnifiedSummary } from "./resultLoader";

export type TrxMatchSummary = Pick<UnifiedSummary, "results"> | { results: TestResult[] };

export interface TreeMappingStats {
  inScope: number;
  mapped: number;
  unmapped: number;
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
              findOutlineExampleMatch(r.testName, scenario.name, [example]),
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
          const match = summary.results.find((r) => matchesScenario(r.testName, scenario.name));
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
): TreeMappingStats | undefined {
  const scope = collectOutcomeKeysForTargets(targets, domains);
  if (scope === "all" || scope.size === 0) {
    applyTrxMatchesToStore(store, domains, summary);
    return undefined;
  }

  const matchedKeys = applyTrxMatchesToStore(store, domains, summary);
  finalizeScopedRunOutcomes(store, scope, matchedKeys, !!options?.canceled);
  return computeTreeMappingStats(scope, store);
}
