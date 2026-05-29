import { OutlineExample } from "../gherkin/model";

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Heuristic match between a TRX testName (fully qualified method name) and a
 * scenario display name.
 */
export function matchesScenario(testName: string, scenarioName: string): boolean {
  return normalizeName(testName).includes(normalizeName(scenarioName));
}

/**
 * Narrows a theory/outline result to a specific Examples row by checking that
 * each non-empty cell value appears in the test name.
 */
export function matchesOutlineExample(testName: string, example: OutlineExample): boolean {
  const normalizedTest = normalizeName(testName);
  return example.values.every((value) => {
    const trimmed = value.trim();
    return trimmed.length === 0 || normalizedTest.includes(normalizeName(trimmed));
  });
}

export function findOutlineExampleMatch(
  testName: string,
  scenarioName: string,
  examples: OutlineExample[],
): OutlineExample | undefined {
  if (!matchesScenario(testName, scenarioName)) {
    return undefined;
  }
  if (examples.length === 1) {
    return examples[0];
  }
  return examples.find((ex) => matchesOutlineExample(testName, ex));
}
