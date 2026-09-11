import { parseTheoryDisplayName } from "../runner/theoryDisplayName";
import { UnusedTrxRow } from "./trxTreeMapping";

export type UnusedTrxClass = "gherkin_like" | "other";

/** Reqnroll/SpecFlow generated type segment before scenario name. */
const FEATURE_SEGMENT_RE = /Feature\./i;

/**
 * Structural classification of an unused TRX display / FQN name.
 * Conservative: unclear names → gherkin_like only when Theory or `Feature.` is clear;
 * otherwise other (helpers / unit methods).
 */
export function classifyUnusedTrxName(testName: string): UnusedTrxClass {
  const raw = testName.trim();
  if (!raw) {
    return "other";
  }
  if (parseTheoryDisplayName(raw)) {
    return "gherkin_like";
  }
  const open = raw.indexOf("(");
  if (open > 0 && raw.endsWith(")")) {
    const beforeParen = raw.slice(0, open);
    const lastDot = beforeParen.lastIndexOf(".");
    const title = (lastDot >= 0 ? beforeParen.slice(lastDot + 1) : beforeParen).trim();
    if (title && parseTheoryDisplayName(`${title}${raw.slice(open)}`)) {
      return "gherkin_like";
    }
  }
  if (FEATURE_SEGMENT_RE.test(raw)) {
    return "gherkin_like";
  }
  return "other";
}

export function partitionUnusedTrx(rows: readonly UnusedTrxRow[]): {
  gherkinLike: UnusedTrxRow[];
  other: UnusedTrxRow[];
} {
  const gherkinLike: UnusedTrxRow[] = [];
  const other: UnusedTrxRow[] = [];
  for (const row of rows) {
    if (classifyUnusedTrxName(row.testName) === "gherkin_like") {
      gherkinLike.push(row);
    } else {
      other.push(row);
    }
  }
  return { gherkinLike, other };
}

/**
 * Split a global Output/Debug Pack cap across two buckets.
 * When both are non-empty, reserve at least one slot each; fill **other** first, then gherkin.
 */
export function allocateUnusedSplitCaps(
  gherkinCount: number,
  otherCount: number,
  cap: number,
): { gherkinCap: number; otherCap: number } {
  if (cap <= 0) {
    return { gherkinCap: 0, otherCap: 0 };
  }
  if (gherkinCount <= 0) {
    return { gherkinCap: 0, otherCap: Math.min(otherCount, cap) };
  }
  if (otherCount <= 0) {
    return { gherkinCap: Math.min(gherkinCount, cap), otherCap: 0 };
  }

  let gherkinCap = Math.min(1, gherkinCount);
  let otherCap = Math.min(1, otherCount);
  let left = cap - gherkinCap - otherCap;
  if (left < 0) {
    // cap === 1: prefer other
    return { gherkinCap: 0, otherCap: Math.min(1, otherCount) };
  }

  const otherAdd = Math.min(left, otherCount - otherCap);
  otherCap += otherAdd;
  left -= otherAdd;
  gherkinCap += Math.min(left, gherkinCount - gherkinCap);
  return { gherkinCap, otherCap };
}
