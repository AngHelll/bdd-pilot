import { PilotLocale, t, MessageKey } from "../i18n";
import {
  formatExampleIdentityLabel,
  formatOutlineIdentityLabel,
  formatScenarioIdentityLabel,
} from "./treeLabels";
import { formatOutcomeForTooltip } from "../results/outcomeFeedback";
import { SkipReason } from "../results/skipReason";
import { TestOutcome } from "../results/trxParser";

/** Tree row presentation. Native Precision is the default; classic is opt-in. */
export type TreePresentation = "classic" | "nativePrecision";

export const DEFAULT_TREE_PRESENTATION: TreePresentation = "nativePrecision";

export type TreeLeafLevel = "scenario" | "outline" | "example";

export type TreeA11yLevel =
  | "summary"
  | "domain"
  | "tag"
  | "feature"
  | "scenario"
  | "outline"
  | "example"
  | "guide";

export const TREE_PRESENTATION_CONFIGURATION = "bddPilot.tree.presentation";

/**
 * bddPilot settings whose change still rescans feature files.
 * `tree.presentation` is absent on purpose: it only changes how rows are painted.
 */
export const FEATURE_DISCOVERY_CONFIGURATION_KEYS = [
  "bddPilot.locale",
  "bddPilot.dashboard.theme",
  "bddPilot.statusBar.display",
  "bddPilot.projectPath",
  "bddPilot.defaultStage",
  "bddPilot.defaultMode",
  "bddPilot.requireConfirmationForStages",
  "bddPilot.security.allowProductionRuns",
  "bddPilot.preRun.bindingGate",
  "bddPilot.diagnostics.extendedRules",
  "bddPilot.dotnetPath",
  "bddPilot.run.configuration",
  "bddPilot.run.noBuild",
  "bddPilot.run.suggestScopedWhenLarge",
  "bddPilot.run.runSettings",
  "bddPilot.run.cliVerbosity",
  "bddPilot.run.blame",
  "bddPilot.run.blameHang",
  "bddPilot.run.blameHangTimeout",
  "bddPilot.run.byStage",
  "bddPilot.tree.displayMode",
  "bddPilot.tree.groupBy",
  "bddPilot.tree.searchRunCap",
  "bddPilot.tree.tagDisplay",
  "bddPilot.tree.compactTagLimit",
  "bddPilot.tree.durationDisplay",
  "bddPilot.filter.featureClassSuffix",
  "bddPilot.filter.tagTraitName",
  "bddPilot.filter.outlineRowFilter",
  "bddPilot.ai.enabled",
  "bddPilot.ai.contextMaxOutputLines",
  "bddPilot.ai.rehydrateFromTrx",
  "bddPilot.feedback.postRunToast",
  "bddPilot.feedback.diagnosticsInOutput",
  "bddPilot.feedback.dotnetVerbosity",
  "bddPilot.feedback.autoShowOutput",
  "bddPilot.outcomes.rehydrateOnActivate",
  "bddPilot.outcomes.rehydrateMaxAgeHours",
] as const;

const A11Y_LEVEL_KEY: Record<TreeA11yLevel, MessageKey> = {
  summary: "tree.a11y.levelSummary",
  domain: "tree.a11y.levelDomain",
  tag: "tree.a11y.levelTag",
  feature: "tree.a11y.levelFeature",
  scenario: "tree.a11y.levelScenario",
  outline: "tree.a11y.levelOutline",
  example: "tree.a11y.levelExample",
  guide: "tree.a11y.levelGuide",
};

/** Missing or unknown values use Native Precision. Only an explicit `classic` keeps the prefixed layout. */
export function parseTreePresentation(raw: string | undefined): TreePresentation {
  if (raw === "classic") {
    return "classic";
  }
  if (raw === "nativePrecision") {
    return "nativePrecision";
  }
  return DEFAULT_TREE_PRESENTATION;
}

/**
 * True when a configuration event must rescan features.
 * A change that touches only `bddPilot.tree.presentation` returns false.
 * Any other bddPilot change, including one combined with presentation, returns true.
 */
export function shouldRediscoverFeatures(affects: (section: string) => boolean): boolean {
  if (!affects("bddPilot")) {
    return false;
  }
  if (!affects(TREE_PRESENTATION_CONFIGURATION)) {
    return true;
  }
  return FEATURE_DISCOVERY_CONFIGURATION_KEYS.some((key) => affects(key));
}

/** Visible tree label. Classic keeps the shared prefixed formatters; Native Precision shows the name. */
export function formatTreeLeafLabel(
  level: TreeLeafLevel,
  name: string,
  locale: PilotLocale,
  presentation: TreePresentation,
): string {
  if (presentation === "nativePrecision") {
    return name;
  }
  if (level === "outline") {
    return formatOutlineIdentityLabel(name, locale);
  }
  if (level === "example") {
    return formatExampleIdentityLabel(name, locale);
  }
  return formatScenarioIdentityLabel(name, locale);
}

/**
 * Spoken label: level, state, and name.
 * State words come from the existing outcome catalog and are capitalized for the sentence.
 */
export function formatTreeAccessibilityLabel(
  locale: PilotLocale,
  level: TreeA11yLevel,
  name: string,
  state?: string,
): string {
  const levelLabel = t(locale, A11Y_LEVEL_KEY[level]);
  const nameLabel = name.trim();
  const stateLabel = state?.trim() ? capitalizeToken(state.trim()) : undefined;
  if (stateLabel && nameLabel) {
    return `${levelLabel}. ${stateLabel}. ${nameLabel}.`;
  }
  if (stateLabel) {
    return `${levelLabel}. ${stateLabel}.`;
  }
  if (nameLabel) {
    return `${levelLabel}. ${nameLabel}.`;
  }
  return `${levelLabel}.`;
}

/** Plain scenarios lose the "Scenario:" prefix, so the hover states the level once. */
export function prependScenarioLevelTooltip(
  markdown: string,
  locale: PilotLocale,
  presentation: TreePresentation,
): string {
  if (presentation !== "nativePrecision") {
    return markdown;
  }
  return `_${t(locale, "tree.a11y.levelScenario")}_\n\n${markdown}`;
}

export function leafResultStateLabel(
  locale: PilotLocale,
  outcome: TestOutcome | undefined,
  skipReason: SkipReason | undefined,
): string {
  if (skipReason === "not_in_trx") {
    return t(locale, "skip.notInTrx");
  }
  if (skipReason === "canceled") {
    return t(locale, "skip.canceled");
  }
  if (outcome === "passed" || outcome === "failed" || outcome === "skipped") {
    return formatOutcomeForTooltip(outcome, locale);
  }
  return t(locale, "tree.leafPending");
}

export function containerResultStateLabel(
  locale: PilotLocale,
  severity: "failed" | "passed" | "skipped" | undefined,
): string {
  if (!severity) {
    return t(locale, "tree.leafPending");
  }
  return formatOutcomeForTooltip(severity, locale);
}

function capitalizeToken(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
