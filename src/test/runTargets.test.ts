import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import { TagGroup } from "../core/gherkin/groupByTag";
import { toRunTarget } from "../activation/runTargets";
import {
  DomainNode,
  OutlineRowNode,
  ScenarioNode,
  TagNode,
} from "../core/gherkin/treeNodes";

const feature: FeatureInfo = {
  name: "Pay",
  filePath: "/tmp/Pay.feature",
  tags: [],
  scenarios: [],
};

const scenario: ScenarioInfo = {
  name: "Login",
  tags: ["smoke"],
  line: 8,
  isOutline: false,
};

const outline: ScenarioInfo = {
  name: "Pay with card",
  tags: [],
  line: 20,
  isOutline: true,
  examples: [
    { rowIndex: 0, line: 24, headers: ["x"], values: ["a"], label: "x=a" },
    { rowIndex: 1, line: 25, headers: ["x"], values: ["a"], label: "x=a" },
  ],
};

const domain: DomainGroup = { name: "Orders", features: [feature] };
const tag: TagGroup = { tag: "Smoke", scenarios: [{ feature, scenario }] };

describe("toRunTarget", () => {
  it("palette invocation with no node still runs the whole suite", () => {
    assert.deepStrictEqual(toRunTarget(undefined), { kind: "all" });
  });

  it("summary row stays out of Run and Debug", () => {
    assert.strictEqual(toRunTarget({ kind: "pilotSummary" }), undefined);
  });

  it("maps domain, tag, feature, scenario, and example without reading labels", () => {
    const domainNode: DomainNode = { kind: "domain", group: domain };
    const tagNode: TagNode = { kind: "tag", group: tag };
    const scenarioNode: ScenarioNode = { kind: "scenario", feature, scenario };
    const tagged: ScenarioNode = {
      kind: "scenario",
      feature,
      scenario,
      underTagGroup: true,
      parentTagKey: "smoke",
    };
    const row: OutlineRowNode = {
      kind: "outlineRow",
      feature,
      scenario: outline,
      example: outline.examples![0],
    };
    const taggedRow: OutlineRowNode = { ...row, parentTagKey: "smoke" };

    assert.strictEqual(toRunTarget(domainNode)?.kind, "domain");
    assert.strictEqual(toRunTarget(tagNode)?.kind, "tag");
    assert.deepStrictEqual(toRunTarget({ kind: "feature", feature }), { kind: "feature", feature });
    assert.deepStrictEqual(toRunTarget(scenarioNode), {
      kind: "scenario",
      feature,
      scenario,
    });
    assert.deepStrictEqual(toRunTarget(tagged), toRunTarget(scenarioNode));
    assert.deepStrictEqual(toRunTarget(row), {
      kind: "outlineRow",
      feature,
      scenario: outline,
      example: outline.examples![0],
    });
    assert.deepStrictEqual(toRunTarget(taggedRow), toRunTarget(row));
  });
});
