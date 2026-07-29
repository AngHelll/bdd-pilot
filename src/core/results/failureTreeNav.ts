import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";
import { TestOutcome } from "./trxParser";
import { outlineRowKey, scenarioKey } from "../runner/runScope";

/** Minimal outcome lookup (matches OutcomeStore / OutcomeReader). */
export interface FailedLeafOutcomeReader {
  get(key: string): TestOutcome | undefined;
}

export interface FirstFailedLeaf {
  outcomeKey: string;
  featurePath: string;
  /** 1-based line in the .feature file (scenario or Examples row). */
  scenarioLine: number;
  label: string;
  feature: FeatureInfo;
  scenario: ScenarioInfo;
  /** Set when the failed leaf is an outline row. */
  outlineRowIndex?: number;
}

export type AutoShowOutputMode = "off" | "onFailure" | "always";

export function isAutoShowOutputMode(value: string | undefined): value is AutoShowOutputMode {
  return value === "off" || value === "onFailure" || value === "always";
}

/**
 * First failed leaf in discovery order: domain → feature → scenario → outline row.
 */
export function findFirstFailedLeaf(
  domains: readonly DomainGroup[],
  outcomes: FailedLeafOutcomeReader,
): FirstFailedLeaf | undefined {
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            const key = outlineRowKey(feature, scenario, example.rowIndex);
            if (outcomes.get(key) === "failed") {
              return {
                outcomeKey: key,
                featurePath: feature.filePath,
                scenarioLine: example.line,
                label: `${scenario.name} · ${example.label}`,
                feature,
                scenario,
                outlineRowIndex: example.rowIndex,
              };
            }
          }
          continue;
        }
        const key = scenarioKey(feature, scenario);
        if (outcomes.get(key) === "failed") {
          return {
            outcomeKey: key,
            featurePath: feature.filePath,
            scenarioLine: scenario.line,
            label: scenario.name,
            feature,
            scenario,
          };
        }
      }
    }
  }
  return undefined;
}

export type FailureNavContainerKind = "domain" | "feature" | "scenarioOutline";

export interface FailureNavContainerKey {
  kind: FailureNavContainerKind;
  /** Domain name, feature filePath, or scenario outcome key for outline parents. */
  id: string;
}

/**
 * Container ids that must stay expanded so every failed leaf is reachable
 * after collapseAll + re-expand.
 */
export function containerKeysToExpandForFailures(
  domains: readonly DomainGroup[],
  outcomes: FailedLeafOutcomeReader,
): FailureNavContainerKey[] {
  const seen = new Set<string>();
  const keys: FailureNavContainerKey[] = [];

  const add = (kind: FailureNavContainerKind, id: string): void => {
    const token = `${kind}:${id}`;
    if (seen.has(token)) {
      return;
    }
    seen.add(token);
    keys.push({ kind, id });
  };

  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          let outlineHasFailed = false;
          for (const example of scenario.examples) {
            const key = outlineRowKey(feature, scenario, example.rowIndex);
            if (outcomes.get(key) === "failed") {
              outlineHasFailed = true;
              break;
            }
          }
          if (outlineHasFailed) {
            add("domain", domain.name);
            add("feature", feature.filePath);
            add("scenarioOutline", scenarioKey(feature, scenario));
          }
          continue;
        }
        const key = scenarioKey(feature, scenario);
        if (outcomes.get(key) === "failed") {
          add("domain", domain.name);
          add("feature", feature.filePath);
        }
      }
    }
  }

  return keys;
}

export function shouldAutoShowOutput(
  mode: AutoShowOutputMode,
  opts: {
    exitCode: number | null;
    failed: number;
    canceled?: boolean;
  },
): boolean {
  if (mode === "off") {
    return false;
  }
  if (mode === "always") {
    return true;
  }
  if (opts.failed > 0) {
    return true;
  }
  if (opts.exitCode !== null && opts.exitCode !== 0) {
    return true;
  }
  return false;
}
