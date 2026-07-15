import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup, FeatureInfo } from "../core/gherkin/model";
import { matchRunTarget } from "../core/runner/matchRunTarget";

const featureA: FeatureInfo = {
  name: "Orders",
  filePath: "/proj/Features/Trading/Orders.feature",
  tags: [],
  scenarios: [
    { name: "Place order", tags: ["smoke"], line: 5, isOutline: false },
    { name: "Cancel order", tags: ["regression"], line: 12, isOutline: false },
  ],
};

const featureB: FeatureInfo = {
  name: "Reports",
  filePath: "/proj/Features/Analytics/Reports.feature",
  tags: [],
  scenarios: [{ name: "Export report", tags: ["smoke"], line: 3, isOutline: false }],
};

const domains: DomainGroup[] = [
  { name: "Trading", features: [featureA] },
  { name: "Analytics", features: [featureB] },
];

describe("matchRunTarget", () => {
  it("matches scenario within a domain target", () => {
    const testName = "OrdersFeature.PlaceOrder";
    const match = matchRunTarget(
      [{ kind: "domain", group: domains[0] }],
      testName,
      domains,
    );
    assert.ok(match);
    assert.strictEqual(match!.feature.filePath, featureA.filePath);
    assert.strictEqual(match!.scenario.name, "Place order");
  });

  it("matches scenario by effective tag across domains", () => {
    const testName = "ReportsFeature.ExportReport";
    const match = matchRunTarget([{ kind: "tag", tag: "smoke" }], testName, domains);
    assert.ok(match);
    assert.strictEqual(match!.scenario.name, "Export report");
  });

  it("does not match tag target when scenario lacks the tag", () => {
    const testName = "OrdersFeature.CancelOrder";
    const match = matchRunTarget([{ kind: "tag", tag: "smoke" }], testName, domains);
    assert.strictEqual(match, undefined);
  });

  it("disambiguates same scenario title across features via FQN class", () => {
    const twin: FeatureInfo = {
      name: "Archive",
      filePath: "/proj/Features/Trading/Archive.feature",
      tags: [],
      scenarios: [{ name: "Place order", tags: ["smoke"], line: 3, isOutline: false }],
    };
    const group: DomainGroup = { name: "Trading", features: [featureA, twin] };
    const match = matchRunTarget(
      [{ kind: "domain", group }],
      "ArchiveFeature.PlaceOrder",
      [group],
    );
    assert.ok(match);
    assert.strictEqual(match!.feature.filePath, twin.filePath);
  });

  it("does not match prefix sibling scenario names under FQN", () => {
    const withPrefix: FeatureInfo = {
      name: "Orders",
      filePath: featureA.filePath,
      tags: [],
      scenarios: [
        { name: "Place order", tags: [], line: 5, isOutline: false },
        { name: "Place order batch", tags: [], line: 20, isOutline: false },
      ],
    };
    const match = matchRunTarget(
      [{ kind: "feature", feature: withPrefix }],
      "OrdersFeature.PlaceOrder",
    );
    assert.ok(match);
    assert.strictEqual(match!.scenario.name, "Place order");
  });
});
