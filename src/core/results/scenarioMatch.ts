import { FeatureInfo, OutlineExample, ScenarioInfo } from "../gherkin/model";
import {
  DEFAULT_FILTER_MAPPING,
  FilterMappingConfig,
  toReqnrollParamName,
} from "../runner/filterMapping";
import { featureClassName, sanitizeIdentifier } from "../runner/filterBuilder";
import { parseTheoryDisplayName, ParsedTheoryDisplayName } from "../runner/theoryDisplayName";

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Legacy heuristic: TRX testName contains the scenario display name
 * (case/punctuation-insensitive). Prefer {@link matchesScenarioInFeature} when
 * the feature is known.
 */
export function matchesScenario(testName: string, scenarioName: string): boolean {
  return normalizeName(testName).includes(normalizeName(scenarioName));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `ClassName` appears as a FQN segment before a method. */
export function containsFeatureClassToken(testName: string, className: string): boolean {
  if (!className) {
    return false;
  }
  const re = new RegExp(`(^|[.])${escapeRegExp(className)}\\.`, "i");
  return re.test(testName);
}

/**
 * True when the test name already looks like a Reqnroll/SpecFlow feature-class
 * FQN (configured suffix, default `Feature`). Used to suppress legacy
 * `includes` fallback that would cross-attribute same-titled scenarios.
 */
export function looksLikeFeatureClassFqn(
  testName: string,
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): boolean {
  const suffix = mapping.featureClassSuffix;
  if (suffix) {
    const re = new RegExp(`(^|[.])[A-Za-z_][A-Za-z0-9_]*${escapeRegExp(suffix)}\\.`, "i");
    return re.test(testName);
  }
  return /(?:^|[.])[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*(?=$|[.(])/.test(testName);
}

/**
 * True when `Class.Method` appears as a FQN segment (method may be followed by
 * end-of-string, `.`, or `(` for Theory args).
 */
export function matchesScenarioFqn(
  testName: string,
  className: string,
  methodName: string,
): boolean {
  if (!className || !methodName) {
    return false;
  }
  const re = new RegExp(
    `(^|[.])${escapeRegExp(className)}\\.${escapeRegExp(methodName)}(?=$|[.(])`,
    "i",
  );
  return re.test(testName);
}

/**
 * FQN-first match: prefer `FeatureClass.ScenarioMethod` tokens (Reqnroll), then
 * fall back to legacy name includes only when the test name does not look like
 * a feature-class FQN (odd / legacy formats).
 */
export function matchesScenarioInFeature(
  testName: string,
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): boolean {
  const className = featureClassName(feature.name, mapping);
  const methodName = sanitizeIdentifier(scenario.name);
  if (className && methodName && containsFeatureClassToken(testName, className)) {
    return matchesScenarioFqn(testName, className, methodName);
  }
  if (looksLikeFeatureClassFqn(testName, mapping)) {
    return false;
  }
  return matchesScenario(testName, scenario.name);
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

function theoryCandidateFromTestName(testName: string): string {
  if (parseTheoryDisplayName(testName)) {
    return testName;
  }
  const open = testName.indexOf("(");
  if (open <= 0 || !testName.endsWith(")")) {
    return testName;
  }
  const beforeParen = testName.slice(0, open);
  const lastDot = beforeParen.lastIndexOf(".");
  const title = (lastDot >= 0 ? beforeParen.slice(lastDot + 1) : beforeParen).trim();
  if (!title) {
    return testName;
  }
  return `${title}${testName.slice(open)}`;
}

function paramNamesEquivalent(header: string, theoryParamName: string): boolean {
  const candidates = [header, toReqnrollParamName(header)].map((n) => n.toLowerCase());
  const theory = theoryParamName.toLowerCase();
  return candidates.includes(theory);
}

/**
 * Match Outline row via Reqnroll/xUnit Theory `name: "value"` params.
 * Returns `undefined` when the test name is not a Theory display name.
 */
export function matchesOutlineExampleTheory(
  testName: string,
  example: OutlineExample,
): boolean | undefined {
  const parsed: ParsedTheoryDisplayName | undefined = parseTheoryDisplayName(
    theoryCandidateFromTestName(testName),
  );
  if (!parsed) {
    return undefined;
  }

  for (let i = 0; i < example.headers.length; i++) {
    const header = example.headers[i] ?? "";
    const value = (example.values[i] ?? "").trim();
    if (!value) {
      continue;
    }
    const found = parsed.params.some(
      (param) => paramNamesEquivalent(header, param.name) && param.value === value,
    );
    if (!found) {
      return false;
    }
  }
  return true;
}

function pickOutlineExample(testName: string, examples: OutlineExample[]): OutlineExample | undefined {
  if (examples.length === 1) {
    return examples[0];
  }
  const byTheory = examples.find((ex) => matchesOutlineExampleTheory(testName, ex) === true);
  if (byTheory) {
    return byTheory;
  }
  return examples.find((ex) => matchesOutlineExample(testName, ex));
}

/**
 * Legacy outline match (scenario name only). Prefer
 * {@link findOutlineExampleMatchInFeature} when feature is known.
 */
export function findOutlineExampleMatch(
  testName: string,
  scenarioName: string,
  examples: OutlineExample[],
): OutlineExample | undefined {
  if (!matchesScenario(testName, scenarioName)) {
    return undefined;
  }
  return pickOutlineExample(testName, examples);
}

/** Outline match gated by FQN-first scenario identity. */
export function findOutlineExampleMatchInFeature(
  testName: string,
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  examples: OutlineExample[],
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): OutlineExample | undefined {
  if (!matchesScenarioInFeature(testName, feature, scenario, mapping)) {
    return undefined;
  }
  return pickOutlineExample(testName, examples);
}
