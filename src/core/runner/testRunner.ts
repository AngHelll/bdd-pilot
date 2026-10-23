import * as fs from "fs";
import * as path from "path";

/** Value `dotnet test` treats as Microsoft Testing Platform. */
export const MTP_RUNNER_NAME = "Microsoft.Testing.Platform";

export type DotnetTestRunner = "vstest" | "mtp";

export interface ResolveTestRunnerInput {
  /** Raw `global.json` text. Ignored when `envValue` is present, including `""`. */
  globalJsonText?: string;
  /**
   * `DOTNET_TEST_RUNNER` when the variable exists.
   * `undefined` means absent, so `global.json` decides.
   */
  envValue?: string;
}

/**
 * MTP when the environment names `Microsoft.Testing.Platform` (any case),
 * or, when that variable is absent, when `global.json` `test.runner` is that
 * exact string. Empty or unknown values stay on VSTest. The environment wins.
 */
export function resolveTestRunner(input: ResolveTestRunnerInput): DotnetTestRunner {
  if (input.envValue !== undefined) {
    return input.envValue.trim().toLowerCase() === MTP_RUNNER_NAME.toLowerCase() ? "mtp" : "vstest";
  }
  return runnerFromGlobalJson(input.globalJsonText);
}

/** Reads the nearest `global.json` from `projectDir` upward, then applies {@link resolveTestRunner}. */
export function readTestRunner(
  projectDir: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): DotnetTestRunner {
  const envPresent = Object.prototype.hasOwnProperty.call(env, "DOTNET_TEST_RUNNER");
  const envValue = envPresent ? String(env.DOTNET_TEST_RUNNER ?? "") : undefined;
  return resolveTestRunner({
    envValue,
    globalJsonText: envPresent ? undefined : readNearestGlobalJson(projectDir),
  });
}

function runnerFromGlobalJson(text: string | undefined): DotnetTestRunner {
  if (!text?.trim()) {
    return "vstest";
  }
  try {
    const parsed = JSON.parse(text) as { test?: { runner?: unknown } };
    return parsed?.test?.runner === MTP_RUNNER_NAME ? "mtp" : "vstest";
  } catch {
    return "vstest";
  }
}

function readNearestGlobalJson(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  for (;;) {
    const candidate = path.join(dir, "global.json");
    if (fs.existsSync(candidate)) {
      try {
        return fs.readFileSync(candidate, "utf8");
      } catch {
        return undefined;
      }
    }
    if (dir === root) {
      return undefined;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}
