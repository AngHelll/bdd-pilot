import { DurationDisplayMode, DEFAULT_DURATION_DISPLAY } from "../results/durationFormat";
import {
  DEFAULT_TREE_DISPLAY_MODE,
  isTreeDisplayMode,
  TreeDisplayMode,
} from "./treeContainerLabels";
import {
  DEFAULT_COMPACT_TAG_LIMIT,
  DEFAULT_TAG_DISPLAY,
  TagDisplayMode,
} from "./treeLabels";

export type TreeGroupBy = "domain" | "tag";

/** Shared display settings for BDD Pilot tree and Test Explorer. */
export interface TreeDisplaySettings {
  displayMode: TreeDisplayMode;
  tagDisplay: TagDisplayMode;
  compactTagLimit: number;
  durationDisplay: DurationDisplayMode;
}

/** @deprecated Prefer {@link TreeDisplaySettings} — identical shape kept for TE call sites. */
export type TestExplorerDisplaySettings = TreeDisplaySettings;

export interface TreeDisplaySettingsRaw {
  displayMode?: string;
  tagDisplay?: string;
  compactTagLimit?: number;
  durationDisplay?: string;
}

export function parseTreeGroupBy(raw: string | undefined): TreeGroupBy {
  return raw === "tag" ? "tag" : "domain";
}

export function parseTreeDisplaySettings(
  raw: TreeDisplaySettingsRaw = {},
): TreeDisplaySettings {
  const displayMode: TreeDisplayMode = isTreeDisplayMode(raw.displayMode)
    ? raw.displayMode
    : DEFAULT_TREE_DISPLAY_MODE;
  const tagRaw = raw.tagDisplay;
  const tagDisplay: TagDisplayMode =
    tagRaw === "hidden" || tagRaw === "count" || tagRaw === "compact" || tagRaw === "full"
      ? tagRaw
      : DEFAULT_TAG_DISPLAY;
  const compactTagLimit = Math.max(
    1,
    typeof raw.compactTagLimit === "number" && Number.isFinite(raw.compactTagLimit)
      ? raw.compactTagLimit
      : DEFAULT_COMPACT_TAG_LIMIT,
  );
  const durationRaw = raw.durationDisplay;
  const durationDisplay: DurationDisplayMode =
    durationRaw === "auto" ||
    durationRaw === "ms" ||
    durationRaw === "seconds" ||
    durationRaw === "compact"
      ? durationRaw
      : DEFAULT_DURATION_DISPLAY;
  return { displayMode, tagDisplay, compactTagLimit, durationDisplay };
}

/** Structural base for domain containers — shared Tree ↔ TE. */
export function buildDomainStructuralBase(featureCount: number, scenarioCount: number): string {
  const featurePart = featureCount === 1 ? "1 feature" : `${featureCount} features`;
  const scenarioPart = scenarioCount === 1 ? "1 scenario" : `${scenarioCount} scenarios`;
  return `${featurePart} · ${scenarioPart}`;
}

/** Structural base for tag-group containers — shared Tree ↔ TE. */
export function buildTagGroupStructuralBase(scenarioCount: number): string {
  return `${scenarioCount} scenario${scenarioCount === 1 ? "" : "s"}`;
}
