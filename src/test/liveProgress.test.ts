import * as assert from "assert";
import { describe, it } from "node:test";
import {
  LiveProgressParser,
  formatProgressMessage,
  parseResultLine,
} from "../core/runner/liveProgress";

describe("liveProgress", () => {
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
    assert.strictEqual(formatProgressMessage(state), "2/3 · 1 passed, 1 failed");
  });

  it("handles split lines across chunks", () => {
    const parser = new LiveProgressParser();
    parser.feed("[xUnit.net]     Passe");
    const events = parser.feed("d MyFeature.Test [1 ms]\n");
    assert.strictEqual(events.length, 1);
    assert.strictEqual(parser.getState().passed, 1);
  });
});
