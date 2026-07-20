import * as path from "path";
import { DomainGroup } from "../gherkin/model";
import { outlineRowKey, scenarioKey } from "../runner/runScope";
import { SkipReason } from "./skipReason";
import {
  TreeMappingReport,
  UnmappedLeaf,
  OutcomeStoreTrxWriter,
} from "./trxTreeMapping";

export const SKIP_REASON_SNAPSHOT_MAX_ENTRIES = 500;

export type NarrativeSkipReason = Extract<SkipReason, "not_in_trx" | "canceled">;

export interface SkipReasonSnapshotEntry {
  outcomeKey: string;
  reason: NarrativeSkipReason;
}

/** Persisted narrative skip reasons for post-rehydrate continuity. */
export interface SkipReasonSnapshot {
  trxPath?: string;
  updatedAt: number;
  inScope: number;
  mapped: number;
  unmapped: number;
  entries: SkipReasonSnapshotEntry[];
}

export interface SkipReasonStoreReader {
  getSkipReason(key: string): SkipReason | undefined;
}

function isNarrativeReason(reason: SkipReason | undefined): reason is NarrativeSkipReason {
  return reason === "not_in_trx" || reason === "canceled";
}

function leafLabel(featureName: string, scenarioName: string, outlineLabel?: string): string {
  const base = `${featureName} · ${scenarioName}`;
  return outlineLabel ? `${base} · ${outlineLabel}` : base;
}

/** Collect narrative skip entries from a scoped mapping report + store. */
export function collectNarrativeSkipEntries(
  report: TreeMappingReport,
  store: SkipReasonStoreReader,
): SkipReasonSnapshotEntry[] {
  const entries: SkipReasonSnapshotEntry[] = [];
  for (const leaf of report.unmappedLeaves) {
    const reason = store.getSkipReason(leaf.outcomeKey);
    if (!isNarrativeReason(reason)) {
      continue;
    }
    entries.push({ outcomeKey: leaf.outcomeKey, reason });
  }
  return entries.slice(0, SKIP_REASON_SNAPSHOT_MAX_ENTRIES);
}

export function buildSkipReasonSnapshot(input: {
  report: TreeMappingReport;
  store: SkipReasonStoreReader;
  trxPath?: string;
  now?: number;
}): SkipReasonSnapshot | undefined {
  const entries = collectNarrativeSkipEntries(input.report, input.store);
  if (entries.length === 0) {
    return undefined;
  }
  return {
    trxPath: input.trxPath ? path.resolve(input.trxPath) : undefined,
    updatedAt: input.now ?? Date.now(),
    inScope: input.report.inScope,
    mapped: input.report.mapped,
    unmapped: input.report.unmapped,
    entries,
  };
}

export function shouldRestoreSkipSnapshot(
  snapshot: SkipReasonSnapshot | undefined,
  trxAbsolutePath: string,
  now: number,
  maxAgeMs: number | undefined,
): boolean {
  if (!snapshot || snapshot.entries.length === 0) {
    return false;
  }
  if (!snapshot.trxPath) {
    return false;
  }
  if (path.resolve(snapshot.trxPath) !== path.resolve(trxAbsolutePath)) {
    return false;
  }
  if (maxAgeMs !== undefined && now - snapshot.updatedAt > maxAgeMs) {
    return false;
  }
  return true;
}

/** Known outcome keys currently present in discovery. */
export function collectKnownOutcomeKeys(domains: DomainGroup[]): Set<string> {
  const keys = new Set<string>();
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            keys.add(outlineRowKey(feature, scenario, example.rowIndex));
          }
        } else {
          keys.add(scenarioKey(feature, scenario));
        }
      }
    }
  }
  return keys;
}

/**
 * Re-applies narrative skip reasons for keys that still exist in discovery.
 * Does not invent reasons for keys missing from the snapshot.
 */
export function applySkipReasonSnapshot(
  store: OutcomeStoreTrxWriter,
  domains: DomainGroup[],
  snapshot: SkipReasonSnapshot,
): number {
  const known = collectKnownOutcomeKeys(domains);
  let applied = 0;
  for (const entry of snapshot.entries) {
    if (!known.has(entry.outcomeKey)) {
      continue;
    }
    store.setSkipReason(entry.outcomeKey, entry.reason);
    applied++;
  }
  return applied;
}

/** Rebuild a lite mapping report for Mapping UX after rehydrate. */
export function mappingReportFromSkipSnapshot(
  snapshot: SkipReasonSnapshot,
  domains: DomainGroup[],
): TreeMappingReport {
  const entryReasons = new Map(snapshot.entries.map((e) => [e.outcomeKey, e.reason]));
  const unmappedLeaves: UnmappedLeaf[] = [];

  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            const key = outlineRowKey(feature, scenario, example.rowIndex);
            if (!entryReasons.has(key)) {
              continue;
            }
            unmappedLeaves.push({
              outcomeKey: key,
              featureName: feature.name,
              featurePath: feature.filePath,
              scenarioName: scenario.name,
              line: example.line,
              outlineLabel: example.label,
              label: leafLabel(feature.name, scenario.name, example.label),
            });
          }
        } else {
          const key = scenarioKey(feature, scenario);
          if (!entryReasons.has(key)) {
            continue;
          }
          unmappedLeaves.push({
            outcomeKey: key,
            featureName: feature.name,
            featurePath: feature.filePath,
            scenarioName: scenario.name,
            line: scenario.line,
            label: leafLabel(feature.name, scenario.name),
          });
        }
      }
    }
  }

  const unmapped = unmappedLeaves.length;
  return {
    inScope: snapshot.inScope > 0 ? snapshot.inScope : snapshot.mapped + unmapped,
    mapped: snapshot.mapped,
    unmapped,
    unmappedLeaves,
  };
}

export function parseSkipReasonSnapshot(raw: unknown): SkipReasonSnapshot | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.entries) || typeof obj.updatedAt !== "number") {
    return undefined;
  }
  const entries: SkipReasonSnapshotEntry[] = [];
  for (const item of obj.entries) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const e = item as Record<string, unknown>;
    if (typeof e.outcomeKey !== "string" || e.outcomeKey.length === 0) {
      continue;
    }
    if (e.reason !== "not_in_trx" && e.reason !== "canceled") {
      continue;
    }
    entries.push({ outcomeKey: e.outcomeKey, reason: e.reason });
    if (entries.length >= SKIP_REASON_SNAPSHOT_MAX_ENTRIES) {
      break;
    }
  }
  if (entries.length === 0) {
    return undefined;
  }
  return {
    trxPath: typeof obj.trxPath === "string" ? obj.trxPath : undefined,
    updatedAt: obj.updatedAt,
    inScope: typeof obj.inScope === "number" ? obj.inScope : entries.length,
    mapped: typeof obj.mapped === "number" ? obj.mapped : 0,
    unmapped: typeof obj.unmapped === "number" ? obj.unmapped : entries.length,
    entries,
  };
}
