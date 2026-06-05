import { PilotLocale, t } from "../i18n";
import { joinDescriptionParts } from "../gherkin/treeLabels";

export type SkipReason = "runner_skipped" | "not_in_trx" | "canceled" | "unknown";

export function skipReasonMessage(reason: SkipReason, locale: PilotLocale): string {
  switch (reason) {
    case "runner_skipped":
      return t(locale, "skip.runner");
    case "not_in_trx":
      return t(locale, "skip.notInTrx");
    case "canceled":
      return t(locale, "skip.canceled");
    case "unknown":
      return t(locale, "skip.unknown");
  }
}

/** Appends a localized skip reason suffix to an existing TE description. */
export function appendSkipReasonToDescription(
  description: string | undefined,
  reason: SkipReason,
  locale: PilotLocale,
): string {
  const reasonText = skipReasonMessage(reason, locale);
  if (!description || description.length === 0) {
    return reasonText;
  }
  return joinDescriptionParts(description, reasonText);
}
