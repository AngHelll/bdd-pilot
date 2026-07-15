import * as assert from "assert";
import { describe, it } from "node:test";
import { groupByTag } from "../core/gherkin/groupByTag";
import { DomainGroup, FeatureInfo } from "../core/gherkin/model";
import { computeRollup } from "../core/gherkin/outcomeRollup";
import {
  buildTestExplorerDomainDescription,
  buildTestExplorerFeatureDescription,
  buildTestExplorerOutlineRowDescription,
  buildTestExplorerTagDescription,
  collectScenarioOutcomeValues,
  OutcomeReader,
} from "../core/gherkin/testExplorerLabels";
import {
  buildContainerDescription,
  effectiveLeafTagDisplay,
} from "../core/gherkin/treeContainerLabels";
import {
  buildDomainStructuralBase,
  buildTagGroupStructuralBase,
  parseTreeDisplaySettings,
  parseTreeGroupBy,
  TreeDisplaySettings,
} from "../core/gherkin/treeDisplaySettings";
import {
  buildFeatureDescription,
  buildScenarioDescription,
  DEFAULT_COMPACT_TAG_LIMIT,
  DEFAULT_TAG_DISPLAY,
} from "../core/gherkin/treeLabels";
import { effectiveScenarioTags } from "../core/gherkin/tags";
import { applyTrxMatchesToStore } from "../core/results/trxTreeMapping";
import { DEFAULT_DURATION_DISPLAY } from "../core/results/durationFormat";
import { SkipReason } from "../core/results/skipReason";
import { TestOutcome } from "../core/results/trxParser";
import { outlineRowKey, scenarioKey } from "../core/runner/runScope";

const detailed: TreeDisplaySettings = {
  displayMode: "detailed",
  tagDisplay: DEFAULT_TAG_DISPLAY,
  compactTagLimit: DEFAULT_COMPACT_TAG_LIMIT,
  durationDisplay: DEFAULT_DURATION_DISPLAY,
};

const compact: TreeDisplaySettings = { ...detailed, displayMode: "compact" };

class MemoryStore implements OutcomeReader {
  private outcomes = new Map<string, TestOutcome>();
  private durations = new Map<string, number>();
  private skipReasons = new Map<string, SkipReason>();

  set(key: string, outcome: TestOutcome, durationMs?: number): void {
    this.outcomes.set(key, outcome);
    if (durationMs !== undefined) {
      this.durations.set(key, durationMs);
    }
  }

  get(key: string): TestOutcome | undefined {
    return this.outcomes.get(key);
  }

  getDuration(key: string): number | undefined {
    return this.durations.get(key);
  }

  setSkipReason(key: string, reason: SkipReason): void {
    this.skipReasons.set(key, reason);
  }

  clearSkipReason(key: string): void {
    this.skipReasons.delete(key);
  }
}

function fixtureDomains(): DomainGroup[] {
  const alpha: FeatureInfo = {
    name: "Alpha",
    filePath: "/x/Alpha.feature",
    tags: ["suite"],
    scenarios: [
      { name: "Login", tags: ["smoke"], line: 5, isOutline: false },
      {
        name: "Add numbers",
        tags: ["smoke"],
        line: 12,
        isOutline: true,
        examples: [
          { rowIndex: 0, line: 14, headers: ["a"], values: ["1"], label: "a=1" },
          { rowIndex: 1, line: 15, headers: ["a"], values: ["2"], label: "a=2" },
        ],
      },
    ],
  };
  const beta: FeatureInfo = {
    name: "Beta",
    filePath: "/x/Beta.feature",
    tags: [],
    scenarios: [{ name: "Export", tags: ["regression"], line: 3, isOutline: false }],
  };
  return [{ name: "General", features: [alpha, beta] }];
}

function leafKeys(domains: DomainGroup[]): Set<string> {
  const keys = new Set<string>();
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const ex of scenario.examples) {
            keys.add(outlineRowKey(feature, scenario, ex.rowIndex));
          }
        } else {
          keys.add(scenarioKey(feature, scenario));
        }
      }
    }
  }
  return keys;
}

describe("treeDisplaySettings parse", () => {
  it("parseTreeGroupBy defaults to domain", () => {
    assert.strictEqual(parseTreeGroupBy(undefined), "domain");
    assert.strictEqual(parseTreeGroupBy("tag"), "tag");
    assert.strictEqual(parseTreeGroupBy("other"), "domain");
  });

  it("parseTreeDisplaySettings applies defaults and clamps compact limit", () => {
    const parsed = parseTreeDisplaySettings({ compactTagLimit: 0, displayMode: "nope" });
    assert.strictEqual(parsed.displayMode, "detailed");
    assert.strictEqual(parsed.compactTagLimit, 1);
    assert.strictEqual(parsed.tagDisplay, DEFAULT_TAG_DISPLAY);
  });
});

describe("treeTeParity", () => {
  const domains = fixtureDomains();
  const domain = domains[0];
  const alpha = domain.features[0];
  const store = new MemoryStore();

  store.set(scenarioKey(alpha, alpha.scenarios[0]), "passed", 10);
  store.set(outlineRowKey(alpha, alpha.scenarios[1], 0), "failed", 20);
  store.set(outlineRowKey(alpha, alpha.scenarios[1], 1), "passed", 15);
  store.set(scenarioKey(domain.features[1], domain.features[1].scenarios[0]), "passed", 5);

  it("domain container description matches Tree ↔ TE for compact and detailed", () => {
    for (const display of [detailed, compact]) {
      const te = buildTestExplorerDomainDescription(domain, store, display, "en");
      const values: Array<TestOutcome | undefined> = [];
      for (const feature of domain.features) {
        for (const scenario of feature.scenarios) {
          values.push(...collectScenarioOutcomeValues(feature, scenario, store));
        }
      }
      const rollup = computeRollup(values);
      const scenarioCount = domain.features.reduce((n, f) => n + f.scenarios.length, 0);
      const tree = buildContainerDescription(
        display.displayMode,
        rollup,
        buildDomainStructuralBase(domain.features.length, scenarioCount),
        "en",
      );
      assert.strictEqual(te, tree, `displayMode=${display.displayMode}`);
    }
  });

  it("feature container description matches Tree ↔ TE", () => {
    for (const display of [detailed, compact]) {
      const te = buildTestExplorerFeatureDescription(alpha, store, display, "en");
      const values = alpha.scenarios.flatMap((s) => collectScenarioOutcomeValues(alpha, s, store));
      const rollup = computeRollup(values);
      const base = buildFeatureDescription(
        alpha.scenarios.length,
        alpha.tags,
        display.tagDisplay,
        display.compactTagLimit,
      );
      const tree = buildContainerDescription(display.displayMode, rollup, base, "en");
      assert.strictEqual(te, tree);
    }
  });

  it("tag container description matches Tree ↔ TE", () => {
    const tags = groupByTag(domains);
    const smoke = tags.find((g) => g.tag === "smoke");
    assert.ok(smoke);
    for (const display of [detailed, compact]) {
      const te = buildTestExplorerTagDescription(smoke!, store, display, "en");
      const values = smoke!.scenarios.flatMap((ref) =>
        collectScenarioOutcomeValues(ref.feature, ref.scenario, store),
      );
      const rollup = computeRollup(values);
      const tree = buildContainerDescription(
        display.displayMode,
        rollup,
        buildTagGroupStructuralBase(smoke!.scenarios.length),
        "en",
      );
      assert.strictEqual(te, tree);
    }
  });

  it("compact mode hides leaf tags for outline rows (Tree ↔ TE)", () => {
    const scenario = alpha.scenarios[1];
    const tags = effectiveScenarioTags(alpha, scenario);
    assert.strictEqual(effectiveLeafTagDisplay("compact", "full"), "hidden");
    const te = buildTestExplorerOutlineRowDescription(alpha, scenario, store, compact, "en", 0);
    const treeTagPart = buildScenarioDescription(
      tags,
      effectiveLeafTagDisplay(compact.displayMode, compact.tagDisplay),
      compact.compactTagLimit,
      undefined,
    );
    assert.ok(te);
    assert.ok(!te!.includes("@"));
    assert.strictEqual(treeTagPart, "");
  });

  it("groupBy does not change outcome leaf keys", () => {
    const byDomain = leafKeys(domains);
    const byTag = leafKeys(domains);
    assert.deepStrictEqual([...byDomain].sort(), [...byTag].sort());
    assert.ok(byDomain.has(scenarioKey(alpha, alpha.scenarios[0])));
    assert.ok(byDomain.has(outlineRowKey(alpha, alpha.scenarios[1], 1)));
  });

  it("shared TRX apply maps FQN collision to one feature only", () => {
    const twin: DomainGroup[] = [
      {
        name: "General",
        features: [
          {
            name: "Alpha",
            filePath: "/x/Alpha.feature",
            tags: [],
            scenarios: [{ name: "Shared", tags: [], line: 2, isOutline: false }],
          },
          {
            name: "Beta",
            filePath: "/x/Beta.feature",
            tags: [],
            scenarios: [{ name: "Shared", tags: [], line: 2, isOutline: false }],
          },
        ],
      },
    ];
    const writer = new MemoryStore();
    applyTrxMatchesToStore(writer, twin, {
      results: [{ testName: "BetaFeature.Shared", outcome: "passed", durationMs: 1 }],
    });
    assert.strictEqual(
      writer.get(scenarioKey(twin[0].features[0], twin[0].features[0].scenarios[0])),
      undefined,
    );
    assert.strictEqual(
      writer.get(scenarioKey(twin[0].features[1], twin[0].features[1].scenarios[0])),
      "passed",
    );
  });
});
