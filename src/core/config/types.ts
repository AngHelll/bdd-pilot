import { FilterMappingConfig, DEFAULT_FILTER_MAPPING } from "../runner/filterMapping";

export type Stage = "dev" | "test" | "stg" | "prod";

export type ParallelismMode = "debug" | "parallel" | "ci";

export const ALL_STAGES: Stage[] = ["dev", "test", "stg", "prod"];

export const ALL_MODES: ParallelismMode[] = ["debug", "parallel", "ci"];

export interface ModeProfile {
  mode: ParallelismMode;
  parallelizeTestCollections: boolean;
  parallelizeAssembly: boolean;
  maxParallelThreads: number;
}

/**
 * Parallelism presets mirror common xunit.runner.*.json profiles
 * (debug = 1 thread, parallel = 4, ci = 8).
 */
export const MODE_PROFILES: Record<ParallelismMode, ModeProfile> = {
  debug: {
    mode: "debug",
    parallelizeTestCollections: false,
    parallelizeAssembly: false,
    maxParallelThreads: 1,
  },
  parallel: {
    mode: "parallel",
    parallelizeTestCollections: true,
    parallelizeAssembly: false,
    maxParallelThreads: 4,
  },
  ci: {
    mode: "ci",
    parallelizeTestCollections: true,
    parallelizeAssembly: true,
    maxParallelThreads: 8,
  },
};

export type RunConfiguration = "" | "Debug" | "Release";

/** MSBuild / `dotnet test --verbosity` (not Output filter). Empty = omit flag. */
export type CliVerbosity = "" | "quiet" | "minimal" | "normal" | "detailed" | "diagnostic";

export type BlameHangMode = "off" | "on";

export const DEFAULT_BLAME_HANG_TIMEOUT = "10m";

export const ALL_CLI_VERBOSITIES: CliVerbosity[] = [
  "",
  "quiet",
  "minimal",
  "normal",
  "detailed",
  "diagnostic",
];

/** Per-stage override for `dotnet test` configuration / runsettings path. */
export interface StageRunOverride {
  configuration?: RunConfiguration;
  runSettings?: string;
}

export type StageRunByStage = Partial<Record<Stage, StageRunOverride>>;

export interface RunnerSettings {
  projectPath: string;
  defaultStage: Stage;
  defaultMode: ParallelismMode;
  requireConfirmationForStages: Stage[];
  /** When false (default), STAGE=prod runs are blocked until the user opts in. */
  allowProductionRuns: boolean;
  dotnetPath: string;
  filterMapping: FilterMappingConfig;
  /** Empty = omit `--configuration`. */
  runConfiguration: RunConfiguration;
  runNoBuild: boolean;
  /** Raw path from settings; resolved at run time. */
  runSettingsPath: string;
  /** Per-stage overrides for configuration / runSettings. */
  runByStage: StageRunByStage;
  /** Empty = omit `--verbosity`. */
  runCliVerbosity: CliVerbosity;
  runBlame: boolean;
  runBlameHang: BlameHangMode;
  /** Used only when `runBlameHang` is `on`. */
  runBlameHangTimeout: string;
}

export const DEFAULT_SETTINGS: RunnerSettings = {
  projectPath: "",
  defaultStage: "test",
  defaultMode: "debug",
  requireConfirmationForStages: ["stg", "prod"],
  allowProductionRuns: false,
  dotnetPath: "dotnet",
  filterMapping: DEFAULT_FILTER_MAPPING,
  runConfiguration: "",
  runNoBuild: false,
  runSettingsPath: "",
  runByStage: {},
  runCliVerbosity: "",
  runBlame: false,
  runBlameHang: "off",
  runBlameHangTimeout: DEFAULT_BLAME_HANG_TIMEOUT,
};

export function isStage(value: string): value is Stage {
  return (ALL_STAGES as string[]).includes(value);
}

export function isMode(value: string): value is ParallelismMode {
  return (ALL_MODES as string[]).includes(value);
}

export function isCliVerbosity(value: string): value is CliVerbosity {
  return (ALL_CLI_VERBOSITIES as string[]).includes(value);
}

export function isBlameHangMode(value: string): value is BlameHangMode {
  return value === "off" || value === "on";
}

/** Normalize setting / short forms (`q` → `quiet`). Unknown → omit. */
export function normalizeCliVerbosity(value: string | undefined): CliVerbosity {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  if (isCliVerbosity(raw)) {
    return raw;
  }
  const short: Record<string, CliVerbosity> = {
    q: "quiet",
    m: "minimal",
    n: "normal",
    d: "detailed",
    diag: "diagnostic",
  };
  return short[raw] ?? "";
}
