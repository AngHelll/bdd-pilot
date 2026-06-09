import { formatRollupDescriptionLocalized, OutcomeRollup } from "../gherkin/outcomeRollup";
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
}

export interface BuildPilotSummaryOptions {
  storeRollup: OutcomeRollup | undefined;
  storeNonEmpty: boolean;
  lastHistory: RunHistoryEntry | undefined;
  rehydrateNotice: RehydrateNotice | undefined;
  running: boolean;
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
  };
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
    parts.push(t(locale, "tree.summaryEmpty"));
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
