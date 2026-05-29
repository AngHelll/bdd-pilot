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

export interface RunnerSettings {
  projectPath: string;
  defaultStage: Stage;
  defaultMode: ParallelismMode;
  requireConfirmationForStages: Stage[];
  dotnetPath: string;
}

export const DEFAULT_SETTINGS: RunnerSettings = {
  projectPath: "",
  defaultStage: "test",
  defaultMode: "debug",
  requireConfirmationForStages: ["stg", "prod"],
  dotnetPath: "dotnet",
};

export function isStage(value: string): value is Stage {
  return (ALL_STAGES as string[]).includes(value);
}

export function isMode(value: string): value is ParallelismMode {
  return (ALL_MODES as string[]).includes(value);
}
