import { DomainGroup } from "../gherkin/model";
import { truncateErrorSnippet } from "./outcomeFeedback";
import { outlineRowKey, scenarioKey } from "../runner/runScope";
import { TestOutcome } from "./trxParser";

export interface StoreOutcomeReader {
  get(key: string): TestOutcome | undefined;
  getErrorMessage(key: string): string | undefined;
}

/** First failed scenario/outline error in tree walk order (for summary chip fallback). */
export function resolveFirstStoreFailureSnippet(
  store: StoreOutcomeReader,
  domains: DomainGroup[],
): string | undefined {
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            const key = outlineRowKey(feature, scenario, example.rowIndex);
            const snippet = failedSnippetForKey(store, key);
            if (snippet) {
              return snippet;
            }
          }
        } else {
          const snippet = failedSnippetForKey(store, scenarioKey(feature, scenario));
          if (snippet) {
            return snippet;
          }
        }
      }
    }
  }
  return undefined;
}

function failedSnippetForKey(store: StoreOutcomeReader, key: string): string | undefined {
  if (store.get(key) !== "failed") {
    return undefined;
  }
  const errorMessage = store.getErrorMessage(key);
  if (!errorMessage?.trim()) {
    return undefined;
  }
  return truncateErrorSnippet(errorMessage);
}

export function storeHasFailures(
  store: StoreOutcomeReader,
  domains: DomainGroup[],
): boolean {
  return resolveFirstStoreFailureSnippet(store, domains) !== undefined;
}
