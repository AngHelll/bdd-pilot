import { PilotLocale, t } from "../i18n";
import { TreeDisplayMode } from "../gherkin/treeContainerLabels";
import { joinDescriptionParts } from "../gherkin/treeLabels";
import { TreeLeafLevel, TreePresentation } from "../gherkin/treePresentation";
import {
  formatOutcomeForTooltip,
  sanitizeErrorForStore,
  truncateErrorSnippet,
} from "./outcomeFeedback";
import { SkipReason, appendSkipReasonToDescription, skipReasonMessage } from "./skipReason";
import { TestOutcome } from "./trxParser";

/** Description snippet cap (tooltip may stay longer via existing helpers). */
const STORY_SNIPPET_MAX = 100;

/**
 * Duration the tree row may show. Missing, non-finite, and negative values stay blank
 * so a live result without `durationMs` cannot render an invented duration.
 * A finite value already stored is returned as-is; `OutcomeStore.set` still keeps a
 * previous duration when a later write omits `durationMs`.
 */
export function treeRowDurationMs(durationMs: number | undefined): number | undefined {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return undefined;
  }
  return durationMs;
}

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

/** Theme color token applied by the tree provider. Idle glyphs stay uncolored. */
export type TreeIconColorToken = "passed" | "failed" | "skipped";

export interface TreeLeafIconSpec {
  id: string;
  color?: TreeIconColorToken;
}

/**
 * One icon per row.
 * Classic keeps beaker / list-tree until a result exists.
 * Native Precision uses a level glyph only while the session has no results;
 * passed, failed, skipped, and pending then use the native status glyphs.
 */
export function resolveLeafIconSpec(input: {
  presentation: TreePresentation;
  level: TreeLeafLevel;
  /** Classic list-tree applies only to an outline that has no example rows. */
  classicBareOutline: boolean;
  outcome: TestOutcome | undefined;
  skipReason: SkipReason | undefined;
  sessionHasResults: boolean;
}): TreeLeafIconSpec {
  if (input.presentation === "nativePrecision") {
    const kind = resolveTreeLeafIconKind(input.outcome, input.skipReason, false);
    if (kind === "pending" || kind === "outline") {
      if (!input.sessionHasResults) {
        return { id: experimentalIdleIcon(input.level) };
      }
      return { id: "circle-outline" };
    }
    return iconSpecForKind(kind);
  }

  const kind = resolveTreeLeafIconKind(
    input.outcome,
    input.skipReason,
    input.classicBareOutline,
  );
  if ((kind === "pending" || kind === "outline") && !input.sessionHasResults) {
    return { id: input.classicBareOutline ? "list-tree" : "beaker" };
  }
  return iconSpecForKind(kind);
}

function experimentalIdleIcon(level: TreeLeafLevel): string {
  switch (level) {
    case "scenario":
      return "beaker";
    case "outline":
      return "table";
    case "example":
      return "symbol-parameter";
  }
}

function iconSpecForKind(kind: TreeLeafIconKind): TreeLeafIconSpec {
  switch (kind) {
    case "passed":
      return { id: "pass", color: "passed" };
    case "failed":
      return { id: "error", color: "failed" };
    case "skipped":
    case "canceled":
      return { id: "circle-slash", color: "skipped" };
    case "not_in_trx":
      return { id: "question", color: "skipped" };
    case "outline":
      return { id: "list-tree" };
    case "pending":
    default:
      return { id: "circle-outline" };
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
  /**
   * When false, the row keeps duration and tags and leaves the failure snippet
   * to the tooltip. The default preserves the Test Explorer row.
   */
  includeErrorSnippet?: boolean;
}

function isNarrativeSkip(reason: SkipReason | undefined): boolean {
  return reason === "not_in_trx" || reason === "canceled";
}

/**
 * Unified leaf description for BDD tree and Test Explorer.
 * Priority: failed+snippet → narrative skip → pending hint → base parts.
 * The tree passes `includeErrorSnippet: false` so the icon carries pass/fail
 * and a compact failure cannot drop the duration.
 */
export function formatLeafStoryStrip(input: LeafStoryStripInput): string | undefined {
  const compact = input.displayMode === "compact";
  const includeErrorSnippet = input.includeErrorSnippet !== false;
  const cleaned = input.errorSnippet ? sanitizeErrorForStore(input.errorSnippet) : undefined;
  const snippet = cleaned ? truncateErrorSnippet(cleaned, STORY_SNIPPET_MAX) : undefined;
  const failedStrip =
    includeErrorSnippet && input.outcome === "failed" && snippet
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
