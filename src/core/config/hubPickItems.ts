import { PilotLocale, t } from "../i18n";
import { ALL_MODES, ALL_STAGES, ParallelismMode, Stage } from "./types";

export interface HubPickItemSpec {
  label: string;
  value: string;
  description: string;
}

const STAGE_DESCRIPTION_KEYS: Record<Stage, "hub.stage.dev" | "hub.stage.test" | "hub.stage.stg" | "hub.stage.prod"> = {
  dev: "hub.stage.dev",
  test: "hub.stage.test",
  stg: "hub.stage.stg",
  prod: "hub.stage.prod",
};

const MODE_DESCRIPTION_KEYS: Record<
  ParallelismMode,
  "hub.mode.debug" | "hub.mode.parallel" | "hub.mode.ci"
> = {
  debug: "hub.mode.debug",
  parallel: "hub.mode.parallel",
  ci: "hub.mode.ci",
};

export function buildStageHubPickItems(current: Stage, locale: PilotLocale): HubPickItemSpec[] {
  return ALL_STAGES.map((stage) => ({
    label: stage === current ? `$(check) ${stage}` : stage,
    value: stage,
    description: t(locale, STAGE_DESCRIPTION_KEYS[stage]),
  }));
}

export function buildModeHubPickItems(current: ParallelismMode, locale: PilotLocale): HubPickItemSpec[] {
  return ALL_MODES.map((mode) => ({
    label: mode === current ? `$(check) ${mode}` : mode,
    value: mode,
    description: t(locale, MODE_DESCRIPTION_KEYS[mode]),
  }));
}
