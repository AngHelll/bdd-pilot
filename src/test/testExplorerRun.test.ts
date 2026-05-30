import * as assert from "assert";
import { describe, it } from "node:test";
import { FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import {
  TestExplorerItemData,
  TestExplorerNode,
  collectTestExplorerLeaves,
  resolveTestExplorerRunTargets,
} from "../providers/testExplorerRun";

function feature(name: string): FeatureInfo {
  return {
    name,
    filePath: `/proj/${name}.feature`,
    tags: [],
    scenarios: [],
  };
}

function scenario(name: string, line: number): ScenarioInfo {
  return { name, tags: [], line, isOutline: false };
}

class MockNode implements TestExplorerNode {
  readonly children: MockNode[] = [];
  constructor(readonly data?: TestExplorerItemData) {}
  addChild(child: MockNode): void {
    this.children.push(child);
  }
  childrenEach(visit: (child: TestExplorerNode) => void): void {
    for (const child of this.children) {
      visit(child);
    }
  }
}

describe("testExplorerRun", () => {
  it("collects outline rows and leaf scenarios", () => {
    const f = feature("Smoke");
    const s = scenario("Ready", 5);
    const row = { rowIndex: 0, line: 10, headers: ["a"], values: ["1"], label: "a=1" };
    const root = new MockNode();
    const scenarioNode = new MockNode({ kind: "scenario", feature: f, scenario: s, underTagGroup: false });
    const rowNode = new MockNode({ kind: "outlineRow", feature: f, scenario: s, example: row });
    scenarioNode.addChild(rowNode);
    const leafScenario = new MockNode({
      kind: "scenario",
      feature: f,
      scenario: scenario("Other", 8),
      underTagGroup: false,
    });
    root.addChild(scenarioNode);
    root.addChild(leafScenario);

    const data = new Map<MockNode, TestExplorerItemData>([
      [scenarioNode, scenarioNode.data!],
      [rowNode, rowNode.data!],
      [leafScenario, leafScenario.data!],
    ]);

    const leaves = collectTestExplorerLeaves([root], (n) => data.get(n), new Set());
    assert.strictEqual(leaves.length, 2);
    assert.ok(leaves.includes(rowNode));
    assert.ok(leaves.includes(leafScenario));
  });

  it("collects scenarios under a tag node", () => {
    const f = feature("Smoke");
    const s = scenario("Ready", 5);
    const tag = new MockNode({ kind: "tag", tag: "smoke" });
    tag.addChild(new MockNode({ kind: "scenario", feature: f, scenario: s, underTagGroup: true }));

    const data = new Map<MockNode, TestExplorerItemData>();
    data.set(tag, tag.data!);
    data.set(tag.children[0], tag.children[0].data!);

    const leaves = collectTestExplorerLeaves([tag], (n) => data.get(n), new Set());
    assert.strictEqual(leaves.length, 1);
    assert.strictEqual(data.get(leaves[0])?.kind, "scenario");
  });

  it("resolveTestExplorerRunTargets uses tag filter for tag-only selection", () => {
    const targets = resolveTestExplorerRunTargets(
      [{ kind: "tag", tag: "smoke" }],
      [],
      false,
    );
    assert.strictEqual(targets.length, 1);
    assert.deepStrictEqual(targets[0], { kind: "tag", tag: "smoke" });
  });

  it("resolveTestExplorerRunTargets is case-sensitive on tag name from item data", () => {
    const targets = resolveTestExplorerRunTargets(
      [{ kind: "tag", tag: "Smoke" }],
      [],
      false,
    );
    assert.strictEqual(targets.length, 1);
    if (targets[0].kind === "tag") {
      assert.strictEqual(targets[0].tag, "Smoke");
    }
  });

  it("resolveTestExplorerRunTargets falls back to leaf scenarios for mixed selection", () => {
    const f = feature("Smoke");
    const s = scenario("Ready", 5);
    const targets = resolveTestExplorerRunTargets(
      [{ kind: "tag", tag: "smoke" }, { kind: "scenario", feature: f, scenario: s, underTagGroup: false }],
      [{ kind: "scenario", feature: f, scenario: s, underTagGroup: false }],
      false,
    );
    assert.strictEqual(targets.length, 1);
    assert.strictEqual(targets[0].kind, "scenario");
  });

  it("resolveTestExplorerRunTargets returns all for Run All", () => {
    const targets = resolveTestExplorerRunTargets([], [], true);
    assert.deepStrictEqual(targets, [{ kind: "all" }]);
  });
});
