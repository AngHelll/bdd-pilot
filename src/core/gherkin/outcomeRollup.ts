import { TestOutcome } from "../results/trxParser";
import { PilotLocale } from "../i18n/locale";
import { t } from "../i18n/messages";

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
    if (!outcome) {
      continue;
    }
    if (outcome === "unknown") {
      rollup.withResults++;
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

/** Fail-first severity for API, descriptions, and roll-up text. */
export function rollupSeverity(
  rollup: OutcomeRollup,
): "failed" | "passed" | "skipped" | undefined {
  const classified = classifiedCount(rollup);
  if (classified === 0) {
    return undefined;
  }
  if (rollup.failed > 0) {
    return "failed";
  }
  if (rollup.passed === classified) {
    return "passed";
  }
  if (rollup.skipped > 0) {
    return "skipped";
  }
  return undefined;
}

/** Watch band: a couple of leftovers in a large container, not a material fail rate. */
export const WATCH_MIN_CLASSIFIED = 10;
export const WATCH_MAX_FAILED = 2;
export const WATCH_MAX_FAIL_RATE = 0.1;

export type ContainerHealth = "watch" | "failed" | "passed" | "skipped";

function classifiedCount(rollup: OutcomeRollup): number {
  return rollup.passed + rollup.failed + rollup.skipped;
}

function isWatchRollup(rollup: OutcomeRollup, classified: number): boolean {
  if (rollup.failed <= 0 || classified < WATCH_MIN_CLASSIFIED) {
    return false;
  }
  if (rollup.failed > WATCH_MAX_FAILED) {
    return false;
  }
  return rollup.failed / classified <= WATCH_MAX_FAIL_RATE;
}

/**
 * Container icon health. Watch is a subset of failed > 0; {@link rollupSeverity} stays fail-first.
 */
export function containerHealth(rollup: OutcomeRollup): ContainerHealth | undefined {
  const classified = classifiedCount(rollup);
  if (classified === 0) {
    return undefined;
  }
  if (isWatchRollup(rollup, classified)) {
    return "watch";
  }
  if (rollup.failed > 0) {
    return "failed";
  }
  if (rollup.passed === classified) {
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

/** Localized roll-up summary for Test Explorer descriptions. */
export function formatRollupDescriptionLocalized(
  rollup: OutcomeRollup,
  locale: PilotLocale,
): string | undefined {
  if (rollup.withResults === 0) {
    return undefined;
  }
  const sep = t(locale, "rollup.separator");
  const parts: string[] = [];
  if (rollup.failed > 0) {
    parts.push(t(locale, "rollup.failed", { count: rollup.failed }));
  }
  if (rollup.passed > 0) {
    parts.push(t(locale, "rollup.passed", { count: rollup.passed }));
  }
  if (rollup.skipped > 0) {
    parts.push(t(locale, "rollup.skipped", { count: rollup.skipped }));
  }
  return parts.length > 0 ? parts.join(sep) : undefined;
}

export function prependRollupLocalized(
  baseDescription: string,
  rollup: OutcomeRollup,
  locale: PilotLocale,
): string {
  const summary = formatRollupDescriptionLocalized(rollup, locale);
  if (!summary) {
    return baseDescription;
  }
  const sep = t(locale, "rollup.separator");
  return baseDescription.length > 0 ? `${summary}${sep}${baseDescription}` : summary;
}
