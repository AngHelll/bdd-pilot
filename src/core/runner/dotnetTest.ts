import { spawn } from "child_process";
import * as path from "path";
import { ModeProfile, Stage } from "../config/types";

export interface RunRequest {
  dotnetPath: string;
  projectDir: string;
  /** Optional `.csproj`, `.sln`, or `.slnx` path passed to `dotnet test`. */
  testTarget?: string;
  /** Value for --filter, or undefined to run everything. */
  filter?: string;
  stage: Stage;
  mode: ModeProfile;
  /** Directory (relative to projectDir or absolute) for TRX results. */
  resultsDir: string;
  /** File name for the TRX logger output. */
  trxFileName: string;
  /** `Debug` or `Release`; omit flag when unset. */
  configuration?: string;
  /** When true, passes `--no-build`. */
  noBuild?: boolean;
  /** Absolute path to `.runsettings` for `--settings`. */
  settingsPath?: string;
  /** `dotnet test --verbosity` level; omit when unset. */
  cliVerbosity?: string;
  /** When true, passes `--blame`. */
  blame?: boolean;
  /** When true, passes `--blame-hang` and hang timeout. */
  blameHang?: boolean;
  /** Value for `--blame-hang-timeout` when blameHang is true. */
  blameHangTimeout?: string;
  /**
   * Extra environment variables (e.g. parsed from config/.env.<stage>) merged
   * into the child process environment. Never logged or persisted.
   */
  extraEnv?: Record<string, string>;
}

export interface BuildArgsOptions {
  /** When false, omits xUnit RunSettings after `--` (debug launch). Default true. */
  includeXUnitRunSettings?: boolean;
}

export interface RunResult {
  exitCode: number | null;
  canceled: boolean;
  trxPath: string;
}

export interface RunCallbacks {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onStart?: (command: string) => void;
}

/**
 * Builds the argument vector for `dotnet test`. Kept pure for unit testing.
 */
export function buildArgs(req: RunRequest, options: BuildArgsOptions = {}): string[] {
  const includeXUnit = options.includeXUnitRunSettings !== false;
  const args = ["test"];
  if (req.testTarget && isExplicitTestTarget(req.testTarget)) {
    args.push(req.testTarget);
  }

  const configuration = req.configuration?.trim();
  if (configuration) {
    args.push("--configuration", configuration);
  }
  if (req.noBuild) {
    args.push("--no-build");
  }
  if (req.settingsPath?.trim()) {
    args.push("--settings", req.settingsPath.trim());
  }

  const cliVerbosity = req.cliVerbosity?.trim();
  if (cliVerbosity) {
    args.push("--verbosity", cliVerbosity);
  }
  if (req.blame) {
    args.push("--blame");
  }
  if (req.blameHang) {
    args.push("--blame-hang");
    const timeout = req.blameHangTimeout?.trim() || "10m";
    args.push("--blame-hang-timeout", timeout);
  }

  args.push("--nologo", "--logger", `trx;LogFileName=${req.trxFileName}`, "--results-directory", req.resultsDir);

  if (req.filter && req.filter.trim().length > 0) {
    args.push("--filter", req.filter);
  }

  if (includeXUnit) {
    // Pass xUnit parallelism as RunSettings on the command line so we don't have
    // to mutate the project's xunit.runner.json on disk.
    args.push(
      "--",
      `xUnit.MaxParallelThreads=${req.mode.maxParallelThreads}`,
      `xUnit.ParallelizeTestCollections=${req.mode.parallelizeTestCollections}`,
      `xUnit.ParallelizeAssembly=${req.mode.parallelizeAssembly}`,
    );
  }

  return args;
}

function isExplicitTestTarget(target: string): boolean {
  const lower = target.toLowerCase();
  return lower.endsWith(".csproj") || lower.endsWith(".sln") || lower.endsWith(".slnx");
}

/**
 * Builds the environment for the child process. Credentials come from the
 * framework's own gitignored .env files (passed in as extraEnv) and are merged
 * in memory only. STAGE is always injected last so it cannot be overridden.
 */
export function buildEnv(
  base: NodeJS.ProcessEnv,
  stage: Stage,
  extraEnv?: Record<string, string>,
): NodeJS.ProcessEnv {
  return { ...base, ...(extraEnv ?? {}), STAGE: stage };
}

export function resolveTrxPath(req: RunRequest): string {
  const dir = path.isAbsolute(req.resultsDir)
    ? req.resultsDir
    : path.join(req.projectDir, req.resultsDir);
  return path.join(dir, req.trxFileName);
}

export function runDotnetTest(
  req: RunRequest,
  callbacks: RunCallbacks,
  signal: AbortSignal,
): Promise<RunResult> {
  const args = buildArgs(req);
  const env = buildEnv(process.env, req.stage, req.extraEnv);
  const trxPath = resolveTrxPath(req);

  callbacks.onStart?.(`${req.dotnetPath} ${args.join(" ")}`);

  return new Promise<RunResult>((resolve, reject) => {
    let canceled = false;
    const child = spawn(req.dotnetPath, args, {
      cwd: req.projectDir,
      env,
      signal,
    });

    child.stdout?.on("data", (d) => callbacks.onStdout?.(d.toString()));
    child.stderr?.on("data", (d) => callbacks.onStderr?.(d.toString()));

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).name === "AbortError") {
        canceled = true;
        resolve({ exitCode: null, canceled: true, trxPath });
        return;
      }
      reject(err);
    });

    child.on("close", (code) => {
      resolve({ exitCode: code, canceled, trxPath });
    });
  });
}
