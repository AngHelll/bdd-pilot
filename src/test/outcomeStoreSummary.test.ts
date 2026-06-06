import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup } from "../core/gherkin/model";
import { OutcomeReader } from "../core/gherkin/testExplorerLabels";
import { summarizeOutcomeStore } from "../core/results/outcomeStoreSummary";
import { outlineRowKey, scenarioKey } from "../core/runner/runScope";
import { TestOutcome } from "../core/results/trxParser";

class MemoryStore implements OutcomeReader {
  private map = new Map<string, TestOutcome>();

  set(key: string, outcome: TestOutcome): void {
    this.map.set(key, outcome);
  }

  get(key: string): TestOutcome | undefined {
    return this.map.get(key);
  }

  getDuration(): number | undefined {
    return undefined;
  }
}

const domain: DomainGroup = {
  name: "Trading",
  features: [
    {
      name: "Buy",
      filePath: "/proj/Features/Trading/Buy.feature",
      tags: [],
      scenarios: [
        { name: "Happy path", tags: [], line: 5, isOutline: false },
        {
          name: "Outline",
          tags: [],
          line: 10,
          isOutline: true,
          examples: [{ rowIndex: 0, line: 12, headers: ["id"], values: ["1"], label: "id=1" }],
        },
      ],
    },
  ],
};

describe("summarizeOutcomeStore", () => {
  it("returns undefined when store has no mapped outcomes", () => {
    const store = new MemoryStore();
    assert.strictEqual(summarizeOutcomeStore(store, [domain]), undefined);
  });

  it("aggregates leaf outcomes across domains", () => {
    const store = new MemoryStore();
    const feature = domain.features[0]!;
    const scenario = feature.scenarios[0]!;
    store.set(scenarioKey(feature, scenario), "passed");
    const outline = feature.scenarios[1]!;
    store.set(outlineRowKey(feature, outline, 0), "failed");

    const rollup = summarizeOutcomeStore(store, [domain]);
    assert.deepStrictEqual(rollup, { passed: 1, failed: 1, skipped: 0, withResults: 2 });
  });
});
