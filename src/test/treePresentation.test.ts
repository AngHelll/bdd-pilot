import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { buildScenarioTooltipMarkdown } from "../core/gherkin/treeLabels";
import {
  contextValueAllowsRunAndDebug,
  scenarioTreeItemId,
  TREE_ITEM_CONTEXT,
} from "../core/gherkin/treeIdentity";
import {
  FEATURE_DISCOVERY_CONFIGURATION_KEYS,
  TREE_PRESENTATION_CONFIGURATION,
  containerResultStateLabel,
  formatTreeAccessibilityLabel,
  formatTreeLeafLabel,
  leafResultStateLabel,
  DEFAULT_TREE_PRESENTATION,
  parseTreePresentation,
  prependScenarioLevelTooltip,
  shouldRediscoverFeatures,
} from "../core/gherkin/treePresentation";
import { resolveLeafIconSpec } from "../core/results/treeLeafVisual";

const ROOT = path.resolve(__dirname, "../..");
const LONG_NAME =
  "Checkout accepts a very long scenario title that would otherwise lose the tail to a Scenario prefix";
const LONG_EXAMPLE = "first=1, second=2, third=3, fourth=4, fifth=5, sixth=6 +4";

function affectsChanged(changed: string[]): (section: string) => boolean {
  return (section) => changed.some((key) => key === section || key.startsWith(`${section}.`));
}

describe("treePresentation", () => {
  it("defaults to native precision and keeps an explicit classic choice", () => {
    assert.strictEqual(DEFAULT_TREE_PRESENTATION, "nativePrecision");
    assert.strictEqual(parseTreePresentation(undefined), "nativePrecision");
    assert.strictEqual(parseTreePresentation("nativePrecision"), "nativePrecision");
    assert.strictEqual(parseTreePresentation("classic"), "classic");
    assert.strictEqual(parseTreePresentation("other"), "nativePrecision");

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      contributes: { configuration: { properties: Record<string, { default?: string }> } };
    };
    assert.strictEqual(
      pkg.contributes.configuration.properties[TREE_PRESENTATION_CONFIGURATION].default,
      "nativePrecision",
    );
  });

  it("removes leaf prefixes only in native precision, including long names", () => {
    assert.strictEqual(formatTreeLeafLabel("scenario", LONG_NAME, "en", "classic"), `Scenario: ${LONG_NAME}`);
    assert.strictEqual(formatTreeLeafLabel("outline", "Add two numbers", "en", "classic"), "Outline: Add two numbers");
    assert.strictEqual(formatTreeLeafLabel("example", LONG_EXAMPLE, "en", "classic"), `Example: ${LONG_EXAMPLE}`);
    assert.strictEqual(formatTreeLeafLabel("scenario", LONG_NAME, "es", "classic"), `Escenario: ${LONG_NAME}`);
    assert.strictEqual(formatTreeLeafLabel("scenario", LONG_NAME, "en", "nativePrecision"), LONG_NAME);
    assert.strictEqual(formatTreeLeafLabel("scenario", LONG_NAME, "es", "nativePrecision"), LONG_NAME);
    assert.strictEqual(formatTreeLeafLabel("outline", "Add two numbers", "es", "nativePrecision"), "Add two numbers");
    assert.strictEqual(formatTreeLeafLabel("example", LONG_EXAMPLE, "es", "nativePrecision"), LONG_EXAMPLE);
  });

  it("keeps Fase 1 ids independent of label, locale, and presentation", () => {
    const id = scenarioTreeItemId({ filePath: "/tmp/Smoke.feature", line: 4, isOutline: false });
    assert.strictEqual(
      scenarioTreeItemId({ filePath: "/tmp/Smoke.feature", line: 4, isOutline: false }),
      id,
    );
    assert.strictEqual(id.includes(LONG_NAME), false);
    assert.strictEqual(id.includes("Scenario"), false);
    assert.strictEqual(id.includes("Escenario"), false);
    assert.strictEqual(TREE_ITEM_CONTEXT.scenario, "bddRunnableScenario");
    assert.strictEqual(contextValueAllowsRunAndDebug(TREE_ITEM_CONTEXT.scenario), true);
  });

  it("speaks level, state, and name in English and Spanish", () => {
    assert.strictEqual(
      formatTreeAccessibilityLabel("en", "example", "first=5, second=7 +1", leafResultStateLabel("en", "failed", undefined)),
      "Example. Failed. first=5, second=7 +1.",
    );
    assert.strictEqual(
      formatTreeAccessibilityLabel("es", "example", "first=5, second=7 +1", leafResultStateLabel("es", "failed", undefined)),
      "Ejemplo. Fallido. first=5, second=7 +1.",
    );
    assert.strictEqual(
      formatTreeAccessibilityLabel("en", "scenario", "System is ready", leafResultStateLabel("en", undefined, undefined)),
      "Scenario. Not run. System is ready.",
    );
    assert.strictEqual(
      formatTreeAccessibilityLabel("es", "outline", "Add two numbers", leafResultStateLabel("es", "passed", undefined)),
      "Esquema. Correcto. Add two numbers.",
    );
    assert.strictEqual(
      formatTreeAccessibilityLabel("en", "scenario", "Welcome user", leafResultStateLabel("en", "skipped", "canceled")),
      "Scenario. Canceled before completion. Welcome user.",
    );
    assert.strictEqual(
      formatTreeAccessibilityLabel("en", "domain", "General", containerResultStateLabel("en", undefined)),
      "Domain. Not run. General.",
    );
    assert.strictEqual(
      formatTreeAccessibilityLabel("es", "tag", "@smoke", containerResultStateLabel("es", "failed")),
      "Etiqueta. Fallido. @smoke.",
    );
    assert.strictEqual(formatTreeAccessibilityLabel("en", "summary", "3 of 5", "Running"), "Summary. Running. 3 of 5.");
    assert.strictEqual(formatTreeAccessibilityLabel("es", "guide", "Selecciona un proyecto"), "Aviso. Selecciona un proyecto.");
  });

  it("states the scenario level in the tooltip only for native precision", () => {
    const shared = buildScenarioTooltipMarkdown(
      {
        scenarioName: "System is ready",
        featureName: "Smoke",
        fileName: "Smoke.feature",
        line: 4,
        featureTags: [],
        scenarioTags: ["smoke"],
        isOutline: false,
      },
      "en",
    );
    assert.strictEqual(prependScenarioLevelTooltip(shared, "en", "classic"), shared);
    const experimental = prependScenarioLevelTooltip(shared, "es", "nativePrecision");
    assert.ok(experimental.startsWith("_Escenario_\n\n**System is ready**"));
    const outline = buildScenarioTooltipMarkdown(
      {
        scenarioName: "Add two numbers",
        featureName: "Smoke",
        fileName: "Smoke.feature",
        line: 8,
        featureTags: [],
        scenarioTags: [],
        isOutline: true,
        exampleCount: 2,
        exampleRowLabel: "first=5, second=7 +1",
      },
      "en",
    );
    assert.match(outline, /_Scenario Outline_/);
    assert.match(outline, /Example row: `first=5, second=7 \+1`/);
  });

  it("uses level glyphs only before results and keeps native status icons", () => {
    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "classic",
        level: "scenario",
        classicBareOutline: false,
        outcome: undefined,
        skipReason: undefined,
        sessionHasResults: false,
      }),
      { id: "beaker" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "classic",
        level: "outline",
        classicBareOutline: true,
        outcome: undefined,
        skipReason: undefined,
        sessionHasResults: false,
      }),
      { id: "list-tree" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "classic",
        level: "outline",
        classicBareOutline: false,
        outcome: undefined,
        skipReason: undefined,
        sessionHasResults: false,
      }),
      { id: "beaker" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "classic",
        level: "example",
        classicBareOutline: false,
        outcome: undefined,
        skipReason: undefined,
        sessionHasResults: false,
      }),
      { id: "beaker" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "classic",
        level: "outline",
        classicBareOutline: true,
        outcome: undefined,
        skipReason: undefined,
        sessionHasResults: true,
      }),
      { id: "list-tree" },
    );

    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "nativePrecision",
        level: "scenario",
        classicBareOutline: false,
        outcome: undefined,
        skipReason: undefined,
        sessionHasResults: false,
      }),
      { id: "beaker" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "nativePrecision",
        level: "outline",
        classicBareOutline: false,
        outcome: undefined,
        skipReason: undefined,
        sessionHasResults: false,
      }),
      { id: "table" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "nativePrecision",
        level: "example",
        classicBareOutline: false,
        outcome: undefined,
        skipReason: undefined,
        sessionHasResults: false,
      }),
      { id: "symbol-parameter" },
    );

    const mixed = { presentation: "nativePrecision" as const, classicBareOutline: false, sessionHasResults: true };
    assert.deepStrictEqual(
      resolveLeafIconSpec({ ...mixed, level: "scenario", outcome: "passed", skipReason: undefined }),
      { id: "pass", color: "passed" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({ ...mixed, level: "outline", outcome: "failed", skipReason: undefined }),
      { id: "error", color: "failed" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({ ...mixed, level: "example", outcome: "skipped", skipReason: undefined }),
      { id: "circle-slash", color: "skipped" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({ ...mixed, level: "example", outcome: undefined, skipReason: "not_in_trx" }),
      { id: "question", color: "skipped" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({ ...mixed, level: "scenario", outcome: undefined, skipReason: undefined }),
      { id: "circle-outline" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({ ...mixed, level: "outline", outcome: undefined, skipReason: undefined }),
      { id: "circle-outline" },
    );
  });

  it("rescans features for every bddPilot setting except a presentation-only change", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      contributes: { configuration: { properties: Record<string, unknown> } };
    };
    const contributed = Object.keys(pkg.contributes.configuration.properties)
      .filter((key) => key.startsWith("bddPilot."))
      .sort();
    assert.deepStrictEqual(
      [...FEATURE_DISCOVERY_CONFIGURATION_KEYS].sort(),
      contributed.filter((key) => key !== TREE_PRESENTATION_CONFIGURATION),
    );
    assert.ok(contributed.includes(TREE_PRESENTATION_CONFIGURATION));

    assert.strictEqual(shouldRediscoverFeatures(() => false), false);
    assert.strictEqual(
      shouldRediscoverFeatures(affectsChanged([TREE_PRESENTATION_CONFIGURATION])),
      false,
    );
    for (const key of FEATURE_DISCOVERY_CONFIGURATION_KEYS) {
      assert.strictEqual(shouldRediscoverFeatures(affectsChanged([key])), true, key);
    }
    assert.strictEqual(
      shouldRediscoverFeatures(affectsChanged([TREE_PRESENTATION_CONFIGURATION, "bddPilot.locale"])),
      true,
    );
    assert.strictEqual(
      shouldRediscoverFeatures(affectsChanged([TREE_PRESENTATION_CONFIGURATION, "bddPilot.tree.groupBy"])),
      true,
    );
  });
});
