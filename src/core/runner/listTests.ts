import { spawn } from "child_process";
import { shouldDetachForProcessGroup, startAbortKillWatchdog } from "./processTree";
import { DotnetTestRunner } from "./testRunner";
import { extractListedTestNames } from "./theoryDisplayName";

export interface ListTestsRequest {
  dotnetPath: string;
  projectDir: string;
  testTarget?: string;
  /** Same `--filter` as the upcoming `dotnet test` run, when probing discover-time. */
  filter?: string;
  /** MTP does not receive `--list-tests`. Callers skip the probe instead. */
  runner?: DotnetTestRunner;
}

/**
 * Pure argv for `dotnet test --list-tests` (optional `--filter`).
 * Microsoft Testing Platform gets no `--list-tests`: a listed=0 result would
 * be a false "no tests" signal. Discovery is skipped for that runner.
 */
export function buildListTestsArgs(req: ListTestsRequest): string[] {
  if (req.runner === "mtp") {
    return ["test"];
  }
  const args = ["test"];
  if (req.testTarget) {
    args.push(req.testTarget);
  }
  args.push("--list-tests", "--nologo");
  const filter = req.filter?.trim();
  if (filter) {
    args.push("--filter", filter);
  }
  return args;
}

/** Runs `dotnet test --list-tests` and returns discovered display names. */
export function listDotnetTests(req: ListTestsRequest, signal?: AbortSignal): Promise<string[]> {
  if (req.runner === "mtp") {
    return Promise.resolve([]);
  }
  return new Promise((resolve, reject) => {
    const args = buildListTestsArgs(req);

    const child = spawn(req.dotnetPath, args, {
      cwd: req.projectDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: shouldDetachForProcessGroup(process.platform),
    });

    let settled = false;
    let stdout = "";
    let stderr = "";
    let disposeWatchdog = (): void => undefined;
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const finishReject = (err: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      disposeWatchdog();
      reject(err);
    };
    const finishResolve = (names: string[]): void => {
      if (settled) {
        return;
      }
      settled = true;
      disposeWatchdog();
      resolve(names);
    };

    disposeWatchdog = signal
      ? startAbortKillWatchdog(
          () => child.pid,
          signal,
          {
            onForce: () => undefined,
            onGiveUp: () => finishReject(new Error("list-tests canceled")),
          },
        )
      : (): void => undefined;

    child.on("error", (err) => {
      finishReject(err);
    });
    child.on("close", (code) => {
      if (signal?.aborted) {
        finishReject(new Error("list-tests canceled"));
        return;
      }
      if (code !== 0 && code !== null) {
        finishReject(new Error(stderr.trim() || `dotnet test --list-tests exited ${code}`));
        return;
      }
      finishResolve(extractListedTestNames(stdout));
    });
  });
}

/** list-tests with a budget; abort → reject (caller maps to discover `unknown`). */
export async function listDotnetTestsWithBudget(
  req: ListTestsRequest,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = (): void => controller.abort();
  signal?.addEventListener("abort", onOuterAbort, { once: true });
  try {
    return await listDotnetTests(req, controller.signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }
}
