import * as assert from "assert";
import { describe, it } from "node:test";
import {
  LiveProgressParser,
  LiveProgressState,
  PROGRESS_QUIET_AFTER_MS,
  formatProgressMessage,
  parseResultLine,
} from "../core/runner/liveProgress";

function progressState(overrides: Partial<LiveProgressState> = {}): LiveProgressState {
  return {
    passed: 0,
    failed: 0,
    skipped: 0,
    completed: 0,
    ...overrides,
  };
}

describe("liveProgress", () => {
  it("parses an MTP failed line with a duration", () => {
    const event = parseResultLine("failed System is ready (24ms)");
    assert.ok(event);
    assert.strictEqual(event.outcome, "failed");
    assert.strictEqual(event.testName, "System is ready");
  });

  it("parses an MTP passed line and drops the duration", () => {
    const event = parseResultLine(
      'passed Add two numbers(first: "1", second: "2", result: "3", __pickleIndex: "1", exampleTags: []) (7ms)',
    );
    assert.ok(event);
    assert.strictEqual(event.outcome, "passed");
    assert.strictEqual(
      event.testName,
      'Add two numbers(first: "1", second: "2", result: "3", __pickleIndex: "1", exampleTags: [])',
    );
  });

  it("parses an MTP skipped line without a duration", () => {
    const event = parseResultLine("skipped Store is available");
    assert.ok(event);
    assert.strictEqual(event.outcome, "skipped");
    assert.strictEqual(event.testName, "Store is available");
  });

  it("parses an xUnit v3 VSTest failure line", () => {
    const line = "[xUnit.net 00:00:00.80]     System is ready [FAIL]";
    const event = parseResultLine(line);
    assert.ok(event);
    assert.strictEqual(event.outcome, "failed");
    assert.strictEqual(event.testName, "System is ready");
  });

  it("parses an xUnit v3 VSTest skip line", () => {
    const line = "[xUnit.net 00:00:00.68]     Store is available [SKIP]";
    const event = parseResultLine(line);
    assert.ok(event);
    assert.strictEqual(event.outcome, "skipped");
    assert.strictEqual(event.testName, "Store is available");
  });

  it("counts an xUnit v3 failure once when the adapter also prints an indented Failed line", () => {
    const parser = new LiveProgressParser(1);
    const events = parser.feed(
      "[xUnit.net 00:00:00.80]     System is ready [FAIL]\n  Failed System is ready [9 ms]\n",
    );
    assert.strictEqual(events.length, 1);
    assert.strictEqual(parser.getState().failed, 1);
    assert.strictEqual(parser.getState().lastFailedTestName, "System is ready");
  });

  it("counts an xUnit v3 skip once when the adapter also prints an indented Skipped line", () => {
    const parser = new LiveProgressParser(1);
    const events = parser.feed(
      "[xUnit.net 00:00:00.68]     Store is available [SKIP]\n  Skipped Store is available [1 ms]\n",
    );
    assert.strictEqual(events.length, 1);
    assert.strictEqual(parser.getState().skipped, 1);
  });

  it("parses xUnit result lines", () => {
    const line =
      "[xUnit.net 00:00:02.50]     Passed LoginFeature.SuccessfullyAuthenticateAndReceiveValidToken [1 s]";
    const event = parseResultLine(line);
    assert.ok(event);
    assert.strictEqual(event.outcome, "passed");
    assert.match(event.testName, /LoginFeature/);
  });

  it("parses plain Passed lines", () => {
    const event = parseResultLine("  Passed TradingBuyingPowerFeature.RejectInvalidGUIDValuesInPathParameters [42 ms]");
    assert.strictEqual(event?.outcome, "passed");
  });

  it("aggregates events from chunks", () => {
    const parser = new LiveProgressParser(3);
    const events = parser.feed(
      "[xUnit.net]     Passed A.Test1 [1 ms]\n[xUnit.net]     Failed A.Test2 [2 ms]\n",
    );
    assert.strictEqual(events.length, 2);
    const state = parser.getState();
    assert.strictEqual(state.passed, 1);
    assert.strictEqual(state.failed, 1);
    assert.strictEqual(state.completed, 2);
    assert.strictEqual(formatProgressMessage(state), "! 1 failed — 2/3 · 1 passed · 1 failed · Test2");
    assert.match(state.lastFailedTestName ?? "", /Test2$/);
  });

  it("keeps the last failure name after a later pass", () => {
    const parser = new LiveProgressParser(3);
    parser.feed(
      "[xUnit.net]     Failed A.Test2 [2 ms]\n[xUnit.net]     Passed A.Test3 [1 ms]\n",
    );
    const state = parser.getState();
    assert.match(state.lastTestName ?? "", /Test3$/);
    assert.strictEqual(
      formatProgressMessage(state),
      "! 1 failed — 2/3 · 1 passed · 1 failed · Test2",
    );
  });

  it("omits the test name when every result passed", () => {
    const parser = new LiveProgressParser(2);
    parser.feed("[xUnit.net]     Passed A.Test1 [1 ms]\n");
    assert.strictEqual(formatProgressMessage(parser.getState()), "1/2 · 1 passed");
  });

  it("formatProgressMessage prefixes failures in Spanish", () => {
    const parser = new LiveProgressParser(3);
    parser.feed("[xUnit.net]     Passed A.Test1 [1 ms]\n[xUnit.net]     Failed A.Test2 [2 ms]\n");
    const state = parser.getState();
    assert.strictEqual(
      formatProgressMessage(state, "es"),
      "! 1 fallidos — 2/3 · 1 correctos · 1 fallidos · Test2",
    );
  });

  it("truncates a failure name longer than 48 characters", () => {
    const segment = "n".repeat(49);
    const message = formatProgressMessage(
      progressState({
        failed: 1,
        completed: 1,
        totalExpected: 2,
        lastFailedTestName: `Feature.${segment}`,
      }),
    );
    assert.ok(message.endsWith(` · ${"n".repeat(47)}…`));
    assert.ok(!message.includes(segment));
  });

  it("drops a failure name whose last segment is empty", () => {
    assert.strictEqual(
      formatProgressMessage(
        progressState({
          failed: 1,
          completed: 1,
          totalExpected: 2,
          lastFailedTestName: "Feature.",
        }),
      ),
      "! 1 failed — 1/2 · 1 failed",
    );
  });

  it("does not prefix waiting below the quiet threshold", () => {
    const message = formatProgressMessage(
      progressState({
        passed: 1,
        completed: 1,
        totalExpected: 4,
        quietMs: PROGRESS_QUIET_AFTER_MS - 1,
        lastTestName: "A.Test1",
      }),
    );
    assert.strictEqual(message, "1/4 · 1 passed");
  });

  it("prefixes waiting with the last finished name when results go quiet", () => {
    const message = formatProgressMessage(
      progressState({
        passed: 2,
        completed: 2,
        totalExpected: 4,
        quietMs: PROGRESS_QUIET_AFTER_MS,
        lastTestName: "A.Test2",
      }),
    );
    assert.strictEqual(message, "waiting — 2/4 · 2 passed · Test2");
  });

  it("prefixes waiting in Spanish and keeps only the failure name", () => {
    const message = formatProgressMessage(
      progressState({
        passed: 1,
        failed: 1,
        completed: 2,
        totalExpected: 4,
        quietMs: PROGRESS_QUIET_AFTER_MS,
        lastTestName: "A.Test3",
        lastFailedTestName: "A.Test2",
      }),
      "es",
    );
    assert.strictEqual(
      message,
      "en espera — ! 1 fallidos — 2/4 · 1 correctos · 1 fallidos · Test2",
    );
  });

  it("does not say waiting before the first result or after the expected total", () => {
    assert.strictEqual(
      formatProgressMessage(
        progressState({ totalExpected: 12, quietMs: PROGRESS_QUIET_AFTER_MS }),
      ),
      "0/12",
    );
    assert.strictEqual(
      formatProgressMessage(
        progressState({
          passed: 3,
          completed: 3,
          totalExpected: 3,
          quietMs: PROGRESS_QUIET_AFTER_MS + 5_000,
          lastTestName: "A.Test3",
        }),
      ),
      "3/3 · 3 passed",
    );
  });

  it("formatProgressMessage shows 0/N when total expected is set", () => {
    assert.strictEqual(formatProgressMessage(new LiveProgressParser(12).getState()), "0/12");
  });

  it("formatProgressMessage shows localized starting text", () => {
    assert.strictEqual(formatProgressMessage(new LiveProgressParser().getState(), "es"), "Iniciando…");
  });

  it("handles split lines across chunks", () => {
    const parser = new LiveProgressParser();
    parser.feed("[xUnit.net]     Passe");
    const events = parser.feed("d MyFeature.Test [1 ms]\n");
    assert.strictEqual(events.length, 1);
    assert.strictEqual(parser.getState().passed, 1);
  });
});
