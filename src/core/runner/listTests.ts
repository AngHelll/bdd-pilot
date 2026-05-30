import { spawn } from "child_process";
import { extractListedTestNames } from "./theoryDisplayName";

export interface ListTestsRequest {
  dotnetPath: string;
  projectDir: string;
  testTarget?: string;
}

/** Runs `dotnet test --list-tests` and returns discovered display names. */
export function listDotnetTests(req: ListTestsRequest, signal?: AbortSignal): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const args = ["test"];
    if (req.testTarget) {
      args.push(req.testTarget);
    }
    args.push("--list-tests", "--nologo");

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
