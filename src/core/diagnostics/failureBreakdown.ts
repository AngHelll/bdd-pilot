import { PilotLocale, t } from "../i18n";
import {
  ClassifiedFailures,
  classifiedCounts,
  classifyFailedTests,
  classifyFromLog,
} from "./classifyFailedTests";
import { TrxSummary } from "../results/trxParser";

export function resolveClassifiedFailures(
  output: string,
  trxSummary?: TrxSummary,
): ClassifiedFailures {
  if (trxSummary) {
    return classifyFailedTests(trxSummary.results);
  }
  return classifyFromLog(output);
}

export function failureBreakdown(
  output: string,
  locale: PilotLocale,
  _extendedRules: boolean,
  trxSummary?: TrxSummary,
): string | undefined {
  return formatClassifiedBreakdown(resolveClassifiedFailures(output, trxSummary), locale);
}

export function formatClassifiedBreakdown(
  classified: ClassifiedFailures,
  locale: PilotLocale,
): string | undefined {
  const counts = classifiedCounts(classified);
  const parts: string[] = [];
  if (counts.pending > 0) {
    parts.push(t(locale, "diagnostic.breakdown.pending", { n: counts.pending }));
  }
  if (counts.testData > 0) {
    parts.push(t(locale, "diagnostic.breakdown.testData", { n: counts.testData }));
  }
  if (counts.http > 0) {
    parts.push(t(locale, "diagnostic.breakdown.apiHttp", { n: counts.http }));
  }
  if (counts.aws > 0) {
    parts.push(t(locale, "diagnostic.breakdown.cloudCreds", { n: counts.aws }));
  }
  if (counts.assert > 0) {
    parts.push(t(locale, "diagnostic.breakdown.assert", { n: counts.assert }));
  }
  if (counts.code > 0) {
    parts.push(t(locale, "diagnostic.breakdown.code", { n: counts.code }));
  }
  if (counts.other > 0) {
    parts.push(t(locale, "diagnostic.breakdown.other", { n: counts.other }));
  }
  return parts.length > 0 ? parts.join("; ") : undefined;
}
