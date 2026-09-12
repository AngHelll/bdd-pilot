import { PilotLocale, t } from "../i18n";
import { TreeDisplayMode } from "../gherkin/treeContainerLabels";
import { joinDescriptionParts } from "../gherkin/treeLabels";
import {
  formatOutcomeForTooltip,
  sanitizeErrorForStore,
  truncateErrorSnippet,
} from "./outcomeFeedback";
import { SkipReason, appendSkipReasonToDescription, skipReasonMessage } from "./skipReason";
import { TestOutcome } from "./trxParser";

/** Description snippet cap (tooltip may stay longer via existing helpers). */
const STORY_SNIPPET_MAX = 100;

/** Visual kind for BDD tree / TE leaf icons (providers map to ThemeIcon). */
export type TreeLeafIconKind =
  | "passed"
  | "failed"
  | "skipped"
  | "not_in_trx"
  | "canceled"
  | "pending"
  | "outline";

/**
 * Distinguish pending (never mapped) from narrative skips (`not_in_trx` / canceled)
 * and runner skipped outcomes.
 */
export function resolveTreeLeafIconKind(
  outcome: TestOutcome | undefined,
  skipReason: SkipReason | undefined,
  isOutlineParent: boolean,
): TreeLeafIconKind {
  if (skipReason === "not_in_trx") {
    return "not_in_trx";
  }
  if (skipReason === "canceled") {
    return "canceled";
  }
  switch (outcome) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    case "unknown":
      return "pending";
    default:
      return isOutlineParent ? "outline" : "pending";
  }
}

/**
 * Append skip narrative or a pending hint when the leaf has no outcome yet
 * but a skip reason is absent — callers should pass `showPendingHint` only
 * when a run has produced results elsewhere (scoped pending vs never-run tree).
 */
export function buildLeafStatusDescription(
  base: string | undefined,
  outcome: TestOutcome | undefined,
  skipReason: SkipReason | undefined,
  locale: PilotLocale,
  showPendingHint = false,
): string | undefined {
  if (skipReason) {
    const withSkip = appendSkipReasonToDescription(base, skipReason, locale);
    return withSkip.length > 0 ? withSkip : undefined;
  }
  if (!outcome && showPendingHint) {
    return joinDescriptionParts(base, t(locale, "tree.leafPending")) || undefined;
  }
  return base && base.length > 0 ? base : undefined;
}

export interface LeafStoryStripInput {
  outcome?: TestOutcome;
  skipReason?: SkipReason;
  errorSnippet?: string;
  displayMode: TreeDisplayMode;
  locale: PilotLocale;
  tagsPart?: string;
  durationPart?: string;
  featureHint?: string;
  showPendingHint?: boolean;
  /** Test Explorer includes the localized outcome word; the BDD tree uses the icon. */
  includeOutcomeLabel?: boolean;
}

function isNarrativeSkip(reason: SkipReason | undefined): boolean {
  return reason === "not_in_trx" || reason === "canceled";
}

/**
 * Unified leaf description for BDD tree and Test Explorer.
 * Priority: failed+snippet → narrative skip → pending hint → base parts.
 */
export function formatLeafStoryStrip(input: LeafStoryStripInput): string | undefined {
  const compact = input.displayMode === "compact";
  const cleaned = input.errorSnippet ? sanitizeErrorForStore(input.errorSnippet) : undefined;
  const snippet = cleaned ? truncateErrorSnippet(cleaned, STORY_SNIPPET_MAX) : undefined;
  const failedStrip =
    input.outcome === "failed" && snippet
      ? joinDescriptionParts(formatOutcomeForTooltip("failed", input.locale), snippet)
      : undefined;
  const omitTags = compact && (!!failedStrip || isNarrativeSkip(input.skipReason));
  const omitDuration = compact && !!failedStrip;
  const tags = omitTags ? undefined : input.tagsPart;
  const duration = omitDuration ? undefined : input.durationPart;
  const hint = compact ? undefined : input.featureHint;

  if (failedStrip) {
    return joinDescriptionParts(failedStrip, duration, tags, hint) || undefined;
  }
  if (isNarrativeSkip(input.skipReason)) {
    return (
      joinDescriptionParts(
        skipReasonMessage(input.skipReason!, input.locale),
        duration,
        tags,
        hint,
      ) || undefined
    );
  }

  const outcomeLabel =
    input.includeOutcomeLabel && input.outcome
      ? formatOutcomeForTooltip(input.outcome, input.locale)
      : undefined;
  if (input.skipReason) {
    const base = joinDescriptionParts(outcomeLabel, duration, tags, hint);
    return appendSkipReasonToDescription(base || undefined, input.skipReason, input.locale) || undefined;
  }
  if (!input.outcome && input.showPendingHint) {
    return (
      joinDescriptionParts(outcomeLabel, duration, tags, hint, t(input.locale, "tree.leafPending")) ||
      undefined
    );
  }
  return joinDescriptionParts(outcomeLabel, duration, tags, hint) || undefined;
}
