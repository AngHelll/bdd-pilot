import * as assert from "assert";
import { describe, it } from "node:test";
import {
  appendTrxLoggerArgs,
  createDebugTrxFileName,
  resolveTrxPath,
} from "../core/runner/trxArgs";

describe("trxArgs", () => {
  it("appendTrxLoggerArgs adds logger and results directory", () => {
    const args: string[] = ["test"];
    appendTrxLoggerArgs(args, "bdd-pilot-debug-1.trx");
    assert.ok(args.includes("--logger"));
    assert.ok(args.some((a) => a.startsWith("trx;LogFileName=bdd-pilot-debug-1.trx")));
    assert.ok(args.includes("TestResults"));
  });

  it("createDebugTrxFileName uses debug prefix", () => {
    assert.match(createDebugTrxFileName(), /^bdd-pilot-debug-\d+\.trx$/);
  });

  it("resolveTrxPath joins project dir and results dir", () => {
    assert.strictEqual(
      resolveTrxPath("/proj", "TestResults", "run.trx"),
      "/proj/TestResults/run.trx",
    );
  });
});
