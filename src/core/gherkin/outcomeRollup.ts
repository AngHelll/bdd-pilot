import { TestOutcome } from "../results/trxParser";

export interface OutcomeRollup {
  passed: number;
  failed: number;
  skipped: number;
  /** Scenarios/rows that received a mapped result. */
  withResults: number;
}

export function computeRollup(outcomes: Array<TestOutcome | undefined>): OutcomeRollup {
  const rollup: OutcomeRollup = { passed: 0, failed: 0, skipped: 0, withResults: 0 };
  for (const outcome of outcomes) {
    if (!outcome || outcome === "unknown") {
      continue;
    }
    rollup.withResults++;
    if (outcome === "passed") {
      rollup.passed++;
    } else if (outcome === "failed") {
      rollup.failed++;
    } else if (outcome === "skipped") {
      rollup.skipped++;
    }
  }
  return rollup;
}

/** Summary for tree descriptions, e.g. `2 failed · 17 passed`. Failures first. */
export function formatRollupDescription(rollup: OutcomeRollup): string | undefined {
  if (rollup.withResults === 0) {
    return undefined;
  }
  const parts: string[] = [];
  if (rollup.failed > 0) {
    parts.push(`${rollup.failed} failed`);
  }
  if (rollup.passed > 0) {
    parts.push(`${rollup.passed} passed`);
  }
  if (rollup.skipped > 0) {
    parts.push(`${rollup.skipped} skipped`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Picks a container icon severity from aggregated child outcomes. */
export function rollupSeverity(
  rollup: OutcomeRollup,
): "failed" | "passed" | "skipped" | undefined {
  if (rollup.failed > 0) {
    return "failed";
  }
  if (rollup.withResults === 0) {
    return undefined;
  }
  if (rollup.passed === rollup.withResults) {
    return "passed";
  }
  if (rollup.skipped > 0) {
    return "skipped";
  }
  return undefined;
}

export function prependRollup(baseDescription: string, rollup: OutcomeRollup): string {
  const summary = formatRollupDescription(rollup);
  if (!summary) {
    return baseDescription;
  }
  return baseDescription.length > 0 ? `${summary} · ${baseDescription}` : summary;
}
