import { PilotLocale, t } from "../i18n";
import { OutcomeRollup } from "./outcomeRollup";
import { DurationDisplayMode, formatDuration } from "../results/durationFormat";
import { sanitizeErrorForStore } from "../results/outcomeFeedback";
import { SkipReason, skipReasonMessage } from "../results/skipReason";
import { TestOutcome } from "../results/trxParser";

/**
 * Inline failure text longer than this is not a reliable one-line summary.
 * The full diagnostic stays in the tooltip.
 */
const BRIEF_FAILURE_MAX = 42;

export interface ConciseLeafInput {
  outcome?: TestOutcome;
  skipReason?: SkipReason;
  errorSnippet?: string;
  locale: PilotLocale;
  durationMs?: number;
  durationDisplay?: DurationDisplayMode;
  showPendingHint?: boolean;
}

/**
 * One secondary token for a domain, tag, feature, or outline parent.
 * Failures win. Passed and skipped containers stay quiet; counts stay in the tooltip.
 */
export function conciseContainerDescription(rollup: OutcomeRollup, locale: PilotLocale): string {
  if (rollup.failed > 0) {
    return t(locale, "rollup.failed", { count: rollup.failed });
  }
  return "";
}

/**
 * One secondary token for a scenario or example row.
 * The label and the status icon stay outside this string.
 */
export function conciseLeafDescription(input: ConciseLeafInput): string | undefined {
  if (input.outcome === "failed") {
    const brief = briefFailureSummary(input.errorSnippet);
    if (brief) {
      return brief;
    }
    if (isNarrativeSkip(input.skipReason)) {
      return skipReasonMessage(input.skipReason!, input.locale);
    }
    return t(input.locale, "outcome.failed");
  }

  if (input.skipReason) {
    return skipReasonMessage(input.skipReason, input.locale);
  }

  if (input.outcome === "passed") {
    return positiveDurationLabel(input.durationMs, input.durationDisplay ?? "auto");
  }

  if (input.outcome === "skipped") {
    return t(input.locale, "outcome.skipped");
  }

  if (!input.outcome && input.showPendingHint) {
    return t(input.locale, "tree.leafPending");
  }

  return undefined;
}

function briefFailureSummary(errorSnippet: string | undefined): string | undefined {
  if (!errorSnippet) {
    return undefined;
  }
  const cleaned = sanitizeErrorForStore(errorSnippet);
  if (!cleaned) {
    return undefined;
  }
  const oneLine = cleaned.replace(/\s+/g, " ").trim();
  if (!oneLine || oneLine.length > BRIEF_FAILURE_MAX) {
    return undefined;
  }
  if (/exampleTags\s*:/i.test(oneLine)) {
    return undefined;
  }
  return oneLine;
}

function positiveDurationLabel(
  ms: number | undefined,
  mode: DurationDisplayMode,
): string | undefined {
  if (ms === undefined || !Number.isFinite(ms) || Math.round(ms) <= 0) {
    return undefined;
  }
  const label = formatDuration(ms, mode);
  if (!label || label === "—") {
    return undefined;
  }
  return label;
}

function isNarrativeSkip(reason: SkipReason | undefined): boolean {
  return reason === "not_in_trx" || reason === "canceled";
}
