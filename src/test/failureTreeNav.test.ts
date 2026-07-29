import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup } from "../core/gherkin/model";
import {
  containerKeysToExpandForFailures,
  findFirstFailedLeaf,
  isAutoShowOutputMode,
  shouldAutoShowOutput,
} from "../core/results/failureTreeNav";
import { outlineRowKey, scenarioKey } from "../core/runner/runScope";
import { TestOutcome } from "../core/results/trxParser";

const domains: DomainGroup[] = [
  {
    name: "A",
    features: [
      {
        name: "First",
        filePath: "/x/First.feature",
        tags: [],
        scenarios: [
          { name: "Ok", tags: [], line: 2, isOutline: false },
          {
            name: "Outline",
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
  {
    name: "B",
    features: [
      {
        name: "Second",
        filePath: "/x/Second.feature",
        tags: [],
        scenarios: [{ name: "Boom", tags: [], line: 3, isOutline: false }],
      },
    ],
  },
];

function store(map: Record<string, TestOutcome>) {
  return {
    get(key: string): TestOutcome | undefined {
      return map[key];
    },
  };
}

describe("failureTreeNav", () => {
  it("findFirstFailedLeaf returns undefined when empty", () => {
    assert.strictEqual(findFirstFailedLeaf(domains, store({})), undefined);
  });

  it("findFirstFailedLeaf prefers earlier domain/feature over later", () => {
    const feature = domains[0].features[0];
    const outline = feature.scenarios[1];
    const second = domains[1].features[0].scenarios[0];
    const leaf = findFirstFailedLeaf(
      domains,
      store({
        [scenarioKey(domains[1].features[0], second)]: "failed",
        [outlineRowKey(feature, outline, 1)]: "failed",
        [scenarioKey(feature, feature.scenarios[0])]: "passed",
      }),
    );
    assert.ok(leaf);
    assert.strictEqual(leaf!.label, "Outline · x=b");
    assert.strictEqual(leaf!.outlineRowIndex, 1);
  });

  it("findFirstFailedLeaf uses simple scenario before later domains", () => {
    const boom = domains[1].features[0].scenarios[0];
    const leaf = findFirstFailedLeaf(
      domains,
      store({ [scenarioKey(domains[1].features[0], boom)]: "failed" }),
    );
    assert.strictEqual(leaf?.label, "Boom");
    assert.strictEqual(leaf?.featurePath, "/x/Second.feature");
  });

  it("containerKeysToExpandForFailures includes ancestors of failed leaves", () => {
    const feature = domains[0].features[0];
    const outline = feature.scenarios[1];
    const keys = containerKeysToExpandForFailures(
      domains,
      store({ [outlineRowKey(feature, outline, 0)]: "failed" }),
    );
    assert.deepStrictEqual(
      keys.map((k) => `${k.kind}:${k.id}`),
      [
        "domain:A",
        "feature:/x/First.feature",
        `scenarioOutline:${scenarioKey(feature, outline)}`,
      ],
    );
  });

  it("containerKeysToExpandForFailures empty without failures", () => {
    assert.strictEqual(containerKeysToExpandForFailures(domains, store({})).length, 0);
  });

  it("shouldAutoShowOutput respects modes", () => {
    assert.strictEqual(shouldAutoShowOutput("off", { exitCode: 1, failed: 2 }), false);
    assert.strictEqual(shouldAutoShowOutput("always", { exitCode: 0, failed: 0 }), true);
    assert.strictEqual(shouldAutoShowOutput("onFailure", { exitCode: 0, failed: 1 }), true);
    assert.strictEqual(shouldAutoShowOutput("onFailure", { exitCode: 1, failed: 0 }), true);
    assert.strictEqual(shouldAutoShowOutput("onFailure", { exitCode: 0, failed: 0 }), false);
  });

  it("isAutoShowOutputMode validates", () => {
    assert.strictEqual(isAutoShowOutputMode("off"), true);
    assert.strictEqual(isAutoShowOutputMode("onFailure"), true);
    assert.strictEqual(isAutoShowOutputMode("always"), true);
    assert.strictEqual(isAutoShowOutputMode("raw"), false);
  });
});
