import { PilotLocale, t } from "../i18n";
import { formatDuration, DurationDisplayMode } from "../results/durationFormat";
import { TestOutcome } from "../results/trxParser";
import { outlineRowKey, scenarioKey } from "../runner/runScope";
import { TagGroup } from "./groupByTag";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "./model";
import { computeRollup } from "./outcomeRollup";
import { effectiveScenarioTags } from "./tags";
import {
  buildContainerDescription,
  buildOutlineParentDescription,
  effectiveLeafTagDisplay,
  TreeDisplayMode,
} from "./treeContainerLabels";
import {
  buildFeatureDescription,
  buildScenarioDescription,
  joinDescriptionParts,
  TagDisplayMode,
} from "./treeLabels";

export interface TestExplorerDisplaySettings {
  displayMode: TreeDisplayMode;
  tagDisplay: TagDisplayMode;
  compactTagLimit: number;
  durationDisplay: DurationDisplayMode;
}

export interface OutcomeReader {
  get(key: string): TestOutcome | undefined;
  getDuration(key: string): number | undefined;
}

export function formatOutcomeLabel(outcome: TestOutcome, locale: PilotLocale): string {
  switch (outcome) {
    case "passed":
      return t(locale, "outcome.passed");
    case "failed":
      return t(locale, "outcome.failed");
    case "skipped":
      return t(locale, "outcome.skipped");
    default:
      return outcome;
  }
}

export function collectScenarioOutcomeValues(
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  store: OutcomeReader,
): Array<TestOutcome | undefined> {
  if (scenario.examples && scenario.examples.length > 0) {
    return scenario.examples.map((ex) => store.get(outlineRowKey(feature, scenario, ex.rowIndex)));
  }
  return [store.get(scenarioKey(feature, scenario))];
}

export function buildTestExplorerLeafDescription(
  outcome: TestOutcome | undefined,
  durationMs: number | undefined,
  display: TestExplorerDisplaySettings,
  locale: PilotLocale,
  contextLabel?: string,
): string | undefined {
  const outcomeLabel = outcome ? formatOutcomeLabel(outcome, locale) : undefined;
  const durationLabel =
    durationMs !== undefined ? formatDuration(durationMs, display.durationDisplay) : undefined;
  const joined = joinDescriptionParts(outcomeLabel, durationLabel, contextLabel);
  return joined.length > 0 ? joined : undefined;
}

export function buildTestExplorerOutlineRowDescription(
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  store: OutcomeReader,
  display: TestExplorerDisplaySettings,
  locale: PilotLocale,
  rowIndex: number,
): string | undefined {
  const key = outlineRowKey(feature, scenario, rowIndex);
  const outcome = store.get(key);
  const durationMs = store.getDuration(key);
  const tags = effectiveScenarioTags(feature, scenario);
  const tagPart = buildScenarioDescription(
    tags,
    effectiveLeafTagDisplay(display.displayMode, display.tagDisplay),
    display.compactTagLimit,
    undefined,
  );
  return buildTestExplorerLeafDescription(outcome, durationMs, display, locale, tagPart || undefined);
}

export function buildTestExplorerScenarioDescription(
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  store: OutcomeReader,
  display: TestExplorerDisplaySettings,
  locale: PilotLocale,
  underTagGroup: boolean,
): string | undefined {
  const hasExamples = scenario.examples && scenario.examples.length > 0;
  const tags = effectiveScenarioTags(feature, scenario);
  // Parity with BDD tree: feature hint under tag groups only in detailed mode.
  const featureHint =
    underTagGroup && display.displayMode === "detailed" ? feature.name : undefined;

  if (hasExamples) {
    const rollup = computeRollup(collectScenarioOutcomeValues(feature, scenario, store));
    const base = buildScenarioDescription(
      tags,
      display.tagDisplay,
      display.compactTagLimit,
      undefined,
      featureHint,
    );
    const desc = buildOutlineParentDescription(
      display.displayMode,
      rollup,
      scenario.examples!.length,
      locale,
      base,
    );
    return desc.length > 0 ? desc : undefined;
  }

  const key = scenarioKey(feature, scenario);
  return buildTestExplorerLeafDescription(
    store.get(key),
    store.getDuration(key),
    display,
    locale,
    featureHint,
  );
}

export function buildTestExplorerFeatureDescription(
  feature: FeatureInfo,
  store: OutcomeReader,
  display: TestExplorerDisplaySettings,
  locale: PilotLocale,
): string {
  const scenarioCount = feature.scenarios.length;
  const values: Array<TestOutcome | undefined> = [];
  for (const scenario of feature.scenarios) {
    values.push(...collectScenarioOutcomeValues(feature, scenario, store));
  }
  const rollup = computeRollup(values);
  const base = buildFeatureDescription(
    scenarioCount,
    feature.tags,
    display.tagDisplay,
    display.compactTagLimit,
  );
  return buildContainerDescription(display.displayMode, rollup, base, locale);
}

export function buildTestExplorerDomainDescription(
  domain: DomainGroup,
  store: OutcomeReader,
  display: TestExplorerDisplaySettings,
  locale: PilotLocale,
): string {
  const scenarioCount = domain.features.reduce((n, f) => n + f.scenarios.length, 0);
  const values: Array<TestOutcome | undefined> = [];
  for (const feature of domain.features) {
    for (const scenario of feature.scenarios) {
      values.push(...collectScenarioOutcomeValues(feature, scenario, store));
    }
  }
  const rollup = computeRollup(values);
  const featurePart =
    domain.features.length === 1 ? "1 feature" : `${domain.features.length} features`;
  const scenarioPart = scenarioCount === 1 ? "1 scenario" : `${scenarioCount} scenarios`;
  const base = `${featurePart} · ${scenarioPart}`;
  return buildContainerDescription(display.displayMode, rollup, base, locale);
}

export function buildTestExplorerTagDescription(
  group: TagGroup,
  store: OutcomeReader,
  display: TestExplorerDisplaySettings,
  locale: PilotLocale,
): string {
  const values = group.scenarios.flatMap((ref) =>
    collectScenarioOutcomeValues(ref.feature, ref.scenario, store),
  );
  const rollup = computeRollup(values);
  const base = `${group.scenarios.length} scenario${group.scenarios.length === 1 ? "" : "s"}`;
  return buildContainerDescription(display.displayMode, rollup, base, locale);
}
