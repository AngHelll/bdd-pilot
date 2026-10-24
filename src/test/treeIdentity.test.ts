import * as assert from "assert";
import { describe, it } from "node:test";
import {
  DomainPlacement,
  exampleTreeItemId,
  PlacedNode,
  scenarioNodeIsOutline,
  scenarioTreeItemId,
  summaryTreeItemId,
  tagFailureExpandRefs,
  tagTreeItemId,
  TagPlacement,
  TREE_ITEM_CONTEXT,
  contextValueAllowsRunAndDebug,
  visibleAncestorChain,
  visibleExampleItemId,
  visibleScenarioItemId,
} from "../core/gherkin/treeIdentity";

const pay = "/tmp/Orders/Pay.feature";
const history = "/tmp/Orders/History.feature";
const colonPath = "C:\\work\\a:1\\Pay.feature";

const groups: TagPlacement[] = [
  {
    tag: "Smoke",
    scenarios: [
      { filePath: pay, line: 8 },
      { filePath: pay, line: 20 },
      { filePath: history, line: 8 },
    ],
  },
  {
    tag: "Fast",
    scenarios: [
      { filePath: pay, line: 8 },
      { filePath: pay, line: 20 },
    ],
  },
];

const domains: DomainPlacement[] = [
  {
    name: "Orders",
    features: [{ filePath: pay }, { filePath: history }, { filePath: colonPath }],
  },
];

describe("tree item ids", () => {
  it("stays the same when label, locale, outcome, or duration would change", () => {
    const before = scenarioTreeItemId({ filePath: pay, line: 8, isOutline: false });
    const after = scenarioTreeItemId({ filePath: pay, line: 8, isOutline: false });
    assert.strictEqual(before, after);
    assert.strictEqual(before.includes("Login"), false);
    assert.strictEqual(before.includes("Escenario"), false);
    assert.strictEqual(before.includes("passed"), false);
    assert.strictEqual(before.includes("failed"), false);
    assert.strictEqual(summaryTreeItemId(), "summary");
  });

  it("separates homonymous scenarios by file and line", () => {
    const ids = [
      scenarioTreeItemId({ filePath: pay, line: 8, isOutline: false }),
      scenarioTreeItemId({ filePath: pay, line: 30, isOutline: false }),
      scenarioTreeItemId({ filePath: history, line: 8, isOutline: false }),
    ];
    assert.strictEqual(new Set(ids).size, ids.length);
  });

  it("separates duplicate example values by row index, not by label", () => {
    const first = exampleTreeItemId({ filePath: pay, line: 20, rowIndex: 0 });
    const duplicateValue = exampleTreeItemId({ filePath: pay, line: 20, rowIndex: 1 });
    assert.notStrictEqual(first, duplicateValue);
    assert.strictEqual(first, exampleTreeItemId({ filePath: pay, line: 20, rowIndex: 0 }));
    assert.strictEqual(first.includes("x=a"), false);
  });

  it("gives each tag copy its own id and keeps that id off the domain tree", () => {
    const domainId = visibleScenarioItemId(pay, 8, false, "smoke", "domain", groups);
    const smoke = visibleScenarioItemId(pay, 8, false, "smoke", "tag", groups);
    const fast = visibleScenarioItemId(pay, 8, false, "fast", "tag", groups);
    const firstVisible = visibleScenarioItemId(pay, 8, false, undefined, "tag", groups);
    assert.strictEqual(domainId, scenarioTreeItemId({ filePath: pay, line: 8, isOutline: false }));
    assert.notStrictEqual(smoke, fast);
    assert.notStrictEqual(smoke, domainId);
    assert.strictEqual(firstVisible, smoke);
    assert.strictEqual(tagTreeItemId("Smoke"), tagTreeItemId("smoke"));
  });

  it("does not collide when a path contains colons", () => {
    const drive = scenarioTreeItemId({ filePath: colonPath, line: 12, isOutline: false });
    const other = scenarioTreeItemId({
      filePath: "C:\\work\\a",
      line: 1,
      isOutline: false,
    });
    assert.notStrictEqual(drive, other);
  });

  it("uses the outline id once the node is an outline, including before rows are filled", () => {
    assert.strictEqual(scenarioNodeIsOutline({ isOutline: true, examples: [] }), true);
    assert.strictEqual(
      scenarioTreeItemId({ filePath: pay, line: 20, isOutline: true }),
      scenarioTreeItemId({ filePath: pay, line: 20, isOutline: scenarioNodeIsOutline({ isOutline: true }) }),
    );
    assert.notStrictEqual(
      scenarioTreeItemId({ filePath: pay, line: 20, isOutline: false }),
      scenarioTreeItemId({ filePath: pay, line: 20, isOutline: true }),
    );
  });

  it("assigns unique ids to every node visible in one grouping", () => {
    const domainIds = [
      summaryTreeItemId(),
      scenarioTreeItemId({ filePath: pay, line: 8, isOutline: false }),
      scenarioTreeItemId({ filePath: pay, line: 20, isOutline: true }),
      exampleTreeItemId({ filePath: pay, line: 20, rowIndex: 0 }),
      exampleTreeItemId({ filePath: pay, line: 20, rowIndex: 1 }),
      scenarioTreeItemId({ filePath: history, line: 8, isOutline: false }),
      scenarioTreeItemId({ filePath: colonPath, line: 12, isOutline: false }),
    ];
    const tagIds = [
      summaryTreeItemId(),
      tagTreeItemId("smoke"),
      tagTreeItemId("fast"),
      visibleScenarioItemId(pay, 8, false, "smoke", "tag", groups),
      visibleScenarioItemId(pay, 8, false, "fast", "tag", groups),
      visibleScenarioItemId(pay, 20, true, "smoke", "tag", groups),
      visibleScenarioItemId(pay, 20, true, "fast", "tag", groups),
      visibleExampleItemId(pay, 20, 0, "smoke", "tag", groups),
      visibleExampleItemId(pay, 20, 1, "smoke", "tag", groups),
      visibleExampleItemId(pay, 20, 0, "fast", "tag", groups),
      visibleExampleItemId(pay, 20, 1, "fast", "tag", groups),
      visibleScenarioItemId(history, 8, false, "smoke", "tag", groups),
    ];
    assert.strictEqual(new Set(domainIds).size, domainIds.length);
    assert.strictEqual(new Set(tagIds).size, tagIds.length);
  });
});

describe("visible parent chain", () => {
  it("walks domain, feature, outline, then example", () => {
    const example: PlacedNode = {
      kind: "outlineRow",
      filePath: pay,
      line: 20,
      rowIndex: 1,
    };
    const chain = visibleAncestorChain(example, "domain", domains, groups);
    assert.deepStrictEqual(
      chain.map((node) => node.kind),
      ["domain", "feature", "scenario"],
    );
    assert.strictEqual(chain[0].domainName, "Orders");
    assert.strictEqual(chain[1].filePath, pay);
    assert.strictEqual(chain[2].line, 20);
    assert.strictEqual(chain[2].parentTagKey, undefined);
  });

  it("walks the tag that owns the node, including a second copy", () => {
    const fastExample: PlacedNode = {
      kind: "outlineRow",
      filePath: pay,
      line: 20,
      rowIndex: 0,
      parentTagKey: "fast",
    };
    const chain = visibleAncestorChain(fastExample, "tag", domains, groups);
    assert.deepStrictEqual(
      chain.map((node) => node.kind),
      ["tag", "scenario"],
    );
    assert.strictEqual(chain[0].tag, "fast");
    assert.strictEqual(chain[1].parentTagKey, "fast");
  });

  it("reveal without an explicit tag uses the first visible tag", () => {
    const leaf: PlacedNode = { kind: "scenario", filePath: pay, line: 8 };
    const chain = visibleAncestorChain(leaf, "tag", domains, groups);
    assert.strictEqual(chain[0].tag, "smoke");
  });

  it("a feature has no parent while the tree is grouped by tag", () => {
    const feature: PlacedNode = { kind: "feature", filePath: pay };
    assert.deepStrictEqual(visibleAncestorChain(feature, "tag", domains, groups), []);
  });
});

describe("failure navigation", () => {
  it("expands every tag that shows a failure, and outline parents only for example rows", () => {
    const refs = tagFailureExpandRefs(
      [
        { filePath: pay, scenarioLine: 8 },
        { filePath: pay, scenarioLine: 20, rowIndex: 1 },
        { filePath: "/tmp/untagged.feature", scenarioLine: 3 },
      ],
      groups,
    );
    assert.deepStrictEqual(refs, [
      { kind: "tag", tagKey: "smoke" },
      { kind: "scenario", tagKey: "smoke", filePath: pay, line: 20 },
      { kind: "tag", tagKey: "fast" },
      { kind: "scenario", tagKey: "fast", filePath: pay, line: 20 },
    ]);
  });

  it("dedupes two failed rows under the same outline", () => {
    const refs = tagFailureExpandRefs(
      [
        { filePath: pay, scenarioLine: 20, rowIndex: 0 },
        { filePath: pay, scenarioLine: 20, rowIndex: 1 },
      ],
      groups,
    );
    const outlines = refs.filter((ref) => ref.kind === "scenario");
    assert.strictEqual(outlines.length, 2);
  });
});

describe("Run and Debug context values", () => {
  it("keeps inline Run and Debug on the bddRunnable prefix", () => {
    assert.strictEqual(TREE_ITEM_CONTEXT.domain, "bddRunnableDomain");
    assert.strictEqual(TREE_ITEM_CONTEXT.tag, "bddRunnableTag");
    assert.strictEqual(TREE_ITEM_CONTEXT.feature, "bddRunnableFeature");
    assert.strictEqual(TREE_ITEM_CONTEXT.scenario, "bddRunnableScenario");
    for (const value of [
      TREE_ITEM_CONTEXT.domain,
      TREE_ITEM_CONTEXT.tag,
      TREE_ITEM_CONTEXT.feature,
      TREE_ITEM_CONTEXT.scenario,
    ]) {
      assert.strictEqual(contextValueAllowsRunAndDebug(value), true);
    }
    assert.strictEqual(contextValueAllowsRunAndDebug(TREE_ITEM_CONTEXT.summary), false);
    assert.strictEqual(contextValueAllowsRunAndDebug(TREE_ITEM_CONTEXT.summaryRunning), false);
    assert.strictEqual(contextValueAllowsRunAndDebug(TREE_ITEM_CONTEXT.empty), false);
  });
});
