import * as assert from "assert";
import * as path from "path";
import { describe, it } from "node:test";
import {
  resolveExecutableTargets,
  resolveFeatureInDomains,
  resolveScenarioInDomains,
} from "../core/gherkin/resolveRunTarget";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../core/gherkin/model";

function makeFeature(filePath: string, name: string, scenarios: ScenarioInfo[]): FeatureInfo {
  return { name, filePath, tags: [], scenarios };
}

const scenarioA: ScenarioInfo = {
  name: "Scenario A",
  tags: [],
  line: 10,
  isOutline: false,
};

describe("resolveRunTarget", () => {
  it("matches feature by normalized path when stub uses mixed separators", () => {
    const canonical = path.join("/proj", "Features", "Trading", "Sample.feature");
    const feature = makeFeature(canonical, "Sample", [scenarioA]);
    const domains: DomainGroup[] = [{ name: "Trading", features: [feature] }];

    const stub = makeFeature("/proj/Features/Trading/Sample.feature", "Sample", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stub, domains), feature);

    const stubDoubled = makeFeature("/proj//Features/Trading/Sample.feature", "Sample", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stubDoubled, domains), feature);
  });

  it("falls back to feature name when paths differ", () => {
    const feature = makeFeature("/proj/Features/Sample.feature", "Sample", [scenarioA]);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];

    const stub = makeFeature("/other/path.feature", "Sample", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stub, domains), feature);
  });

  it("returns undefined when path and name do not match", () => {
    const feature = makeFeature("/proj/X.feature", "Sample", [scenarioA]);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];

    const stub = makeFeature("/other/Y.feature", "Other", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stub, domains), undefined);
  });

  it("resolves scenario by line and name, then name only", () => {
    const scenarioB: ScenarioInfo = {
      name: "Scenario B",
      tags: [],
      line: 20,
      isOutline: false,
    };
    const feature = makeFeature("/proj/X.feature", "X", [scenarioA, scenarioB]);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];

    const resolved = resolveScenarioInDomains(
      feature,
      { name: "Scenario A", tags: [], line: 10, isOutline: false },
      domains,
    );
    assert.deepStrictEqual(resolved, { feature, scenario: scenarioA });

    const byNameOnly = resolveScenarioInDomains(
      feature,
      { name: "Scenario B", tags: [], line: 999, isOutline: false },
      domains,
    );
    assert.deepStrictEqual(byNameOnly, { feature, scenario: scenarioB });
  });

  it("replaces a header stub with the discovered feature", () => {
    const feature = makeFeature("/proj/Features/Sample.feature", "Sample", [scenarioA]);
    const domains: DomainGroup[] = [{ name: "Trading", features: [feature] }];
    const stub = makeFeature("/proj/Features/Sample.feature", "Sample", []);

    const resolved = resolveExecutableTargets([{ kind: "feature", feature: stub }], domains);
    assert.deepStrictEqual(resolved, {
      status: "ready",
      targets: [{ kind: "feature", feature }],
    });
  });

  it("keeps a discovered feature with no scenarios distinct from a miss", () => {
    const empty = makeFeature("/proj/Features/Empty.feature", "Empty", []);
    const domains: DomainGroup[] = [{ name: "Trading", features: [empty] }];

    const resolved = resolveExecutableTargets([{ kind: "feature", feature: empty }], domains);
    assert.deepStrictEqual(resolved, {
      status: "ready",
      targets: [{ kind: "feature", feature: empty }],
    });

    const missing = resolveExecutableTargets(
      [{ kind: "feature", feature: makeFeature("/proj/Missing.feature", "Missing", []) }],
      domains,
    );
    assert.deepStrictEqual(missing, { status: "unresolved" });
  });

  it("restores outline examples stripped from a scenario stub", () => {
    const outline: ScenarioInfo = {
      name: "Many",
      tags: [],
      line: 4,
      isOutline: true,
      examples: [
        { rowIndex: 0, line: 8, headers: ["x"], values: ["a"], label: "x=a" },
        { rowIndex: 1, line: 9, headers: ["x"], values: ["b"], label: "x=b" },
      ],
    };
    const feature = makeFeature("/proj/Features/Sample.feature", "Sample", [outline]);
    const domains: DomainGroup[] = [{ name: "Trading", features: [feature] }];

    const resolved = resolveExecutableTargets(
      [
        {
          kind: "scenario",
          feature: makeFeature(feature.filePath, feature.name, []),
          scenario: { ...outline, examples: undefined },
        },
      ],
      domains,
    );
    assert.deepStrictEqual(resolved, {
      status: "ready",
      targets: [{ kind: "scenario", feature, scenario: outline }],
    });
  });

  it("matches win32-style paths via normalize on Windows", () => {
    if (process.platform !== "win32") {
      return;
    }
    const feature = makeFeature("C:\\proj\\Features\\Sample.feature", "Sample", [scenarioA]);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];
    const stub = makeFeature("C:/proj/Features/Sample.feature", "Sample", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stub, domains), feature);
  });
});
