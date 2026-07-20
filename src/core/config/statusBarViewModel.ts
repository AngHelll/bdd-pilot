import { PilotLocale, t } from "../i18n";
import { StageEnvFileStatus } from "./envFile";
import { ParallelismMode, Stage } from "./types";

export type StatusBarDisplayMode = "compact" | "detailed";

export const STATUS_BAR_PROJECT_MAX = 28;

export interface CompactStatusBarInput {
  stage: Stage;
  mode: ParallelismMode;
  locale: PilotLocale;
  projectLabel?: string;
  running?: boolean;
  solutionSelected?: boolean;
  debugging?: boolean;
  /** When undefined, env line is omitted (no project resolved). */
  envStatus?: StageEnvFileStatus;
  /** Preformatted "Release · stg.runsettings" parts joined; omit line when empty. */
  runFlagsSummary?: string;
}

export function readStatusBarDisplayMode(value: string | undefined): StatusBarDisplayMode {
  return value === "detailed" ? "detailed" : "compact";
}

export function truncateStatusBarProjectLabel(label: string, max = STATUS_BAR_PROJECT_MAX): string {
  if (label.length <= max) {
    return label;
  }
  return `${label.slice(0, max - 1)}…`;
}

export function statusBarNeedsWarning(stage: Stage, projectLabel?: string): boolean {
  if (stage === "stg" || stage === "prod") {
    return true;
  }
  return !projectLabel;
}

export function formatHubEnvTooltipLine(
  locale: PilotLocale,
  envStatus: StageEnvFileStatus | undefined,
): string | undefined {
  if (envStatus === undefined) {
    return undefined;
  }
  if (envStatus.existingBasenames.length > 0) {
    return t(locale, "statusBar.hubTooltipEnv", { files: envStatus.existingBasenames.join(", ") });
  }
  return t(locale, "statusBar.hubTooltipEnvMissing");
}

export function formatHubRunFlagsTooltipLine(
  locale: PilotLocale,
  runFlagsSummary: string | undefined,
): string | undefined {
  if (!runFlagsSummary || runFlagsSummary.trim().length === 0) {
    return undefined;
  }
  return t(locale, "statusBar.hubTooltipRunFlags", { flags: runFlagsSummary.trim() });
}

export function formatDetailedStageTooltip(
  locale: PilotLocale,
  envStatus: StageEnvFileStatus | undefined,
): string {
  const lines = [t(locale, "statusBar.stageTooltip")];
  const envLine = formatHubEnvTooltipLine(locale, envStatus);
  if (envLine) {
    lines.push("", envLine);
  }
  return lines.join("\n");
}

export function formatCompactStatusBarLabel(input: CompactStatusBarInput): string {
  const project = input.projectLabel
    ? truncateStatusBarProjectLabel(input.projectLabel)
    : t(input.locale, "statusBar.compactProjectNotSet");
  const segments = `${input.stage} · ${input.mode} · ${project}`;
  return `$(beaker) Pilot  ${segments}`;
}

export function formatCompactStatusBarTooltip(input: CompactStatusBarInput): string {
  const project = input.projectLabel ?? t(input.locale, "statusBar.compactProjectNotSet");
  const lines = [
    t(input.locale, "statusBar.hubTooltipTitle"),
    "",
    `${t(input.locale, "statusBar.hubTooltipStage")}: ${input.stage}`,
    `${t(input.locale, "statusBar.hubTooltipMode")}: ${input.mode}`,
    `${t(input.locale, "statusBar.hubTooltipProject")}: ${project}`,
  ];
  const envLine = formatHubEnvTooltipLine(input.locale, input.envStatus);
  if (envLine) {
    lines.push(envLine);
  }
  const runFlagsLine = formatHubRunFlagsTooltipLine(input.locale, input.runFlagsSummary);
  if (runFlagsLine) {
    lines.push(runFlagsLine);
  }
  if (input.solutionSelected && input.projectLabel) {
    lines.push("", t(input.locale, "statusBar.solutionSlowHint"));
  }
  if (input.running) {
    lines.push(
      "",
      input.debugging
        ? t(input.locale, "statusBar.debugRunningTooltip")
        : t(input.locale, "statusBar.hubRunningHint"),
    );
  }
  lines.push("", t(input.locale, "statusBar.hubTooltipAction"));
  return lines.join("\n");
}
