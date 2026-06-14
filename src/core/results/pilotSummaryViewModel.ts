import { formatRollupDescriptionLocalized, OutcomeRollup } from "../gherkin/outcomeRollup";
import { TreeEmptyKind } from "../gherkin/treeEmptyState";
import { PilotLocale, t } from "../i18n";
import { resolveLastKnownSnapshot, LastKnownSnapshot } from "./dashboardLastKnown";
import { RehydrateNotice } from "./rehydrateNotice";
import { RunHistoryEntry } from "./runHistory";

export const PILOT_SUMMARY_DASHBOARD_COMMAND = "bddPilot.showDashboard";

const LABEL_MAX = 160;

export interface PilotSummaryViewModel {
  lastKnown?: LastKnownSnapshot;
  rehydrateNotice?: RehydrateNotice;
  running: boolean;
  emptyKind?: TreeEmptyKind;
}

export interface BuildPilotSummaryOptions {
  storeRollup: OutcomeRollup | undefined;
  storeNonEmpty: boolean;
  lastHistory: RunHistoryEntry | undefined;
  rehydrateNotice: RehydrateNotice | undefined;
  running: boolean;
  emptyKind?: TreeEmptyKind;
}

export function buildPilotSummaryViewModel(options: BuildPilotSummaryOptions): PilotSummaryViewModel {
  return {
    lastKnown: resolveLastKnownSnapshot(
      options.storeRollup,
      options.storeNonEmpty,
      options.lastHistory,
      options.rehydrateNotice,
    ),
    rehydrateNotice: options.rehydrateNotice,
    running: options.running,
    emptyKind: options.emptyKind ?? "none",
  };
}

function emptyStateSummaryLabel(kind: TreeEmptyKind, locale: PilotLocale): string {
  switch (kind) {
    case "no_project":
      return t(locale, "tree.emptyNoProject");
    case "no_features":
      return t(locale, "tree.emptyNoFeatures");
    case "search_no_match":
      return t(locale, "tree.emptySearchNoMatch");
    default:
      return t(locale, "tree.summaryEmpty");
  }
}

/** Tree row label for the global pilot summary (Capa 1). */
export function formatPilotSummaryLabel(model: PilotSummaryViewModel, locale: PilotLocale): string {
  const parts: string[] = [];

  if (model.running) {
    parts.push(t(locale, "tree.summaryRunning"));
  }

  if (model.lastKnown) {
    const rollup = {
      passed: model.lastKnown.passed,
      failed: model.lastKnown.failed,
      skipped: model.lastKnown.skipped,
      withResults: model.lastKnown.passed + model.lastKnown.failed + model.lastKnown.skipped,
    };
    const body = formatRollupDescriptionLocalized(rollup, locale);
    if (body) {
      parts.push(body);
    }
  } else if (!model.running) {
    parts.push(emptyStateSummaryLabel(model.emptyKind ?? "none", locale));
  }

  if (model.rehydrateNotice) {
    parts.push(t(locale, "tree.summaryRehydrate"));
  }

  let label = parts.join(" · ");
  if (label.length > LABEL_MAX) {
    label = `${label.slice(0, LABEL_MAX - 1)}…`;
  }
  return label;
}
