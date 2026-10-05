import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildAttachDebugConfig,
  DEBUG_HOST_ENV,
  parseTesthostPids,
} from "../core/runner/debugAttach";
import { buildEnv } from "../core/runner/dotnetTest";

const HOST_LINES =
  "Host debugging is enabled. Please attach debugger to testhost process to continue.\n" +
  "Process Id: 4242, Name: testhost\n";

describe("debugAttach", () => {
  it("parses the testhost PID from a complete line", () => {
    assert.deepStrictEqual(parseTesthostPids(HOST_LINES), { pids: [4242], carry: "" });
  });

  it("accepts Name: dotnet (framework-dependent testhost)", () => {
    assert.deepStrictEqual(parseTesthostPids("Process Id: 77, Name: dotnet\n").pids, [77]);
  });

  it("joins a PID line split across chunks via carry", () => {
    const first = parseTesthostPids("Build succeeded.\nProcess Id: 12");
    assert.deepStrictEqual(first.pids, []);
    assert.strictEqual(first.carry, "Process Id: 12");
    const second = parseTesthostPids("34, Name: testhost\r\nStarting test execution\n", first.carry);
    assert.deepStrictEqual(second, { pids: [1234], carry: "" });
  });

  it("returns every PID when several testhosts wait (multi-project sln)", () => {
    const out = "Process Id: 10, Name: testhost\nnoise\nProcess Id: 11, Name: testhost\n";
    assert.deepStrictEqual(parseTesthostPids(out).pids, [10, 11]);
  });

  it("ignores output without a PID line and keeps an unterminated tail", () => {
    assert.deepStrictEqual(parseTesthostPids("Passed Smoke [12 ms]\nRestoring"), {
      pids: [],
      carry: "Restoring",
    });
  });

  it("builds a coreclr attach config", () => {
    assert.deepStrictEqual(buildAttachDebugConfig("BDD Pilot Debug", 4242), {
      type: "coreclr",
      request: "attach",
      name: "BDD Pilot Debug",
      processId: 4242,
    });
  });

  it("debug env enables host wait without initial break and STAGE still wins", () => {
    const env = buildEnv({}, "test", { ...DEBUG_HOST_ENV, STAGE: "prod" });
    assert.strictEqual(env.VSTEST_HOST_DEBUG, "1");
    assert.strictEqual(env.VSTEST_DEBUG_NOBP, "1");
    assert.strictEqual(env.STAGE, "test");
  });
});
