import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup } from "../core/gherkin/model";
import { OutcomeStore } from "../providers/outcomeStore";
import {
  resolveFirstStoreFailureSnippet,
  storeHasFailures,
} from "../core/results/storeFailureFeedback";
import { outlineRowKey, scenarioKey } from "../core/runner/runScope";

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

describe("storeFailureFeedback", () => {
  it("returns first failed error snippet in tree order", () => {
    const store = new OutcomeStore();
    const feature = domains[0].features[0];
    const outline = feature.scenarios[1];
    store.set(scenarioKey(feature, feature.scenarios[0]), "passed");
    store.set(
      outlineRowKey(feature, outline, 1),
      "failed",
      5,
      "Expected true but was false",
    );

    const snippet = resolveFirstStoreFailureSnippet(store, domains);
    assert.ok(snippet);
    assert.ok(snippet!.includes("true"));
    assert.strictEqual(storeHasFailures(store, domains), true);
  });

  it("returns undefined when no failures", () => {
    const store = new OutcomeStore();
    const feature = domains[0].features[0];
    store.set(scenarioKey(feature, feature.scenarios[0]), "passed");
    assert.strictEqual(resolveFirstStoreFailureSnippet(store, domains), undefined);
    assert.strictEqual(storeHasFailures(store, domains), false);
  });
});
