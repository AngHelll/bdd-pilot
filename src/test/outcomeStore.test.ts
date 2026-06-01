import * as assert from "assert";
import { describe, it } from "node:test";
import { OutcomeStore } from "../providers/outcomeStore";
import { collectOutcomeKeysForTargets } from "../core/runner/runScope";
import { DomainGroup } from "../core/gherkin/model";

describe("OutcomeStore", () => {
  const domains: DomainGroup[] = [
    {
      name: "General",
      features: [
        {
          name: "Sample",
          filePath: "/x/Sample.feature",
          tags: [],
          scenarios: [
            { name: "One", tags: [], line: 2, isOutline: false },
            {
              name: "Many",
              tags: [],
              line: 5,
              isOutline: true,
              examples: [
                { rowIndex: 0, line: 8, headers: ["x"], values: ["a"], label: "x=a" },
                { rowIndex: 1, line: 9, headers: ["x"], values: ["b"], label: "x=b" },
              ],
            },
          ],
        },
      ],
    },
  ];

  it("clears only in-scope keys for partial runs", () => {
    const store = new OutcomeStore();
    store.set("/x/Sample.feature::2::One", "passed");
    store.set("/x/Sample.feature::5::Many::row0", "failed", undefined, "assertion failed");
    store.set("/x/Sample.feature::5::Many::row1", "passed");

    store.clearForRunScope(
      [{ kind: "scenario", feature: domains[0].features[0], scenario: domains[0].features[0].scenarios[0] }],
      domains,
    );

    assert.strictEqual(store.get("/x/Sample.feature::2::One"), undefined);
    assert.strictEqual(store.get("/x/Sample.feature::5::Many::row0"), "failed");
    assert.strictEqual(store.getErrorMessage("/x/Sample.feature::5::Many::row0"), "assertion failed");
    assert.strictEqual(store.get("/x/Sample.feature::5::Many::row1"), "passed");
  });

  it("stores sanitized error messages and clears on clearAll", () => {
    const store = new OutcomeStore();
    store.set("k", "failed", 100, "password=secret");
    assert.match(store.getErrorMessage("k")!, /REDACTED/);
    store.clearAll();
    assert.strictEqual(store.getErrorMessage("k"), undefined);
  });

  it("collectOutcomeKeysForTargets matches store keys", () => {
    const keys = collectOutcomeKeysForTargets(
      [{ kind: "scenario", feature: domains[0].features[0], scenario: domains[0].features[0].scenarios[1] }],
      domains,
    );
    assert.ok(keys instanceof Set);
    assert.strictEqual(keys.size, 2);
  });
});
