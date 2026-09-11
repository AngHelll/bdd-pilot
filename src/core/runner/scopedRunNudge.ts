import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";
import { TagGroup } from "../gherkin/groupByTag";
import { TestOutcome } from "../results/trxParser";
import { outlineRowKey, scenarioKey } from "./runScope";

/** Multi-container suites only (silence 1–2 domains / small trees). */
export const MIN_CONTAINERS_FOR_NUDGE = 3;
/** Leaf estimate floor — covers samples/minimal-bdd. */
export const MIN_LEAVES_FOR_NUDGE = 40;
/** Top container must hold at least this share of fails. */
export const FAIL_SHARE_PCT = 0.6;
/** Ignore tip when fails are sparse. */
export const FAIL_MIN_COUNT = 5;

export interface ScopedRunNudgeInput {
  /** Domains or tag buckets (groupBy-aware). */
  containerCount: number;
  estimatedLeafCount: number;
  suggestEnabled: boolean;
  sessionSuppressed: boolean;
}

/** Whether Run All should offer a scoped-run nudge before starting. */
export function shouldSuggestScopedRunBeforeAll(input: ScopedRunNudgeInput): boolean {
  if (!input.suggestEnabled || input.sessionSuppressed) {
    return false;
  }
  if (input.containerCount < MIN_CONTAINERS_FOR_NUDGE) {
    return false;
  }
  if (input.estimatedLeafCount < MIN_LEAVES_FOR_NUDGE) {
    return false;
  }
  return true;
}

export interface FailConcentration {
  container: string;
  failCount: number;
  totalFails: number;
  share: number;
}

/**
 * Returns the top container when it concentrates enough fails.
 * `failCountByContainer` keys are domain or tag names from the current tree.
 */
export function detectFailConcentration(
  failCountByContainer: ReadonlyMap<string, number> | Record<string, number>,
): FailConcentration | undefined {
  const entries: { container: string; failCount: number }[] = [];
  if (failCountByContainer instanceof Map) {
    for (const [container, failCount] of failCountByContainer) {
      if (failCount > 0) {
        entries.push({ container, failCount });
      }
    }
  } else {
    for (const [container, failCount] of Object.entries(failCountByContainer)) {
      if (failCount > 0) {
        entries.push({ container, failCount });
      }
    }
  }

  if (entries.length === 0) {
    return undefined;
  }

  const totalFails = entries.reduce((sum, e) => sum + e.failCount, 0);
  if (totalFails < FAIL_MIN_COUNT) {
    return undefined;
  }

  entries.sort((a, b) => b.failCount - a.failCount || a.container.localeCompare(b.container));
  const top = entries[0]!;
  const share = top.failCount / totalFails;
  if (share < FAIL_SHARE_PCT) {
    return undefined;
  }

  return {
    container: top.container,
    failCount: top.failCount,
    totalFails,
    share,
  };
}

type OutcomeGetter = (key: string) => TestOutcome | undefined;

function leafFailed(getOutcome: OutcomeGetter, key: string): boolean {
  return getOutcome(key) === "failed";
}

function countScenarioFails(
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  getOutcome: OutcomeGetter,
): number {
  if (scenario.examples && scenario.examples.length > 0) {
    let n = 0;
    for (const example of scenario.examples) {
      if (leafFailed(getOutcome, outlineRowKey(feature, scenario, example.rowIndex))) {
        n += 1;
      }
    }
    return n;
  }
  return leafFailed(getOutcome, scenarioKey(feature, scenario)) ? 1 : 0;
}

/** Failed leaf counts keyed by discovery domain name. */
export function countFailedLeavesByDomain(
  domains: DomainGroup[],
  getOutcome: OutcomeGetter,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const domain of domains) {
    let n = 0;
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        n += countScenarioFails(feature, scenario, getOutcome);
      }
    }
    if (n > 0) {
      map.set(domain.name, n);
    }
  }
  return map;
}

/** Failed leaf counts keyed by tag (scenario may contribute to multiple tags). */
export function countFailedLeavesByTag(
  tagGroups: TagGroup[],
  getOutcome: OutcomeGetter,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const group of tagGroups) {
    let n = 0;
    for (const ref of group.scenarios) {
      n += countScenarioFails(ref.feature, ref.scenario, getOutcome);
    }
    if (n > 0) {
      map.set(group.tag, n);
    }
  }
  return map;
}

/** Estimated leaves for a domain group (outline rows count individually). */
export function countLeavesInDomain(domain: DomainGroup): number {
  let n = 0;
  for (const feature of domain.features) {
    for (const scenario of feature.scenarios) {
      if (scenario.examples && scenario.examples.length > 0) {
        n += scenario.examples.length;
      } else {
        n += 1;
      }
    }
  }
  return n;
}

/** Estimated leaves for a tag group. */
export function countLeavesInTagGroup(group: TagGroup): number {
  let n = 0;
  for (const ref of group.scenarios) {
    if (ref.scenario.examples && ref.scenario.examples.length > 0) {
      n += ref.scenario.examples.length;
    } else {
      n += 1;
    }
  }
  return n;
}
