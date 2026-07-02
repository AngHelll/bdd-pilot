import { PilotLocale, t } from "../i18n";
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
