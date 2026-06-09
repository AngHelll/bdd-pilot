import { RUN_SCOPE_ALL_TESTS_LABEL } from "../diagnostics/aiFailureContext";
import { PilotLocale, t } from "../i18n";
import { RunHistoryEntry } from "./runHistory";
import { isCanceledRun } from "./dashboardLastKnown";

export interface DashboardTotals {
  runs: number;
  passed: number;
  failed: number;
  canceled: number;
}

/** Global KPI totals — canceled runs do not inflate passed/failed sums. */
export function computeDashboardTotals(history: RunHistoryEntry[]): DashboardTotals {
  return history.reduce(
    (acc, entry) => {
      acc.runs++;
      if (isCanceledRun(entry)) {
        acc.canceled++;
      } else {
        acc.passed += entry.passed;
        acc.failed += entry.failed;
      }
      return acc;
    },
    { runs: 0, passed: 0, failed: 0, canceled: 0 },
  );
}

export function truncateScopeFilter(filter: string | undefined, maxLen = 40): string {
  if (!filter?.trim()) {
    return "";
  }
  const trimmed = filter.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

/** Scope column text for dashboard history rows. */
export function formatHistoryScopeDisplay(
  entry: RunHistoryEntry,
  locale: PilotLocale,
  maxLen = 40,
): string {
  if (isCanceledRun(entry) && !entry.filter?.trim() && !entry.scopeLabel?.trim()) {
    return t(locale, "dashboard.scopeCanceled");
  }

  const scopeLabel = entry.scopeLabel?.trim();
  if (scopeLabel) {
    if (scopeLabel === RUN_SCOPE_ALL_TESTS_LABEL) {
      return t(locale, "dashboard.scopeAllTests");
    }
    return truncateScopeFilter(scopeLabel, maxLen) || scopeLabel;
  }

  const filter = entry.filter?.trim();
  if (filter) {
    return truncateScopeFilter(filter, maxLen) || filter;
  }

  return "—";
}
