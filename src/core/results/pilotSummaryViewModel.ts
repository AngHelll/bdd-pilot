import { FILTER_CHIP_MAX_LEN } from "../gherkin/treeSearch";
import { formatRollupDescriptionLocalized, OutcomeRollup } from "../gherkin/outcomeRollup";
import { TreeEmptyKind } from "../gherkin/treeEmptyState";
import { Diagnostic } from "../diagnostics/analyzer";
import { diagnosticHint } from "../diagnostics/diagnosticCatalog";
import { PilotLocale, t } from "../i18n";
import { LiveProgressState, formatProgressMessage } from "../runner/liveProgress";
import { resolveLastKnownSnapshot, LastKnownSnapshot } from "./dashboardLastKnown";
import { RehydrateNotice } from "./rehydrateNotice";
import { RunHistoryEntry } from "./runHistory";

export const PILOT_SUMMARY_DASHBOARD_COMMAND = "bddPilot.showDashboard";

const LABEL_MAX = 160;

export interface PilotSummaryViewModel {
  lastKnown?: LastKnownSnapshot;
  rehydrateNotice?: RehydrateNotice;
  running: boolean;
  debugging?: boolean;
  emptyKind?: TreeEmptyKind;
  /** Active tree search filter (display form). */
  searchQuery?: string;
  /** Top diagnostic from last run (hidden while running). */
  topDiagnostic?: Diagnostic;
  /** Live stdout progress during an active run (normal run only). */
  liveProgress?: LiveProgressState;
}

export interface BuildPilotSummaryOptions {
  storeRollup: OutcomeRollup | undefined;
  storeNonEmpty: boolean;
  lastHistory: RunHistoryEntry | undefined;
  rehydrateNotice: RehydrateNotice | undefined;
  running: boolean;
  debugging?: boolean;
  emptyKind?: TreeEmptyKind;
  searchQuery?: string;
  topDiagnostic?: Diagnostic;
  liveProgress?: LiveProgressState;
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
    debugging: options.debugging,
    emptyKind: options.emptyKind ?? "none",
    searchQuery: options.searchQuery?.trim() || undefined,
    topDiagnostic: options.running ? undefined : options.topDiagnostic,
    liveProgress: options.running ? options.liveProgress : undefined,
  };
}

const SUMMARY_DIAGNOSTIC_CHIP_MAX = 48;

/** Active diagnostic for summary row UI (none while running). */
export function resolveSummaryDiagnostic(model: PilotSummaryViewModel): Diagnostic | undefined {
  if (model.running) {
    return undefined;
  }
  return model.topDiagnostic;
}

/** Codicon id for the pilot summary tree row. */
export function resolvePilotSummaryIcon(
  running: boolean,
  debugging: boolean,
  diagnostic?: Diagnostic,
): string {
  if (running) {
    if (debugging) {
      return "debug-alt";
    }
    return "loading~spin";
  }
  if (diagnostic?.severity === "error") {
    return "warning";
  }
  if (diagnostic?.severity === "warning") {
    return "info";
  }
  return "history";
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

/** Tree row description: filter chip, live progress, or post-run diagnostic chip. */
export function formatPilotSummaryDescription(
  model: PilotSummaryViewModel,
  locale: PilotLocale,
): string | undefined {
  if (model.searchQuery) {
    return formatFilterChipDescription(model.searchQuery, locale);
  }
  if (model.running && model.liveProgress && model.liveProgress.completed > 0) {
    return formatProgressMessage(model.liveProgress, locale);
  }
  const diagnostic = resolveSummaryDiagnostic(model);
  if (diagnostic) {
    return formatSummaryDiagnosticChip(diagnostic, locale);
  }
  return undefined;
}

/** Summary row description when a tree search filter is active. */
export function formatFilterChipDescription(query: string, locale: PilotLocale): string {
  const truncated =
    query.length > FILTER_CHIP_MAX_LEN ? `${query.slice(0, FILTER_CHIP_MAX_LEN - 1)}…` : query;
  return t(locale, "tree.summaryFilterChip", { query: truncated });
}

export function formatPilotSummaryFilterTooltip(query: string, locale: PilotLocale): string {
  return t(locale, "tree.summaryFilterTooltip", { query });
}

export function formatSummaryDiagnosticChip(diagnostic: Diagnostic, locale: PilotLocale): string {
  let title = diagnostic.title;
  if (title.length > SUMMARY_DIAGNOSTIC_CHIP_MAX) {
    title = `${title.slice(0, SUMMARY_DIAGNOSTIC_CHIP_MAX - 1)}…`;
  }
  return t(locale, "tree.summaryDiagnosticChip", { title });
}

export function formatSummaryDiagnosticTooltip(diagnostic: Diagnostic, locale: PilotLocale): string {
  const hint = diagnostic.hint || diagnosticHint(locale, diagnostic.code);
  const body = t(locale, "tree.summaryDiagnosticTooltip", {
    code: diagnostic.code,
    title: diagnostic.title,
    hint,
  });
  if (diagnostic.detail) {
    return `${diagnostic.detail}\n\n${body}`;
  }
  return body;
}
