export interface OutlineExample {
  /** 0-based index among data rows (excluding the header). */
  rowIndex: number;
  /** 1-based line number of this Examples row in the .feature file. */
  line: number;
  /** Column headers from the Examples table. */
  headers: string[];
  /** Cell values aligned with headers. */
  values: string[];
  /** Short label for tree rows, e.g. `contract_id=invalid-guid`. */
  label: string;
}

export interface ScenarioInfo {
  /** Scenario or Scenario Outline name. */
  name: string;
  /** Tags directly on the scenario (without the leading '@'). */
  tags: string[];
  /** 1-based line number where the scenario keyword appears. */
  line: number;
  isOutline: boolean;
  /** Populated for Scenario Outlines that declare an Examples table. */
  examples?: OutlineExample[];
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
