import * as assert from "assert";
import { describe, it } from "node:test";
import { parseCucumberJson } from "../core/results/cucumberParser";

describe("cucumberParser", () => {
  it("parses feature scenarios and outcomes", () => {
    const json = JSON.stringify([
      {
        name: "Login",
        elements: [
          {
            type: "scenario",
            name: "Valid login",
            steps: [
              { result: { status: "passed", duration: 1_500_000_000 } },
              { result: { status: "passed" } },
            ],
          },
          {
            keyword: "Scenario",
            name: "Invalid login",
            steps: [{ result: { status: "failed", error_message: "401 Unauthorized" } }],
          },
        ],
      },
    ]);

    const summary = parseCucumberJson(json);
    assert.strictEqual(summary.total, 2);
    assert.strictEqual(summary.passed, 1);
    assert.strictEqual(summary.failed, 1);
    assert.strictEqual(summary.results[0].durationMs, 1500);
    assert.match(summary.results[1].errorMessage ?? "", /401/);
  });
});
