import * as assert from "assert";
import { describe, it } from "node:test";
import { evaluateBindingGate } from "../core/bindings/evaluateBindingGate";
import { StepLocation } from "../core/gherkin/stepLocations";

const loc: StepLocation = {
  featurePath: "/x/a.feature",
  line0: 10,
  scenarioName: "S1",
  stepText: "When step",
};

describe("evaluateBindingGate", () => {
  it("collects unbound and ambiguous issues separately", () => {
    const locations: StepLocation[] = [
      loc,
      { ...loc, line0: 11, stepText: "Then ambiguous" },
      { ...loc, line0: 12, stepText: "Then bound" },
    ];

    const result = evaluateBindingGate(locations, (_path, line0) => {
      if (line0 === 10) {
        return { featurePath: "/x/a.feature", line: 10, stepText: "When step", status: "unbound" };
      }
      if (line0 === 11) {
        return {
          featurePath: "/x/a.feature",
          line: 11,
          stepText: "Then ambiguous",
          status: "ambiguous",
          candidateCount: 2,
        };
      }
      return { featurePath: "/x/a.feature", line: 12, stepText: "Then bound", status: "bound" };
    });

    assert.strictEqual(result.unboundIssues.length, 1);
    assert.strictEqual(result.ambiguousIssues.length, 1);
    assert.strictEqual(result.unboundIssues[0].status, "unbound");
    assert.strictEqual(result.ambiguousIssues[0].candidateCount, 2);
  });

  it("ignores null, bound, invalid dto, and resolver throws", () => {
    const result = evaluateBindingGate(
      [
        loc,
        { ...loc, line0: 11 },
        { ...loc, line0: 12 },
        { ...loc, line0: 13 },
      ],
      (_path, line0) => {
        if (line0 === 10) {
          return null;
        }
        if (line0 === 11) {
          return { status: "bound", featurePath: "", line: 11, stepText: "x" };
        }
        if (line0 === 12) {
          return { not: "dto" };
        }
        throw new Error("boom");
      },
    );

    assert.strictEqual(result.unboundIssues.length, 0);
    assert.strictEqual(result.ambiguousIssues.length, 0);
  });

  it("returns empty arrays when no locations", () => {
    const result = evaluateBindingGate([], () => null);
    assert.deepStrictEqual(result.unboundIssues, []);
    assert.deepStrictEqual(result.ambiguousIssues, []);
  });
});
