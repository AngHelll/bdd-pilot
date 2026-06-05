import * as assert from "assert";
import { describe, it } from "node:test";
import { classifyRunCompletion } from "../core/diagnostics/runOutcomeClass";

describe("classifyRunCompletion", () => {
  it("returns canceled when run was aborted", () => {
    assert.strictEqual(
      classifyRunCompletion({ exitCode: null, canceled: true, outputBuffer: "" }),
      "canceled",
    );
  });

  it("returns test_failures when summary has failed results", () => {
    assert.strictEqual(
      classifyRunCompletion({
        exitCode: 1,
        canceled: false,
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          source: "trx",
          results: [{ testName: "A", outcome: "failed" }],
        },
        outputBuffer: "Failed!  - Failed: 1, Passed: 0, Skipped: 0, Total: 1",
      }),
      "test_failures",
    );
  });

  it("returns success for clean run with summary", () => {
    assert.strictEqual(
      classifyRunCompletion({
        exitCode: 0,
        canceled: false,
        summary: {
          total: 2,
          passed: 2,
          failed: 0,
          skipped: 0,
          source: "trx",
          results: [
            { testName: "A", outcome: "passed" },
            { testName: "B", outcome: "passed" },
          ],
        },
        outputBuffer: "Test run for Tests.dll",
      }),
      "success",
    );
  });

  it("returns infra when dotnet missing and no tests executed", () => {
    assert.strictEqual(
      classifyRunCompletion({
        exitCode: 1,
        canceled: false,
        outputBuffer: "command not found: dotnet",
      }),
      "infra",
    );
  });

  it("returns no_results when no summary and no execution markers", () => {
    assert.strictEqual(
      classifyRunCompletion({
        exitCode: 0,
        canceled: false,
        outputBuffer: "",
      }),
      "no_results",
    );
  });
});
