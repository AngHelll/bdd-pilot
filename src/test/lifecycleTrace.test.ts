import * as assert from "assert";
import { describe, it, afterEach } from "node:test";
import { loadRunResults } from "../core/results/resultLoader";
import { startAbortKillWatchdog } from "../core/runner/processTree";
import {
  controllerIdOf,
  flushPresentation,
  isTraceEnabled,
  nextId,
  notePresentation,
  resetTraceState,
  startTraceSession,
  stopTraceSession,
  targetCensus,
  trace,
  trackController,
} from "../core/observability/lifecycleTrace";

afterEach(() => {
  resetTraceState();
});

function capture(): { lines: string[]; sink: (line: string) => void } {
  const lines: string[] = [];
  return {
    lines,
    sink: (line) => lines.push(line),
  };
}

function events(lines: string[]): Array<Record<string, unknown>> {
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("lifecycle trace disabled", () => {
  it("does not call the sink or advance sequence", () => {
    const captured = capture();
    trace("activate.start", { path: "/Users/hidden/Login.feature" });
    assert.strictEqual(isTraceEnabled(), false);
    assert.deepStrictEqual(captured.lines, []);
    startTraceSession(captured.sink);
    stopTraceSession();
    trace("activate.end");
    assert.deepStrictEqual(captured.lines, []);
  });

  it("keeps loadRunResults unchanged when a later session sink throws", () => {
    const off = loadRunResults("/workspace/missing", "/workspace/missing/none.trx");
    startTraceSession(() => {
      throw new Error("channel closed");
    });
    const on = loadRunResults("/workspace/missing", "/workspace/missing/none.trx");
    assert.strictEqual(off, undefined);
    assert.strictEqual(on, undefined);
  });
});

describe("lifecycle trace session", () => {
  it("emits monotonic sequence, elapsed time, and stable controller ids", () => {
    const captured = capture();
    const sessionId = startTraceSession(captured.sink);
    const first = new AbortController();
    const second = new AbortController();
    const firstId = trackController(first, { operationId: "r01", role: "run" });
    trackController(first, { operationId: "r01", role: "run" });
    const secondId = trackController(second, { role: "debug" });
    trace("run.lock.acquire", { operationId: "r01", source: "command", controllerId: firstId });
    trace("run.lock.release", {
      operationId: "r01",
      parentOperationId: "d01",
      controllerId: controllerIdOf(first),
    });

    const parsed = events(captured.lines);
    assert.strictEqual(sessionId, "s01");
    assert.deepStrictEqual(
      parsed.map((row) => row.sequence),
      [1, 2],
    );
    assert.ok(parsed.every((row) => row.sessionId === "s01"));
    assert.ok(parsed.every((row) => typeof row.elapsedMs === "number" && (row.elapsedMs as number) >= 0));
    assert.strictEqual(parsed[0].event, "run.lock.acquire");
    assert.strictEqual(parsed[0].operationId, "r01");
    assert.strictEqual(parsed[1].controllerId, firstId);
    assert.strictEqual(controllerIdOf(first), firstId);
    assert.notStrictEqual(firstId, secondId);
    assert.match(firstId, /^c\d{2}$/);
  });

  it("starts a new sequence for the next session and keeps controller identity", () => {
    const captured = capture();
    startTraceSession(captured.sink);
    const controller = new AbortController();
    const id = trackController(controller, { role: "run" });
    trace("run.requested");
    stopTraceSession();
    const second = startTraceSession(captured.sink);
    trace("activate.start", { controllerId: controllerIdOf(controller) });
    const parsed = events(captured.lines);
    assert.strictEqual(second, "s02");
    assert.strictEqual(parsed[0].sequence, 1);
    assert.strictEqual(parsed[1].sequence, 1);
    assert.strictEqual(parsed[1].sessionId, "s02");
    assert.strictEqual(parsed[1].controllerId, id);
  });

  it("aggregates presentation counters into one flush", () => {
    const captured = capture();
    startTraceSession(captured.sink);
    notePresentation("tree.data");
    notePresentation("tree.data");
    notePresentation("live.progress");
    flushPresentation({ cause: "timer" });
    flushPresentation();
    const parsed = events(captured.lines);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].event, "presentation.flush");
    assert.deepStrictEqual(parsed[0].counts, { "tree.data": 2, "live.progress": 1 });
    assert.strictEqual(parsed[0].cause, "timer");
  });
});

describe("lifecycle trace sanitization", () => {
  it("drops sensitive keys and replaces absolute paths and long strings", () => {
    const captured = capture();
    startTraceSession(captured.sink);
    trace("results.loaded", {
      artifact: "/Users/ada/repo/TestResults/bdd-pilot-1.trx",
      token: "should-not-appear",
      filter: "FullyQualifiedName~Secret",
      note: "ok",
      blob: "x".repeat(400),
      nested: { commandLine: "dotnet test --filter Name" },
    });
    const row = events(captured.lines)[0];
    assert.strictEqual(row.artifact, "bdd-pilot-1.trx");
    assert.strictEqual(row.note, "ok");
    assert.strictEqual(row.blob, "[len:400]");
    assert.strictEqual("token" in row, false);
    assert.strictEqual("filter" in row, false);
    assert.deepStrictEqual(row.nested, {});
  });

  it("keeps a relative path and a target census", () => {
    const captured = capture();
    startTraceSession(captured.sink);
    trace("run.targets", {
      file: "Features/Login.feature",
      ...targetCensus([{ kind: "scenario" }, { kind: "scenario" }, { kind: "feature" }]),
    });
    const row = events(captured.lines)[0];
    assert.strictEqual(row.file, "Features/Login.feature");
    assert.strictEqual(row.count, 3);
    assert.strictEqual(row.kinds, "scenario:2,feature:1");
  });
});

describe("lifecycle trace cost", () => {
  it("records disabled and enabled cost without a pass/fail threshold", () => {
    const iterations = 20000;
    const disabledStarted = performance.now();
    for (let i = 0; i < iterations; i++) {
      trace("hot.path", { i });
    }
    const disabledMs = performance.now() - disabledStarted;

    let writes = 0;
    startTraceSession(() => {
      writes += 1;
    });
    const enabledStarted = performance.now();
    for (let i = 0; i < iterations; i++) {
      trace("hot.path", { i });
    }
    const enabledMs = performance.now() - enabledStarted;

    assert.strictEqual(writes, iterations);
    assert.ok(disabledMs >= 0);
    assert.ok(enabledMs >= 0);
    console.info(
      `lifecycle-trace cost iterations=${iterations} disabledMs=${disabledMs.toFixed(2)} enabledMs=${enabledMs.toFixed(2)}`,
    );
  });
});

describe("lifecycle trace failures", () => {
  it("swallows sink errors", () => {
    startTraceSession(() => {
      throw new Error("append failed");
    });
    assert.doesNotThrow(() => trace("activate.end", { operationId: nextId("d") }));
  });

  it("does not change process-tree cancellation when the sink throws", () => {
    startTraceSession(() => {
      throw new Error("append failed");
    });
    const phases: string[] = [];
    const controller = new AbortController();
    const signal = controller.signal;
    controller.abort();
    assert.doesNotThrow(() => {
      startAbortKillWatchdog(
        () => 4242,
        signal,
        { onForce() {}, onGiveUp() {} },
        {
          platform: "linux",
          graceMs: 0,
          forceWaitMs: 0,
          execute: (plan) => phases.push(plan.kind),
          setTimeoutFn: ((fn: () => void) => {
            fn();
            return 0 as unknown as ReturnType<typeof setTimeout>;
          }) as typeof setTimeout,
          clearTimeoutFn: () => undefined,
        },
      );
    });
    assert.ok(phases.length >= 1);
    assert.strictEqual(phases[0], "posix-group");
  });
});
