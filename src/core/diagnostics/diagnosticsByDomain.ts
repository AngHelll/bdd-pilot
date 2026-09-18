import { PilotLocale, t } from "../i18n";
import { DomainGroup, FeatureInfo } from "../gherkin/model";
import { deriveDomain } from "../gherkin/grouping";
import { matchesScenarioInFeature } from "../results/scenarioMatch";
import { TestResult } from "../results/trxParser";
import { classifyOneMessage, FailureBucket } from "./classifyFailedTests";

/** Internal key when TRX failed row matches no Gherkin leaf. */
export const UNMAPPED_DOMAIN_KEY = "unmapped";

export const MIN_DOMAINS_WITH_FAILS = 2;
export const MIN_TOTAL_FAILS = 3;
export const MAX_DOMAINS_SHOWN = 8;
export const MAX_BUCKETS_PER_DOMAIN = 4;

/** Review-first priority (pending/fixture before asserts). Shared with failure triage. */
export const REVIEW_BUCKET_ORDER: FailureBucket[] = [
  "pending",
  "testData",
  "http",
  "aws",
  "assert",
  "code",
  "other",
];

export type DomainBucketCounts = Partial<Record<FailureBucket, number>>;

export interface DiagnosticsByDomainRollUp {
  /** Domain name → bucket counts (only buckets with count > 0). */
  byDomain: Map<string, DomainBucketCounts>;
  totalFails: number;
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

/** First feature whose scenario matches the TRX display/FQN name. */
export function resolveFeatureForFailedTest(
  testName: string,
  domains: DomainGroup[],
): FeatureInfo | undefined {
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (matchesScenarioInFeature(testName, feature, scenario)) {
          return feature;
        }
      }
    }
  }
  return undefined;
}

export function buildDiagnosticsByDomainRollUp(
  results: readonly TestResult[],
  domains: DomainGroup[],
): DiagnosticsByDomainRollUp {
  const byDomain = new Map<string, DomainBucketCounts>();
  const failed = uniqueFailedResults(results);
  for (const row of failed) {
    const bucket = classifyOneMessage(row.errorMessage ?? "");
    const feature = resolveFeatureForFailedTest(row.testName, domains);
    const domainKey = feature ? deriveDomain(feature.filePath) : UNMAPPED_DOMAIN_KEY;
    const counts = byDomain.get(domainKey) ?? {};
    counts[bucket] = (counts[bucket] ?? 0) + 1;
    byDomain.set(domainKey, counts);
  }
  return { byDomain, totalFails: failed.length };
}

export function domainFailTotal(counts: DomainBucketCounts): number {
  let n = 0;
  for (const bucket of REVIEW_BUCKET_ORDER) {
    n += counts[bucket] ?? 0;
  }
  return n;
}

export function shouldEmitDiagnosticsByDomain(rollUp: DiagnosticsByDomainRollUp): boolean {
  if (rollUp.totalFails < MIN_TOTAL_FAILS) {
    return false;
  }
  let domainsWithFails = 0;
  for (const counts of rollUp.byDomain.values()) {
    if (domainFailTotal(counts) > 0) {
      domainsWithFails += 1;
    }
  }
  return domainsWithFails >= MIN_DOMAINS_WITH_FAILS;
}

function topBuckets(counts: DomainBucketCounts, maxBuckets: number): string[] {
  const entries = REVIEW_BUCKET_ORDER.map((bucket) => ({
    bucket,
    count: counts[bucket] ?? 0,
  })).filter((e) => e.count > 0);
  entries.sort((a, b) => b.count - a.count || a.bucket.localeCompare(b.bucket));
  return entries.slice(0, maxBuckets).map((e) => `${e.bucket}=${e.count}`);
}

function domainDisplayName(domainKey: string, locale: PilotLocale): string {
  if (domainKey === UNMAPPED_DOMAIN_KEY) {
    return t(locale, "diagnostic.byDomain.unmapped");
  }
  return domainKey;
}

export interface FormatDiagnosticsByDomainOptions {
  maxDomains?: number;
  maxBucketsPerDomain?: number;
}

/**
 * Output lines for the by-domain roll-up (no leading blank — caller may add).
 * Returns [] when thresholds not met.
 */
export function formatDiagnosticsByDomainLines(
  rollUp: DiagnosticsByDomainRollUp,
  locale: PilotLocale,
  options?: FormatDiagnosticsByDomainOptions,
): string[] {
  if (!shouldEmitDiagnosticsByDomain(rollUp)) {
    return [];
  }
  const maxDomains = options?.maxDomains ?? MAX_DOMAINS_SHOWN;
  const maxBuckets = options?.maxBucketsPerDomain ?? MAX_BUCKETS_PER_DOMAIN;

  const ranked = [...rollUp.byDomain.entries()]
    .map(([domain, counts]) => ({ domain, counts, total: domainFailTotal(counts) }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.domain.localeCompare(b.domain));

  const shown = ranked.slice(0, maxDomains);
  const remaining = ranked.length - shown.length;
  const lines: string[] = [t(locale, "diagnostic.byDomain.header")];
  for (const row of shown) {
    const buckets = topBuckets(row.counts, maxBuckets).join(", ");
    const label = domainDisplayName(row.domain, locale);
    lines.push(
      t(locale, "diagnostic.byDomain.line", {
        domain: label,
        buckets,
        total: row.total,
      }),
    );
  }
  if (remaining > 0) {
    lines.push(t(locale, "diagnostic.byDomain.more", { count: remaining }));
  }
  return lines;
}
