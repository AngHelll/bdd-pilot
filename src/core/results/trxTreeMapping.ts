import { DomainGroup, FeatureInfo, OutlineExample, ScenarioInfo } from "../gherkin/model";
import { collectOutcomeKeysForTargets, outlineRowKey, scenarioKey } from "../runner/runScope";
import { RunTarget } from "../runner/filterBuilder";
import { MATCHING_DEBUG_CANDIDATE_CAP } from "./mappingReportFormat";
import { setMatchingDebugSource } from "./matchingDebugSession";
import { parseTheoryDisplayName, pickleIndexFromTestName, theoryCandidateFromTestName } from "../runner/theoryDisplayName";
import {
  matchesOutlineExampleRow,
  matchesScenarioInFeature,
} from "./scenarioMatch";
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

/** Gherkin leaf with 2+ TRX rows matching the same predicate. */
export interface AmbiguousMappedLeaf {
  label: string;
  candidateCount: number;
  /** Omitted when an Outline Theory matches K>1 leaves and none is chosen (R3). */
  chosenTestName?: string;
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
  /** Debug Pack: Theory keys vs Examples headers (capped, sanitized upstream). */
  residualOutlineLines?: string[];
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
  if (!matchesScenarioInFeature(result.testName, feature, scenario)) {
    return false;
  }
  if (example) {
    return matchesOutlineExampleRow(result.testName, example);
  }
  return true;
}

interface OutlineLeaf {
  feature: FeatureInfo;
  scenario: ScenarioInfo;
  example: OutlineExample;
  key: string;
  label: string;
}

interface TrxApplyHonesty {
  matchedKeys: Set<string>;
  unusedTrx: UnusedTrxRow[];
  ambiguousLeaves: AmbiguousMappedLeaf[];
  sharedChosenCount: number;
  /** Cap-N candidate testNames per leaf that matched ≥1 TRX row (debug pack). */
  candidatesByLabel: { label: string; candidateTestNames: string[]; chosenTestName?: string }[];
  residualOutlineLines: string[];
}

function collectOutlineLeaves(domains: DomainGroup[]): OutlineLeaf[] {
  const leaves: OutlineLeaf[] = [];
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (!scenario.examples?.length) {
          continue;
        }
        for (const example of scenario.examples) {
          leaves.push({
            feature,
            scenario,
            example,
            key: outlineRowKey(feature, scenario, example.rowIndex),
            label: leafLabel(feature.name, scenario.name, example.label),
          });
        }
      }
    }
  }
  return leaves;
}

function scopedOutlinesForTestName(
  testName: string,
  domains: DomainGroup[],
): { feature: FeatureInfo; scenario: ScenarioInfo }[] {
  const found: { feature: FeatureInfo; scenario: ScenarioInfo }[] = [];
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (!scenario.examples?.length) {
          continue;
        }
        if (matchesScenarioInFeature(testName, feature, scenario)) {
          found.push({ feature, scenario });
        }
      }
    }
  }
  return found;
}

function formatResidualOutlineLine(testName: string, exampleHeaders: string[]): string {
  const parsed = parseTheoryDisplayName(theoryCandidateFromTestName(testName));
  const theoryKeys = parsed
    ? parsed.params
        .map((param) => `${param.name}:${param.value}`)
        .join(",")
    : "";
  return `theoryKeys=${theoryKeys} vs exampleHeaders=${exampleHeaders.join(",")}`;
}

function resolveOutlineLeavesForTrx(
  result: TestResult,
  outlineLeaves: OutlineLeaf[],
  domains: DomainGroup[],
): { resolved: OutlineLeaf[]; matched: OutlineLeaf[] } {
  const matched = outlineLeaves.filter((leaf) =>
    trxRowMatchesLeaf(result, leaf.feature, leaf.scenario, leaf.example),
  );
  if (matched.length === 1) {
    return { resolved: matched, matched };
  }
  const pickle = pickleIndexFromTestName(result.testName);
  if (matched.length > 1) {
    if (pickle !== undefined) {
      const byIndex = matched.filter((leaf) => leaf.example.rowIndex === pickle);
      if (byIndex.length === 1) {
        return { resolved: byIndex, matched };
      }
    }
    return { resolved: [], matched };
  }
  if (pickle === undefined) {
    return { resolved: [], matched };
  }
  const scoped = scopedOutlinesForTestName(result.testName, domains);
  if (scoped.length !== 1) {
    return { resolved: [], matched };
  }
  const { feature, scenario } = scoped[0];
  const leaf = outlineLeaves.find(
    (item) =>
      item.feature === feature &&
      item.scenario === scenario &&
      item.example.rowIndex === pickle,
  );
  return { resolved: leaf ? [leaf] : [], matched };
}

/**
 * Outline: Theory-first (no silent first-apply when K>1). Non-outline: first match.
 * Unused / ambiguous / shared classified by **result index** (not testName).
 */
function applyTrxMatchesWithHonesty(
  store: OutcomeStoreTrxWriter,
  domains: DomainGroup[],
  summary: TrxMatchSummary,
): TrxApplyHonesty {
  const matchedKeys = new Set<string>();
  const chosenCounts = new Array<number>(summary.results.length).fill(0);
  const ambiguousLeaves: AmbiguousMappedLeaf[] = [];
  const candidatesByLabel: TrxApplyHonesty["candidatesByLabel"] = [];
  const residualOutlineLines: string[] = [];
  const residualSeen = new Set<string>();

  const applyChosen = (
    chosenIndex: number,
    key: string,
    label: string,
    candidateIndices: number[],
    markAmbiguous: boolean,
  ): void => {
    const match = summary.results[chosenIndex];
    store.set(key, match.outcome, match.durationMs, match.errorMessage);
    store.clearSkipReason(key);
    matchedKeys.add(key);
    chosenCounts[chosenIndex] += 1;
    candidatesByLabel.push({
      label,
      candidateTestNames: candidateIndices
        .slice(0, MATCHING_DEBUG_CANDIDATE_CAP)
        .map((i) => summary.results[i].testName),
      chosenTestName: match.testName,
    });
    if (markAmbiguous && candidateIndices.length > 1) {
      ambiguousLeaves.push({
        label,
        candidateCount: candidateIndices.length,
        chosenTestName: match.testName,
      });
    }
  };

  const pushResidual = (testName: string, headers: string[]): void => {
    if (residualOutlineLines.length >= MATCHING_DEBUG_CANDIDATE_CAP) {
      return;
    }
    const line = formatResidualOutlineLine(testName, headers);
    if (residualSeen.has(line)) {
      return;
    }
    residualSeen.add(line);
    residualOutlineLines.push(line);
  };

  const outlineLeaves = collectOutlineLeaves(domains);
  const pendingOutlineAmbiguous = new Map<
    string,
    { candidateCount: number; testNames: string[] }
  >();

  for (let i = 0; i < summary.results.length; i++) {
    const result = summary.results[i];
    const { resolved, matched } = resolveOutlineLeavesForTrx(result, outlineLeaves, domains);
    if (resolved.length === 1) {
      const leaf = resolved[0];
      if (matchedKeys.has(leaf.key)) {
        continue;
      }
      const candidateIndices: number[] = [];
      for (let j = 0; j < summary.results.length; j++) {
        if (trxRowMatchesLeaf(summary.results[j], leaf.feature, leaf.scenario, leaf.example)) {
          candidateIndices.push(j);
        }
      }
      if (!candidateIndices.includes(i)) {
        candidateIndices.unshift(i);
      }
      applyChosen(i, leaf.key, leaf.label, candidateIndices, false);
      continue;
    }
    if (matched.length > 1) {
      for (const leaf of matched) {
        const entry = pendingOutlineAmbiguous.get(leaf.label) ?? {
          candidateCount: 0,
          testNames: [],
        };
        entry.candidateCount = Math.max(entry.candidateCount, matched.length);
        if (entry.testNames.length < MATCHING_DEBUG_CANDIDATE_CAP) {
          entry.testNames.push(result.testName);
        }
        pendingOutlineAmbiguous.set(leaf.label, entry);
        pushResidual(result.testName, leaf.example.headers);
      }
    } else if (parseTheoryDisplayName(theoryCandidateFromTestName(result.testName))) {
      const scoped = scopedOutlinesForTestName(result.testName, domains);
      const headers = scoped[0]?.scenario.examples?.[0]?.headers ?? [];
      if (headers.length > 0) {
        pushResidual(result.testName, headers);
      }
    }
  }

  for (const [label, entry] of pendingOutlineAmbiguous) {
    const leaf = outlineLeaves.find((item) => item.label === label);
    if (leaf && matchedKeys.has(leaf.key)) {
      continue;
    }
    ambiguousLeaves.push({
      label,
      candidateCount: entry.candidateCount,
    });
    candidatesByLabel.push({
      label,
      candidateTestNames: entry.testNames.slice(0, MATCHING_DEBUG_CANDIDATE_CAP),
    });
  }

  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          continue;
        }
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
          candidates,
          true,
        );
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
    candidatesByLabel,
    residualOutlineLines,
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

/** Applies TRX to store. Scoped runs mark unmapped leaves; Run All only reports honesty. */
export function applyScopedTrxResults(
  store: OutcomeStoreTrxWriter,
  domains: DomainGroup[],
  summary: TrxMatchSummary,
  targets: RunTarget[],
  options?: { canceled?: boolean },
): TreeMappingReport | undefined {
  const scope = collectOutcomeKeysForTargets(targets, domains);
  if (scope !== "all" && scope.size === 0) {
    applyTrxMatchesToStore(store, domains, summary);
    return undefined;
  }

  const honesty = applyTrxMatchesWithHonesty(store, domains, summary);
  setMatchingDebugSource({ candidatesByLabel: honesty.candidatesByLabel });
  if (scope === "all") {
    return {
      inScope: 0,
      mapped: honesty.matchedKeys.size,
      unmapped: 0,
      unmappedLeaves: [],
      unusedTrx: honesty.unusedTrx,
      ambiguousLeaves: honesty.ambiguousLeaves,
      sharedChosenCount: honesty.sharedChosenCount,
      trxTotal: summary.results.length,
      residualOutlineLines: honesty.residualOutlineLines,
    };
  }

  finalizeScopedRunOutcomes(store, scope, honesty.matchedKeys, !!options?.canceled);
  return {
    ...computeTreeMappingReport(scope, store, domains),
    unusedTrx: honesty.unusedTrx,
    ambiguousLeaves: honesty.ambiguousLeaves,
    sharedChosenCount: honesty.sharedChosenCount,
    trxTotal: summary.results.length,
    residualOutlineLines: honesty.residualOutlineLines,
  };
}
