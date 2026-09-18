import { PilotLocale, t } from "../i18n";
import { DomainGroup } from "../gherkin/model";
import { deriveDomain } from "../gherkin/grouping";
import { TestResult } from "../results/trxParser";
import { classifyOneMessage, FailureBucket } from "./classifyFailedTests";
import {
  resolveFeatureForFailedTest,
  REVIEW_BUCKET_ORDER,
} from "./diagnosticsByDomain";

export { REVIEW_BUCKET_ORDER };

export const MAX_TRIAGE_BUCKETS_SHOWN = 3;

export interface FailureTriageBucketCount {
  bucket: FailureBucket;
  count: number;
}

export interface FailureTriage {
  topBucket: FailureBucket;
  counts: Partial<Record<FailureBucket, number>>;
  /** Non-zero buckets in review order, capped for display. */
  orderedBuckets: FailureTriageBucketCount[];
  hotspotDomain?: string;
  hotspotFailCount?: number;
}

function uniqueFailedResults(results: readonly TestResult[]): TestResult[] {
  const failed = results.filter((row) => row.outcome === "failed");
  const seen = new Set<string>();
  const unique: TestResult[] = [];
  for (const row of failed) {
    const id = row.executionId?.trim() || `${row.testId ?? ""}|${row.testName}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(row);
  }
  return unique;
}

/**
 * Build review-first triage from failed TRX rows.
 * Returns undefined when there are no unique failed rows.
 */
export function buildFailureTriage(
  results: readonly TestResult[],
  domains: DomainGroup[],
): FailureTriage | undefined {
  const failed = uniqueFailedResults(results);
  if (failed.length === 0) {
    return undefined;
  }

  const counts: Partial<Record<FailureBucket, number>> = {};
  const domainFailCounts = new Map<string, number>();

  for (const row of failed) {
    const bucket = classifyOneMessage(row.errorMessage ?? "");
    counts[bucket] = (counts[bucket] ?? 0) + 1;
    const feature = resolveFeatureForFailedTest(row.testName, domains);
    if (feature) {
      const domain = deriveDomain(feature.filePath);
      domainFailCounts.set(domain, (domainFailCounts.get(domain) ?? 0) + 1);
    }
  }

  const topBucket = REVIEW_BUCKET_ORDER.find((bucket) => (counts[bucket] ?? 0) > 0);
  if (!topBucket) {
    return undefined;
  }

  const orderedBuckets = REVIEW_BUCKET_ORDER.filter((bucket) => (counts[bucket] ?? 0) > 0)
    .map((bucket) => ({ bucket, count: counts[bucket]! }))
    .slice(0, MAX_TRIAGE_BUCKETS_SHOWN);

  let hotspotDomain: string | undefined;
  let hotspotFailCount: number | undefined;
  if (domainFailCounts.size > 0) {
    const ranked = [...domainFailCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    const top = ranked[0]!;
    hotspotDomain = top[0];
    hotspotFailCount = top[1];
  }

  return {
    topBucket,
    counts,
    orderedBuckets,
    hotspotDomain,
    hotspotFailCount,
  };
}

function formatBucketList(
  ordered: FailureTriageBucketCount[],
  locale: PilotLocale,
): string {
  const parts = ordered.map((row) => `${row.bucket} (${row.count})`);
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  const thenWord = t(locale, "log.reviewFirstThen");
  if (parts.length === 2) {
    return `${parts[0]} · ${thenWord} ${parts[1]}`;
  }
  return `${parts[0]} · ${thenWord} ${parts[1]} · ${parts[2]}`;
}

/** Output lines for Results (include `[bdd-pilot]` prefix). */
export function formatFailureTriageLines(
  triage: FailureTriage,
  locale: PilotLocale,
): string[] {
  const lines: string[] = [
    t(locale, "log.reviewFirst", { buckets: formatBucketList(triage.orderedBuckets, locale) }),
  ];
  if (triage.hotspotDomain && triage.hotspotFailCount != null) {
    lines.push(
      t(locale, "log.hotspot", {
        domain: triage.hotspotDomain,
        count: triage.hotspotFailCount,
      }),
    );
  }
  return lines;
}

/** Short toast fragment: `Review first: pending (12)`. */
export function formatFailureTriageToastHint(
  triage: FailureTriage,
  locale: PilotLocale,
): string {
  const top = triage.orderedBuckets[0] ?? {
    bucket: triage.topBucket,
    count: triage.counts[triage.topBucket] ?? 0,
  };
  return t(locale, "toast.reviewFirstHint", {
    bucket: top.bucket,
    count: top.count,
  });
}
