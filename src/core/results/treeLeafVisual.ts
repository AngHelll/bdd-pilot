import { PilotLocale, t } from "../i18n";
import { joinDescriptionParts } from "../gherkin/treeLabels";
import { SkipReason, appendSkipReasonToDescription } from "./skipReason";
import { TestOutcome } from "./trxParser";

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
