import { PilotLocale, t } from "../i18n";

function countMatches(output: string, pattern: RegExp): number {
  return (output.match(pattern) ?? []).length;
}

export function failureBreakdown(
  output: string,
  locale: PilotLocale,
  extendedRules: boolean,
): string | undefined {
  const pending = countMatches(output, /XUnitPendingStepException|No matching step definition found/gi);
  const testData = countMatches(
    output,
    /No available users|No suitable user|No hay usuarios|test user|test data|fixture|The array cannot be null or empty/gi,
  );
  const nullRef = countMatches(output, /NullReferenceException/gi);
  const refit = countMatches(output, /Refit\.ApiException/gi);
  const aws = countMatches(output, /The security token included in the request is invalid/gi);
  const ambiguous = countMatches(output, /Ambiguous step definitions found/gi);

  const parts: string[] = [];
  if (pending > 0) {
    parts.push(t(locale, "diagnostic.breakdown.pending", { n: pending }));
  }
  if (testData > 0) {
    parts.push(t(locale, "diagnostic.breakdown.testData", { n: testData }));
  }
  if (nullRef > 0) {
    parts.push(t(locale, "diagnostic.breakdown.nullRef", { n: nullRef }));
  }
  if (extendedRules && refit > 0) {
    parts.push(t(locale, "diagnostic.breakdown.apiHttp", { n: refit }));
  }
  if (extendedRules && aws > 0) {
    parts.push(t(locale, "diagnostic.breakdown.cloudCreds", { n: aws }));
  }
  if (ambiguous > 0) {
    parts.push(t(locale, "diagnostic.breakdown.ambiguous", { n: ambiguous }));
  }

  return parts.length > 0 ? parts.join("; ") : undefined;
}
