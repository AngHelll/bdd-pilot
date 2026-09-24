import * as assert from "assert";
import { describe, it } from "node:test";
import {
  ABORT_KILL_FORCE_WAIT_MS,
  ABORT_KILL_GRACE_MS,
  DEBUG_TERMINATE_GRACE_MS,
  buildProcessTreeKillPlan,
  formatRunCanceledLine,
  isCanceledOnClose,
  isKillablePid,
  resolveCancelIntent,
  shouldDetachForProcessGroup,
  startAbortKillWatchdog,
  type ProcessTreeKillPlan,
} from "../core/runner/processTree";

describe("buildProcessTreeKillPlan", () => {
  it("skips pid 0, negative, and undefined", () => {
    assert.deepStrictEqual(buildProcessTreeKillPlan("darwin", undefined, "term"), { kind: "skip" });
    assert.deepStrictEqual(buildProcessTreeKillPlan("darwin", 0, "term"), { kind: "skip" });
    assert.deepStrictEqual(buildProcessTreeKillPlan("win32", -1, "kill"), { kind: "skip" });
    assert.strictEqual(isKillablePid(undefined), false);
    assert.strictEqual(isKillablePid(0), false);
    assert.strictEqual(isKillablePid(42), true);
  });

  it("posix term uses negative pid and SIGTERM", () => {
    const plan = buildProcessTreeKillPlan("darwin", 4242, "term");
    assert.deepStrictEqual(plan, {
      kind: "posix-group",
      targetPid: -4242,
      signal: "SIGTERM",
    });
  });

  it("posix kill uses SIGKILL", () => {
    const plan = buildProcessTreeKillPlan("linux", 9, "kill");
    assert.deepStrictEqual(plan, {
      kind: "posix-group",
      targetPid: -9,
      signal: "SIGKILL",
    });
  });

  it("win32 term is taskkill /T without /F", () => {
    const plan = buildProcessTreeKillPlan("win32", 100, "term");
    assert.deepStrictEqual(plan, {
      kind: "win-taskkill",
      args: ["/PID", "100", "/T"],
    });
  });

  it("win32 kill adds /F", () => {
    const plan = buildProcessTreeKillPlan("win32", 100, "kill");
    assert.deepStrictEqual(plan, {
      kind: "win-taskkill",
      args: ["/PID", "100", "/T", "/F"],
    });
  });
});

describe("shouldDetachForProcessGroup", () => {
  it("detaches on posix, not on Windows", () => {
    assert.strictEqual(shouldDetachForProcessGroup("darwin"), true);
    assert.strictEqual(shouldDetachForProcessGroup("linux"), true);
    assert.strictEqual(shouldDetachForProcessGroup("win32"), false);
  });
});

describe("isCanceledOnClose", () => {
  it("treats close after abort as canceled", () => {
    assert.strictEqual(isCanceledOnClose(true), true);
    assert.strictEqual(isCanceledOnClose(false), false);
  });
});

describe("formatRunCanceledLine", () => {
  it("distinguishes clean vs forced", () => {
    assert.strictEqual(formatRunCanceledLine({ forced: false }), "[bdd-pilot] Run canceled.");
    assert.strictEqual(formatRunCanceledLine({ forced: true }), "[bdd-pilot] Run canceled (forced).");
  });
});

describe("resolveCancelIntent", () => {
  it("prefers abort when a run lock is held", () => {
    assert.strictEqual(resolveCancelIntent({ hasActiveRun: true, debugActive: false }), "abort");
    assert.strictEqual(resolveCancelIntent({ hasActiveRun: true, debugActive: true }), "abort");
  });

  it("force-unlocks when the run was already aborted", () => {
    assert.strictEqual(
      resolveCancelIntent({ hasActiveRun: true, runAlreadyAborted: true, debugActive: false }),
      "forceUnlock",
    );
  });

  it("stops debug when only a debug session is busy", () => {
    assert.strictEqual(resolveCancelIntent({ hasActiveRun: false, debugActive: true }), "stopDebug");
  });

  it("is none when idle", () => {
    assert.strictEqual(resolveCancelIntent({ hasActiveRun: false, debugActive: false }), "none");
  });
});

describe("abort kill constants", () => {
  it("exposes grace budgets from the spec", () => {
    assert.strictEqual(ABORT_KILL_GRACE_MS, 3000);
    assert.strictEqual(ABORT_KILL_FORCE_WAIT_MS, 1000);
    assert.strictEqual(DEBUG_TERMINATE_GRACE_MS, 5000);
  });
});

describe("startAbortKillWatchdog", () => {
  it("runs term → force kill → giveUp on already-aborted signal", () => {
    const controller = new AbortController();
    controller.abort();
    const planned: ProcessTreeKillPlan[] = [];
    const delayed: Array<{ ms: number; fn: () => void }> = [];
    let forced = 0;
    let gaveUp = 0;

    startAbortKillWatchdog(
      () => 4242,
      controller.signal,
      {
        onForce: () => {
          forced += 1;
        },
        onGiveUp: () => {
          gaveUp += 1;
        },
      },
      {
        platform: "darwin",
        execute: (plan) => planned.push(plan),
        setTimeoutFn: ((fn: () => void, ms: number) => {
          delayed.push({ ms, fn });
          return delayed.length as unknown as NodeJS.Timeout;
        }) as typeof setTimeout,
        clearTimeoutFn: (() => undefined) as typeof clearTimeout,
      },
    );

    assert.deepStrictEqual(planned[0], {
      kind: "posix-group",
      targetPid: -4242,
      signal: "SIGTERM",
    });
    assert.strictEqual(forced, 0);
    assert.strictEqual(delayed[0]?.ms, ABORT_KILL_GRACE_MS);

    delayed[0].fn();
    assert.strictEqual(forced, 1);
    assert.deepStrictEqual(planned[1], {
      kind: "posix-group",
      targetPid: -4242,
      signal: "SIGKILL",
    });
    assert.strictEqual(delayed[1]?.ms, ABORT_KILL_FORCE_WAIT_MS);

    delayed[1].fn();
    assert.strictEqual(gaveUp, 1);
  });

  it("gives up immediately when pid is missing (K1.5)", () => {
    const controller = new AbortController();
    controller.abort();
    const planned: ProcessTreeKillPlan[] = [];
    let forced = 0;
    let gaveUp = 0;

    startAbortKillWatchdog(
      () => undefined,
      controller.signal,
      {
        onForce: () => {
          forced += 1;
        },
        onGiveUp: () => {
          gaveUp += 1;
        },
      },
      {
        platform: "linux",
        execute: (plan) => planned.push(plan),
      },
    );

    assert.deepStrictEqual(planned, []);
    assert.strictEqual(forced, 1);
    assert.strictEqual(gaveUp, 1);
  });

  it("second abort is a no-op after kill started", () => {
    const controller = new AbortController();
    const planned: ProcessTreeKillPlan[] = [];
    startAbortKillWatchdog(
      () => 7,
      controller.signal,
      { onForce: () => undefined, onGiveUp: () => undefined },
      {
        platform: "win32",
        execute: (plan) => planned.push(plan),
        setTimeoutFn: ((fn: () => void) => {
          fn();
          return 1 as unknown as NodeJS.Timeout;
        }) as typeof setTimeout,
        clearTimeoutFn: (() => undefined) as typeof clearTimeout,
      },
    );
    controller.abort();
    const afterFirst = planned.length;
    controller.abort();
    assert.ok(afterFirst >= 1);
    assert.strictEqual(planned.length, afterFirst);
  });
});
