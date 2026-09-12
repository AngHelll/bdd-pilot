import * as path from "path";
import { sanitize } from "../../security/sanitizer";
import { deriveDomain } from "../gherkin/grouping";
import { DomainGroup } from "../gherkin/model";
import { TreeGroupBy } from "../gherkin/treeDisplaySettings";
import {
  MATCHING_DEBUG_CANDIDATE_CAP,
  MAPPING_LABEL_MAX_CHARS,
  selectCappedForOutput,
  truncateMappingLabel,
  UNMAPPED_OUTPUT_CAP,
} from "./mappingReportFormat";
import { MatchingDebugCandidateLeaf } from "./matchingDebugSession";
import { TreeMappingReport } from "./trxTreeMapping";
import {
  allocateUnusedSplitCaps,
  partitionUnusedTrx,
} from "./unusedTrxClassify";

export { MATCHING_DEBUG_CANDIDATE_CAP };
export type { MatchingDebugCandidateLeaf };

export interface MatchingDebugRunMeta {
  stage: string;
  mode: string;
  filter?: string;
  testTarget?: string;
  extensionVersion?: string;
}

/** Gap leaf with discovery path for Layout / grouping (D3). */
export interface MatchingDebugLayoutLeaf {
  label: string;
  featurePath: string;
  domain: string;
}

export interface MatchingDebugLayoutContext {
  projectDir: string;
  groupBy: TreeGroupBy;
  /** Unmapped (+ resolved ambiguous) leaves with paths; empty → paths unavailable. */
  leaves: MatchingDebugLayoutLeaf[];
}

export interface BuildMatchingDebugPackInput {
  report: TreeMappingReport;
  meta: MatchingDebugRunMeta;
  /** Precomputed from last apply; omit → report-only (no Candidates detail). */
  candidatesByLabel?: MatchingDebugCandidateLeaf[];
  /** D3 layout/grouping; omit → section with paths unavailable if gaps exist. */
  layout?: MatchingDebugLayoutContext;
}

export type MatchingHealthHint =
  | "likely_not_ours_or_mixed_sln"
  | "review_matcher_or_outline"
  | "missing_trx_or_filter";

export type MatchingLayoutHint =
  | "layout_clustered"
  | "layout_general_bucket"
  | "layout_deep_subpath";

export interface MatchingHealthBuckets {
  unmapped: number;
  unused: number;
  unusedGherkin: number;
  unusedOther: number;
  ambiguous: number;
  shared: number;
  hint?: MatchingHealthHint;
}

export interface MatchingLayoutGapRow {
  label: string;
  domain: string;
  relativePath: string;
  subpath: string;
  subpathDepth: number;
}

/** True when the report has any mapping honesty gap worth exporting. */
export function hasMappingGaps(report: TreeMappingReport): boolean {
  const unused = report.unusedTrx?.length ?? 0;
  const ambiguous = report.ambiguousLeaves?.length ?? 0;
  const shared = report.sharedChosenCount ?? 0;
  return report.unmapped > 0 || unused > 0 || ambiguous > 0 || shared > 0;
}

export function computeMatchingHealthBuckets(report: TreeMappingReport): MatchingHealthBuckets {
  const unmapped = report.unmapped;
  const unusedRows = report.unusedTrx ?? [];
  const unused = unusedRows.length;
  const partitioned = partitionUnusedTrx(unusedRows);
  const unusedGherkin = partitioned.gherkinLike.length;
  const unusedOther = partitioned.other.length;
  const ambiguous = report.ambiguousLeaves?.length ?? 0;
  const shared = report.sharedChosenCount ?? 0;
  let hint: MatchingHealthHint | undefined;
  if (ambiguous > 0 || shared > 0) {
    hint = "review_matcher_or_outline";
  } else if (unusedOther > 0 && unmapped === 0) {
    hint = "likely_not_ours_or_mixed_sln";
  } else if (unusedGherkin > 0 && unusedOther === 0 && unmapped === 0) {
    hint = "review_matcher_or_outline";
  } else if (unused > 0 && unmapped === 0) {
    hint = "likely_not_ours_or_mixed_sln";
  } else if (unmapped > 0) {
    hint = "missing_trx_or_filter";
  }
  return { unmapped, unused, unusedGherkin, unusedOther, ambiguous, shared, hint };
}

/**
 * Bucket line body for Output (English keys for support). Returns undefined when silent.
 * Example: `unused=10 unused_gherkin=2 unused_other=8 · hint=likely_not_ours_or_mixed_sln`
 */
export function formatMatchingHealthBuckets(report: TreeMappingReport): string | undefined {
  if (!hasMappingGaps(report)) {
    return undefined;
  }
  const b = computeMatchingHealthBuckets(report);
  const parts: string[] = [];
  if (b.unmapped > 0) {
    parts.push(`unmapped=${b.unmapped}`);
  }
  if (b.unused > 0) {
    parts.push(`unused=${b.unused}`);
    parts.push(`unused_gherkin=${b.unusedGherkin}`);
    parts.push(`unused_other=${b.unusedOther}`);
  }
  if (b.ambiguous > 0) {
    parts.push(`ambiguous=${b.ambiguous}`);
  }
  if (b.shared > 0) {
    parts.push(`shared=${b.shared}`);
  }
  if (parts.length === 0) {
    return undefined;
  }
  const hintSuffix = b.hint ? ` · hint=${b.hint}` : "";
  return `${parts.join(" ")}${hintSuffix}`;
}

/**
 * Folder segments after the Pilot domain folder and before the `.feature` file.
 * `Features/Trading/BuyingPower/X.feature` → `["BuyingPower"]`.
 */
export function layoutSubpathSegments(filePath: string): string[] {
  const segments = filePath.split(/[\\/]/).filter((s) => s.length > 0);
  const featuresIdx = segments.findIndex((s) => {
    const lower = s.toLowerCase();
    return lower === "features" || lower === "feature";
  });
  if (featuresIdx < 0) {
    return [];
  }
  // Flat under Features/File.feature → General domain, no subpath.
  if (featuresIdx + 1 >= segments.length - 1) {
    return [];
  }
  // segments[featuresIdx+1] is domain; file is last; between = subpath.
  return segments.slice(featuresIdx + 2, -1);
}

function relativizeFeaturePath(absolutePath: string, projectDir: string): string {
  const rel = path.relative(projectDir, absolutePath);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return rel.split(path.sep).join("/");
  }
  return absolutePath.split(path.sep).join("/");
}

export function buildLayoutGapRows(
  leaves: MatchingDebugLayoutLeaf[],
  projectDir: string,
): MatchingLayoutGapRow[] {
  return leaves.map((leaf) => {
    const subSegments = layoutSubpathSegments(leaf.featurePath);
    return {
      label: leaf.label,
      domain: leaf.domain || deriveDomain(leaf.featurePath),
      relativePath: relativizeFeaturePath(leaf.featurePath, projectDir),
      subpath: subSegments.length > 0 ? subSegments.join("/") : "",
      subpathDepth: subSegments.length,
    };
  });
}

/** First matching layout hint, or undefined. */
export function computeMatchingLayoutHint(rows: MatchingLayoutGapRow[]): MatchingLayoutHint | undefined {
  if (rows.length === 0) {
    return undefined;
  }
  const byDomain = new Map<string, number>();
  for (const row of rows) {
    byDomain.set(row.domain, (byDomain.get(row.domain) ?? 0) + 1);
  }
  const total = rows.length;
  let maxInOne = 0;
  for (const count of byDomain.values()) {
    if (count > maxInOne) {
      maxInOne = count;
    }
  }
  if (total >= 3 && maxInOne / total >= 0.7) {
    return "layout_clustered";
  }
  const generalCount = byDomain.get("General") ?? 0;
  if (generalCount >= 3) {
    return "layout_general_bucket";
  }
  const deepCount = rows.filter((r) => r.subpathDepth >= 2).length;
  if (deepCount >= 3) {
    return "layout_deep_subpath";
  }
  return undefined;
}

export function aggregateGapsByDomain(rows: MatchingLayoutGapRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.domain, (counts.get(row.domain) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, n]) => `${name}=${n}`)
    .join(", ");
}

/**
 * Build layout leaves from unmapped + ambiguous labels resolved via domains.
 */
export function collectMatchingDebugLayoutLeaves(
  report: TreeMappingReport,
  domains: DomainGroup[],
): MatchingDebugLayoutLeaf[] {
  const byLabel = new Map<string, string>();
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            const label = `${feature.name} · ${scenario.name} · ${example.label}`;
            byLabel.set(label, feature.filePath);
          }
        } else {
          const label = `${feature.name} · ${scenario.name}`;
          byLabel.set(label, feature.filePath);
        }
      }
    }
  }

  const out: MatchingDebugLayoutLeaf[] = [];
  const seen = new Set<string>();

  for (const leaf of report.unmappedLeaves) {
    if (seen.has(leaf.label)) {
      continue;
    }
    seen.add(leaf.label);
    out.push({
      label: leaf.label,
      featurePath: leaf.featurePath,
      domain: deriveDomain(leaf.featurePath),
    });
  }

  for (const amb of report.ambiguousLeaves ?? []) {
    if (seen.has(amb.label)) {
      continue;
    }
    const featurePath = byLabel.get(amb.label);
    if (!featurePath) {
      continue;
    }
    seen.add(amb.label);
    out.push({
      label: amb.label,
      featurePath,
      domain: deriveDomain(featurePath),
    });
  }

  return out;
}

function cleanLabel(value: string): string {
  return sanitize(truncateMappingLabel(value, MAPPING_LABEL_MAX_CHARS));
}

function formatLayoutSection(layout: MatchingDebugLayoutContext | undefined): string {
  const groupBy = layout?.groupBy ?? "domain";
  const rule =
    "domain = first path segment after Features/Feature; deeper folders = subpath (not separate domains)";
  const header = [
    "## Layout / grouping",
    `- **groupBy:** ${groupBy}`,
    `- **Pilot domain rule:** ${rule}`,
  ];

  if (!layout || layout.leaves.length === 0) {
    return `${header.join("\n")}\n- layout: paths unavailable\n`;
  }

  const rows = buildLayoutGapRows(layout.leaves, layout.projectDir);
  const capped = selectCappedForOutput(rows, UNMAPPED_OUTPUT_CAP);
  const aggregate = aggregateGapsByDomain(rows);
  const lines = [
    ...header,
    `- **gaps by domain:** ${aggregate || "_(none)_"}`,
    ...capped.shown.map((row) => {
      const sub = row.subpath ? row.subpath : "_(none)_";
      return `- ${cleanLabel(row.label)} · domain=${sanitize(row.domain)} · path=\`${sanitize(row.relativePath)}\` · subpath=${sanitize(sub)}`;
    }),
  ];
  if (capped.remaining > 0) {
    lines.push(`- _… and ${capped.remaining} more layout gaps_`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Builds clipboard markdown for matching support. Returns `undefined` when there are no gaps
 * (caller should toast instead of copying).
 */
export function buildMatchingDebugPack(input: BuildMatchingDebugPackInput): string | undefined {
  const { report, meta } = input;
  if (!hasMappingGaps(report)) {
    return undefined;
  }

  const version = meta.extensionVersion ?? "unknown";
  const filterLine = meta.filter
    ? `- **Filter:** \`${sanitize(meta.filter)}\``
    : "- **Filter:** _(none)_";
  const targetLine = meta.testTarget
    ? `- **Test target:** \`${sanitize(meta.testTarget)}\``
    : "- **Test target:** _(none)_";

  const unusedRows = report.unusedTrx ?? [];
  const unusedPartition = partitionUnusedTrx(unusedRows);
  const unusedCaps = allocateUnusedSplitCaps(
    unusedPartition.gherkinLike.length,
    unusedPartition.other.length,
    UNMAPPED_OUTPUT_CAP,
  );
  const gherkinCap = selectCappedForOutput(unusedPartition.gherkinLike, unusedCaps.gherkinCap);
  const otherCap = selectCappedForOutput(unusedPartition.other, unusedCaps.otherCap);

  const summaryLines = [
    `- **In scope:** ${report.inScope}`,
    `- **Mapped:** ${report.mapped}`,
    `- **Unmapped:** ${report.unmapped}`,
    `- **TRX total:** ${report.trxTotal ?? "_(unknown)_"}`,
    `- **Unused TRX:** ${unusedRows.length}`,
    ...(unusedRows.length > 0
      ? [
          `- **Unused gherkin-like:** ${unusedPartition.gherkinLike.length}`,
          `- **Unused other:** ${unusedPartition.other.length}`,
        ]
      : []),
    `- **Ambiguous leaves:** ${report.ambiguousLeaves?.length ?? 0}`,
    `- **Shared TRX rows:** ${report.sharedChosenCount ?? 0}`,
  ];

  const unmappedCap = selectCappedForOutput(report.unmappedLeaves, UNMAPPED_OUTPUT_CAP);
  const unmappedSection =
    report.unmapped > 0
      ? [
          "## Unmapped",
          ...unmappedCap.shown.map((leaf) => `- ${cleanLabel(leaf.label)}`),
          ...(unmappedCap.remaining > 0
            ? [`- _… and ${unmappedCap.remaining} more unmapped_`]
            : []),
          "",
        ].join("\n")
      : "## Unmapped\n_(none)_\n";

  const unusedSectionLines: string[] = ["## Unused TRX"];
  if (unusedRows.length === 0) {
    unusedSectionLines.push("_(none)_", "");
  } else {
    if (unusedPartition.gherkinLike.length > 0) {
      unusedSectionLines.push("### Gherkin-like");
      for (const row of gherkinCap.shown) {
        unusedSectionLines.push(`- \`${cleanLabel(row.testName)}\` (${row.outcome})`);
      }
      if (gherkinCap.remaining > 0) {
        unusedSectionLines.push(`- _… and ${gherkinCap.remaining} more gherkin-like_`);
      }
    }
    if (unusedPartition.other.length > 0) {
      unusedSectionLines.push("### Other");
      for (const row of otherCap.shown) {
        unusedSectionLines.push(`- \`${cleanLabel(row.testName)}\` (${row.outcome})`);
      }
      if (otherCap.remaining > 0) {
        unusedSectionLines.push(`- _… and ${otherCap.remaining} more other_`);
      }
    }
    unusedSectionLines.push("");
  }
  const unusedSection = unusedSectionLines.join("\n");

  const ambiguousRows = report.ambiguousLeaves ?? [];
  const ambiguousCap = selectCappedForOutput(ambiguousRows, UNMAPPED_OUTPUT_CAP);
  const ambiguousSection =
    ambiguousRows.length > 0
      ? [
          "## Ambiguous",
          ...ambiguousCap.shown.map((leaf) => {
            const chosen = leaf.chosenTestName
              ? `; chosen \`${cleanLabel(leaf.chosenTestName)}\``
              : "; no chosen (tie)";
            return `- ${cleanLabel(leaf.label)} — ${leaf.candidateCount} rows${chosen}`;
          }),
          ...(ambiguousCap.remaining > 0
            ? [`- _… and ${ambiguousCap.remaining} more ambiguous_`]
            : []),
          "",
        ].join("\n")
      : "## Ambiguous\n_(none)_\n";

  const shared = report.sharedChosenCount ?? 0;
  const sharedSection =
    shared > 0
      ? `## Shared\n- **Shared TRX rows applied to ≥2 leaves:** ${shared}\n`
      : "## Shared\n_(none)_\n";

  let candidatesSection: string;
  if (!input.candidatesByLabel) {
    candidatesSection =
      "## Candidates\ncandidates: unavailable (session report only)\n";
  } else {
    const interestingLabels = new Set<string>([
      ...report.unmappedLeaves.map((l) => l.label),
      ...ambiguousRows.map((l) => l.label),
    ]);
    const chosenByLabel = new Map(
      ambiguousRows.map((l) => [l.label, l.chosenTestName] as const),
    );
    const byLabel = new Map(
      input.candidatesByLabel.map((c) => [c.label, c] as const),
    );
    const lines: string[] = ["## Candidates"];
    let listed = 0;
    for (const label of interestingLabels) {
      if (listed >= UNMAPPED_OUTPUT_CAP) {
        lines.push(`- _… candidates capped at ${UNMAPPED_OUTPUT_CAP} leaves_`);
        break;
      }
      const entry = byLabel.get(label);
      const names = (entry?.candidateTestNames ?? []).slice(0, MATCHING_DEBUG_CANDIDATE_CAP);
      const chosen = chosenByLabel.get(label) ?? entry?.chosenTestName;
      if (names.length === 0) {
        lines.push(`- ${cleanLabel(label)}: _(no matching TRX rows)_`);
      } else {
        const nameBits = names.map((n) => {
          const clean = cleanLabel(n);
          return chosen && n === chosen ? `\`${clean}\` **(chosen)**` : `\`${clean}\``;
        });
        lines.push(`- ${cleanLabel(label)}: ${nameBits.join(", ")}`);
      }
      listed += 1;
    }
    if (interestingLabels.size === 0) {
      lines.push("_(no unmapped/ambiguous leaves)_");
    }
    candidatesSection = `${lines.join("\n")}\n`;
  }

  const residualRows = report.residualOutlineLines ?? [];
  const residualCap = selectCappedForOutput(residualRows, MATCHING_DEBUG_CANDIDATE_CAP);
  const residualSection =
    residualRows.length > 0
      ? [
          "## Residual outline keys",
          ...residualCap.shown.map((line) => `- ${cleanLabel(line)}`),
          ...(residualCap.remaining > 0
            ? [`- _… and ${residualCap.remaining} more residual keys_`]
            : []),
          "",
        ].join("\n")
      : "";

  const layoutSection = formatLayoutSection(input.layout);

  const health = computeMatchingHealthBuckets(report);
  const hintNote = health.hint ? `- Local hint: \`${health.hint}\`` : "- Local hint: _(none)_";
  const layoutRows = input.layout
    ? buildLayoutGapRows(input.layout.leaves, input.layout.projectDir)
    : [];
  const layoutHint = computeMatchingLayoutHint(layoutRows);
  const layoutHintNote = layoutHint
    ? `- Layout hint: \`${layoutHint}\``
    : "- Layout hint: _(none)_";

  return `# BDD Pilot — Matching Debug Pack

## Run
- **Stage:** ${sanitize(meta.stage)} · **Mode:** ${sanitize(meta.mode)}
${filterLine}
${targetLine}
- **Extension:** ${sanitize(version)}

## Mapping summary
${summaryLines.join("\n")}

${layoutSection}
${unmappedSection}
${unusedSection}
${ambiguousSection}
${sharedSection}
${candidatesSection}
${residualSection}## Notes
${hintNote}
${layoutHintNote}
- Outline Theory: no first-apply when one row matches K>1 leaves; \`__pickleIndex\` is a row-index tie-break only.
- Non-outline apply: first candidate still wins.
- Review before share — filter and test names are sanitized, but may still identify your suite.
- No remote telemetry; clipboard only.
`;
}
