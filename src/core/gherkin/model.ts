export interface ScenarioInfo {
  /** Scenario or Scenario Outline name. */
  name: string;
  /** Tags directly on the scenario (without the leading '@'). */
  tags: string[];
  /** 1-based line number where the scenario keyword appears. */
  line: number;
  isOutline: boolean;
}

export interface FeatureInfo {
  /** Feature name from the `Feature:` line. */
  name: string;
  /** Absolute path to the .feature file. */
  filePath: string;
  /** Tags declared at feature level (without the leading '@'). */
  tags: string[];
  scenarios: ScenarioInfo[];
}

/**
 * Logical domain grouping derived from the feature file path, e.g.
 * Features/Trading/BuyingPower/BuyingPower.feature -> "Trading".
 */
export interface DomainGroup {
  name: string;
  features: FeatureInfo[];
}
