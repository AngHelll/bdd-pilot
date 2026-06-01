import { PilotLocale, t } from "../i18n";
import { joinDescriptionParts } from "../gherkin/treeLabels";
import { sanitize } from "../../security/sanitizer";
import { TestOutcome } from "./trxParser";

const DEFAULT_SNIPPET_MAX = 120;

/** Collapses whitespace and truncates for tree description / tooltip. */
export function truncateErrorSnippet(message: string, maxLen = DEFAULT_SNIPPET_MAX): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

/** Sanitizes before persisting in OutcomeStore (defense in depth). */
export function sanitizeErrorForStore(message?: string): string | undefined {
  if (!message?.trim()) {
    return undefined;
  }
  const clean = sanitize(message.trim());
  return clean.length > 0 ? clean : undefined;
}

export function formatOutcomeForTooltip(outcome: TestOutcome, locale: PilotLocale): string {
  switch (outcome) {
    case "passed":
      return t(locale, "outcome.passed");
    case "failed":
      return t(locale, "outcome.failed");
    case "skipped":
      return t(locale, "outcome.skipped");
    default:
      return outcome;
  }
}

/** Prepends localized failed label + error snippet to an existing description. */
export function prependFailedOutcomeToDescription(
  locale: PilotLocale,
  outcome: TestOutcome | undefined,
  errorMessage: string | undefined,
  baseDescription: string,
): string {
  if (outcome !== "failed" || !errorMessage) {
    return baseDescription;
  }
  const label = formatOutcomeForTooltip(outcome, locale);
  const snippet = truncateErrorSnippet(errorMessage);
  const failedPart = joinDescriptionParts(label, snippet);
  return baseDescription.length > 0 ? `${failedPart} · ${baseDescription}` : failedPart;
}
