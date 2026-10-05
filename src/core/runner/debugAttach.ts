/** Makes `testhost` print its PID and wait for a debugger; NOBP skips the initial `Debugger.Break()`. */
export const DEBUG_HOST_ENV: Readonly<Record<string, string>> = {
  VSTEST_HOST_DEBUG: "1",
  VSTEST_DEBUG_NOBP: "1",
};

export interface AttachDebugConfig {
  type: "coreclr";
  request: "attach";
  name: string;
  processId: number;
}

export interface TesthostPidScan {
  pids: number[];
  /** Trailing partial line to prepend to the next chunk. */
  carry: string;
}

const PID_LINE = /Process Id:\s*(\d+),\s*Name:\s*\S+/g;

/**
 * Scans `dotnet test` output for `Process Id: N, Name: testhost` lines.
 * Only complete lines are matched; an unterminated tail is returned as `carry`.
 */
export function parseTesthostPids(chunk: string, carry = ""): TesthostPidScan {
  const text = carry + chunk;
  const lastNewline = text.lastIndexOf("\n");
  const complete = lastNewline >= 0 ? text.slice(0, lastNewline + 1) : "";
  const pids: number[] = [];
  for (const match of complete.matchAll(PID_LINE)) {
    const pid = Number(match[1]);
    if (pid > 0) {
      pids.push(pid);
    }
  }
  return { pids, carry: lastNewline >= 0 ? text.slice(lastNewline + 1) : text };
}

export function buildAttachDebugConfig(name: string, processId: number): AttachDebugConfig {
  return { type: "coreclr", request: "attach", name, processId };
}
