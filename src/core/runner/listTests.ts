import { spawn } from "child_process";
import { extractListedTestNames } from "./theoryDisplayName";

export interface ListTestsRequest {
  dotnetPath: string;
  projectDir: string;
  testTarget?: string;
  /** Same `--filter` as the upcoming `dotnet test` run, when probing discover-time. */
  filter?: string;
}

/** Pure argv for `dotnet test --list-tests` (optional `--filter`). */
export function buildListTestsArgs(req: ListTestsRequest): string[] {
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
  return new Promise((resolve, reject) => {
    const args = buildListTestsArgs(req);

    const child = spawn(req.dotnetPath, args, {
      cwd: req.projectDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const onAbort = () => {
      child.kill();
      reject(new Error("list-tests canceled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    child.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (code !== 0 && code !== null) {
        reject(new Error(stderr.trim() || `dotnet test --list-tests exited ${code}`));
        return;
      }
      resolve(extractListedTestNames(stdout));
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
