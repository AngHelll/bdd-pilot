import { spawn } from "child_process";

/** Wait after SIGTERM / taskkill before escalating to SIGKILL. */
export const ABORT_KILL_GRACE_MS = 3000;
/** After SIGKILL, resolve canceled even if `close` never fires. */
export const ABORT_KILL_FORCE_WAIT_MS = 1000;
/** Debug Cancel: force-finish if `onDidTerminateDebugSession` never arrives. */
export const DEBUG_TERMINATE_GRACE_MS = 5000;

export type KillPhase = "term" | "kill";

export type ProcessTreeKillPlan =
  | { kind: "skip" }
  | { kind: "posix-group"; targetPid: number; signal: NodeJS.Signals }
  | { kind: "win-taskkill"; args: string[] };

export type CancelIntent = "abort" | "stopDebug" | "none";

export function isKillablePid(pid: number | undefined): pid is number {
  return typeof pid === "number" && Number.isInteger(pid) && pid > 0;
}

/** Unix children must be process-group leaders so `-pid` reaches testhost / browsers. */
export function shouldDetachForProcessGroup(platform: NodeJS.Platform): boolean {
  return platform !== "win32";
}

export function buildProcessTreeKillPlan(
  platform: NodeJS.Platform,
  pid: number | undefined,
  phase: KillPhase,
): ProcessTreeKillPlan {
  if (!isKillablePid(pid)) {
    return { kind: "skip" };
  }
  if (platform === "win32") {
    const args = ["/PID", String(pid), "/T"];
    if (phase === "kill") {
      args.push("/F");
    }
    return { kind: "win-taskkill", args };
  }
  return {
    kind: "posix-group",
    targetPid: -pid,
    signal: phase === "kill" ? "SIGKILL" : "SIGTERM",
  };
}

export function executeProcessTreeKill(plan: ProcessTreeKillPlan): void {
  try {
    if (plan.kind === "skip") {
      return;
    }
    if (plan.kind === "posix-group") {
      process.kill(plan.targetPid, plan.signal);
      return;
    }
    spawn("taskkill", plan.args, { stdio: "ignore", windowsHide: true });
  } catch {
    // ESRCH — process already gone
  }
}

export function isCanceledOnClose(signalAborted: boolean): boolean {
  return signalAborted;
}

export function formatRunCanceledLine(input: { forced: boolean }): string {
  return input.forced ? "[bdd-pilot] Run canceled (forced)." : "[bdd-pilot] Run canceled.";
}

export function resolveCancelIntent(input: {
  hasActiveRun: boolean;
  debugActive: boolean;
}): CancelIntent {
  if (input.hasActiveRun) {
    return "abort";
  }
  if (input.debugActive) {
    return "stopDebug";
  }
  return "none";
}

export interface AbortKillWatchdogHooks {
  onForce: () => void;
  onGiveUp: () => void;
}

export interface AbortKillWatchdogOptions {
  platform?: NodeJS.Platform;
  graceMs?: number;
  forceWaitMs?: number;
  execute?: (plan: ProcessTreeKillPlan) => void;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

/**
 * On abort: SIGTERM the process tree, then SIGKILL, then give up (caller settles).
 * Second abort is a no-op. Dispose cancels pending timers (e.g. child already closed).
 */
export function startAbortKillWatchdog(
  getPid: () => number | undefined,
  signal: AbortSignal,
  hooks: AbortKillWatchdogHooks,
  options: AbortKillWatchdogOptions = {},
): () => void {
  const platform = options.platform ?? process.platform;
  const graceMs = options.graceMs ?? ABORT_KILL_GRACE_MS;
  const forceWaitMs = options.forceWaitMs ?? ABORT_KILL_FORCE_WAIT_MS;
  const execute = options.execute ?? executeProcessTreeKill;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;

  let started = false;
  let disposed = false;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  let forceTimer: ReturnType<typeof setTimeout> | undefined;

  const begin = (): void => {
    if (started || disposed) {
      return;
    }
    started = true;
    const term = buildProcessTreeKillPlan(platform, getPid(), "term");
    if (term.kind === "skip") {
      hooks.onForce();
      hooks.onGiveUp();
      return;
    }
    execute(term);
    graceTimer = setTimeoutFn(() => {
      hooks.onForce();
      execute(buildProcessTreeKillPlan(platform, getPid(), "kill"));
      forceTimer = setTimeoutFn(() => {
        hooks.onGiveUp();
      }, forceWaitMs);
    }, graceMs);
  };

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    if (graceTimer !== undefined) {
      clearTimeoutFn(graceTimer);
    }
    if (forceTimer !== undefined) {
      clearTimeoutFn(forceTimer);
    }
    signal.removeEventListener("abort", begin);
  };

  if (signal.aborted) {
    begin();
  } else {
    signal.addEventListener("abort", begin, { once: true });
  }

  return dispose;
}
