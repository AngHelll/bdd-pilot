import { PilotLocale, t } from "../i18n";

/** UI cap for the filter clause in confirm detail / Output (CF3). */
export const PRE_RUN_FILTER_MAX_CHARS = 120;

export interface PreRunDrySummaryInput {
  estimatedCount?: number;
  filter?: string;
  scopeLabel?: string;
}

export function truncatePreRunFilter(
  filter: string,
  maxChars = PRE_RUN_FILTER_MAX_CHARS,
): string {
  const oneLine = filter.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxChars) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxChars - 1)}…`;
}

/**
 * Pre-run dry filter line: estimated N + `--filter` (truncated) + scope when N or filter is missing.
 * Returns `undefined` when there is nothing to show.
 */
export function formatPreRunDrySummary(
  locale: PilotLocale,
  input: PreRunDrySummaryInput,
): string | undefined {
  const countPart =
    input.estimatedCount !== undefined
      ? t(locale, "envGuard.dryCount", { count: input.estimatedCount })
      : undefined;
  const trimmedFilter = input.filter?.trim();
  const filterPart = trimmedFilter ? truncatePreRunFilter(trimmedFilter) : undefined;
  const scopePart = input.scopeLabel?.trim() || undefined;

  const parts: string[] = [];
  if (countPart) {
    parts.push(countPart);
  }
  if (filterPart) {
    parts.push(filterPart);
  }
  if (scopePart && (!countPart || !filterPart)) {
    parts.push(scopePart);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
