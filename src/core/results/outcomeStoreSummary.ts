import { DomainGroup } from "../gherkin/model";
import { OutcomeRollup, computeRollup } from "../gherkin/outcomeRollup";
import { collectScenarioOutcomeValues, OutcomeReader } from "../gherkin/testExplorerLabels";
import { TestOutcome } from "./trxParser";

/** Aggregates all discovered leaf outcomes from the store (same scope as tree roll-ups). */
export function summarizeOutcomeStore(
  store: OutcomeReader,
  domains: DomainGroup[],
): OutcomeRollup | undefined {
  const values: Array<TestOutcome | undefined> = [];
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        values.push(...collectScenarioOutcomeValues(feature, scenario, store));
      }
    }
  }
  const rollup = computeRollup(values);
  return rollup.withResults > 0 ? rollup : undefined;
}
