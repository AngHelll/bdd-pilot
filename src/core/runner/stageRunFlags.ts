import * as path from "path";
import {
  ALL_STAGES,
  RunConfiguration,
  Stage,
  StageRunByStage,
  StageRunOverride,
} from "../config/types";

export type { StageRunByStage, StageRunOverride };

export interface EffectiveRunFlags {
  runConfiguration: RunConfiguration;
  runSettingsPath: string;
}

export interface ResolveEffectiveRunFlagsInput {
  stage: Stage;
  runConfiguration: RunConfiguration;
  runSettingsPath: string;
  byStage: StageRunByStage;
}

function isRunConfiguration(value: string): value is RunConfiguration {
  return value === "" || value === "Debug" || value === "Release";
}

function normalizeConfiguration(raw: unknown): RunConfiguration {
  if (typeof raw !== "string") {
    return "";
  }
  const trimmed = raw.trim();
  return isRunConfiguration(trimmed) ? trimmed : "";
}

/**
 * Defensive parse of `bddPilot.run.byStage` workspace setting.
 * Unknown stage keys are ignored; invalid nested shapes skipped.
 */
export function parseStageRunByStage(raw: unknown): StageRunByStage {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: StageRunByStage = {};
  const obj = raw as Record<string, unknown>;
  for (const stage of ALL_STAGES) {
    if (!Object.prototype.hasOwnProperty.call(obj, stage)) {
      continue;
    }
    const entry = obj[stage];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const override: StageRunOverride = {};
    const rec = entry as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(rec, "configuration")) {
      override.configuration = normalizeConfiguration(rec.configuration);
    }
    if (Object.prototype.hasOwnProperty.call(rec, "runSettings")) {
      const rs = rec.runSettings;
      override.runSettings = typeof rs === "string" ? rs : "";
    }
    if (
      Object.prototype.hasOwnProperty.call(override, "configuration") ||
      Object.prototype.hasOwnProperty.call(override, "runSettings")
    ) {
      result[stage] = override;
    }
  }
  return result;
}

/** Merge global run flags with optional per-stage overrides. */
export function resolveEffectiveRunFlags(input: ResolveEffectiveRunFlagsInput): EffectiveRunFlags {
  let runConfiguration = input.runConfiguration;
  let runSettingsPath = input.runSettingsPath;
  const override = input.byStage[input.stage];
  if (!override) {
    return { runConfiguration, runSettingsPath };
  }
  if (Object.prototype.hasOwnProperty.call(override, "configuration")) {
    runConfiguration = normalizeConfiguration(override.configuration ?? "");
  }
  if (Object.prototype.hasOwnProperty.call(override, "runSettings")) {
    runSettingsPath = typeof override.runSettings === "string" ? override.runSettings : "";
  }
  return { runConfiguration, runSettingsPath };
}

export function stageRunFlagsDifferFromGlobal(
  global: Pick<EffectiveRunFlags, "runConfiguration" | "runSettingsPath">,
  effective: EffectiveRunFlags,
): boolean {
  return (
    global.runConfiguration !== effective.runConfiguration ||
    global.runSettingsPath !== effective.runSettingsPath
  );
}

/** Output line when stage override changes flags vs global settings. */
export function formatStageRunFlagsAppliedMessage(
  effective: EffectiveRunFlags,
  basenameFn: (filePath: string) => string = path.basename,
): string {
  const configuration = effective.runConfiguration.trim() || "(default)";
  const trimmed = effective.runSettingsPath.trim();
  const settings = trimmed ? basenameFn(trimmed) : "(none)";
  return `[bdd-pilot] Stage run flags: configuration=${configuration}, settings=${settings}`;
}

/** Hub tooltip parts: configuration label and/or settings basename. */
export function formatEffectiveRunFlagsParts(
  effective: EffectiveRunFlags,
  basenameFn: (filePath: string) => string = path.basename,
): string[] {
  const parts: string[] = [];
  const configuration = effective.runConfiguration.trim();
  if (configuration) {
    parts.push(configuration);
  }
  const trimmed = effective.runSettingsPath.trim();
  if (trimmed) {
    parts.push(basenameFn(trimmed));
  }
  return parts;
}
