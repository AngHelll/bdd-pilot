import { AmbiguousMappedLeaf, TreeMappingReport, UnmappedLeaf, UnusedTrxRow } from "./trxTreeMapping";
import { allocateUnusedSplitCaps, partitionUnusedTrx } from "./unusedTrxClassify";

/** Max unmapped / unused / ambiguous detail lines written to Output after the summary. */
export const UNMAPPED_OUTPUT_CAP = 25;

/** Max chars for TRX testName / labels in Output honesty lines. */
export const MAPPING_LABEL_MAX_CHARS = 120;

/** Max TRX candidate testNames listed per leaf in the Matching Debug Pack. */
export const MATCHING_DEBUG_CANDIDATE_CAP = 5;

export function selectCappedForOutput<T>(
  items: readonly T[],
  cap: number = UNMAPPED_OUTPUT_CAP,
): { shown: T[]; remaining: number } {
  if (cap <= 0) {
    return { shown: [], remaining: items.length };
  }
  if (items.length <= cap) {
    return { shown: [...items], remaining: 0 };
  }
  return { shown: items.slice(0, cap), remaining: items.length - cap };
}

export function selectUnmappedForOutput(
  leaves: UnmappedLeaf[],
  cap: number = UNMAPPED_OUTPUT_CAP,
): { shown: UnmappedLeaf[]; remaining: number } {
  return selectCappedForOutput(leaves, cap);
}

export function truncateMappingLabel(
  value: string,
  maxChars: number = MAPPING_LABEL_MAX_CHARS,
): string {
  if (maxChars <= 1 || value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars - 1)}…`;
}

export interface UnusedHonestyBucket {
  count: number;
  shown: UnusedTrxRow[];
  remaining: number;
}

export interface HonestyOutputPlan {
  unused?: {
    unused: number;
    trxTotal: number;
    gherkinLike?: UnusedHonestyBucket;
    other?: UnusedHonestyBucket;
  };
  ambiguous?: {
    count: number;
    shown: AmbiguousMappedLeaf[];
    remaining: number;
  };
  sharedCount: number;
}

/** When to emit unused / ambiguous / shared Output blocks (H3). */
export function planHonestyOutput(
  report: TreeMappingReport,
  cap: number = UNMAPPED_OUTPUT_CAP,
): HonestyOutputPlan {
  const unusedRows = report.unusedTrx ?? [];
  const ambiguousRows = report.ambiguousLeaves ?? [];
  const ambiguousCap = selectCappedForOutput(ambiguousRows, cap);
  const partitioned = partitionUnusedTrx(unusedRows);
  const splitCaps = allocateUnusedSplitCaps(
    partitioned.gherkinLike.length,
    partitioned.other.length,
    cap,
  );
  const gherkinCap = selectCappedForOutput(partitioned.gherkinLike, splitCaps.gherkinCap);
  const otherCap = selectCappedForOutput(partitioned.other, splitCaps.otherCap);

  return {
    unused:
      unusedRows.length > 0
        ? {
            unused: unusedRows.length,
            trxTotal: report.trxTotal ?? unusedRows.length,
            gherkinLike:
              partitioned.gherkinLike.length > 0
                ? {
                    count: partitioned.gherkinLike.length,
                    shown: gherkinCap.shown,
                    remaining: gherkinCap.remaining,
                  }
                : undefined,
            other:
              partitioned.other.length > 0
                ? {
                    count: partitioned.other.length,
                    shown: otherCap.shown,
                    remaining: otherCap.remaining,
                  }
                : undefined,
          }
        : undefined,
    ambiguous:
      ambiguousRows.length > 0
        ? {
            count: ambiguousRows.length,
            shown: ambiguousCap.shown,
            remaining: ambiguousCap.remaining,
          }
        : undefined,
    sharedCount: report.sharedChosenCount ?? 0,
  };
}
