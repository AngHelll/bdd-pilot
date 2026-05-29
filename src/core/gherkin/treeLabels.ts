import { formatDurationTooltip } from "../results/durationFormat";

/** How tags appear in the tree view description (muted text to the right of the label). */
export type TagDisplayMode = "hidden" | "count" | "compact" | "full";

export const DEFAULT_TAG_DISPLAY: TagDisplayMode = "count";
export const DEFAULT_COMPACT_TAG_LIMIT = 2;

/**
 * Formats tags for the tree `description` field. VS Code renders description on
 * the same line as the label — long tag lists truncate and hurt scanability.
 */
export function formatTagDescription(
  tags: readonly string[],
  mode: TagDisplayMode,
  compactLimit = DEFAULT_COMPACT_TAG_LIMIT,
): string {
  if (tags.length === 0 || mode === "hidden") {
    return "";
  }
  if (mode === "count") {
    return tags.length === 1 ? `@${tags[0]}` : `${tags.length} tags`;
  }
  if (mode === "full") {
    return tags.map((t) => `@${t}`).join(" ");
  }
  const shown = tags.slice(0, compactLimit).map((t) => `@${t}`).join(" ");
  const rest = tags.length - compactLimit;
  return rest > 0 ? `${shown} +${rest}` : shown;
}

/** Joins optional description parts with a middle dot. */
export function joinDescriptionParts(...parts: Array<string | undefined>): string {
  return parts.filter((p) => p !== undefined && p.length > 0).join(" · ");
}

export function buildFeatureDescription(
  scenarioCount: number,
  tags: readonly string[],
  tagMode: TagDisplayMode,
  compactLimit: number,
): string {
  const scenarioPart =
    scenarioCount === 1 ? "1 scenario" : `${scenarioCount} scenarios`;
  const tagPart = formatTagDescription(tags, tagMode, compactLimit);
  return joinDescriptionParts(scenarioPart, tagPart || undefined);
}

export function buildScenarioDescription(
  tags: readonly string[],
  tagMode: TagDisplayMode,
  compactLimit: number,
  durationLabel?: string,
): string {
  const tagPart = formatTagDescription(tags, tagMode, compactLimit);
  return joinDescriptionParts(durationLabel, tagPart || undefined);
}

export function formatTagsMarkdown(tags: readonly string[]): string {
  if (tags.length === 0) {
    return "_none_";
  }
  return tags.map((t) => `\`@${t}\``).join(" ");
}

export interface ScenarioTooltipParts {
  scenarioName: string;
  featureName: string;
  fileName: string;
  line: number;
  featureTags: readonly string[];
  scenarioTags: readonly string[];
  isOutline: boolean;
  outcome?: string;
  durationMs?: number;
  exampleCount?: number;
  rollupSummary?: string;
}

/** Multi-line tooltip content (Markdown). Full tag lists live here, not in the label. */
export function buildScenarioTooltipMarkdown(parts: ScenarioTooltipParts): string {
  const lines: string[] = [`**${parts.scenarioName}**`, ""];

  if (parts.isOutline) {
    lines.push("_Scenario Outline_", "");
    if (parts.exampleCount !== undefined && parts.exampleCount > 0) {
      lines.push(`${parts.exampleCount} example row${parts.exampleCount === 1 ? "" : "s"}`, "");
    }
  }

  lines.push(`Feature: ${parts.featureName}`);
  lines.push(`File: \`${parts.fileName}\` · line ${parts.line}`);

  if (parts.featureTags.length > 0) {
    lines.push("", `Feature tags: ${formatTagsMarkdown(parts.featureTags)}`);
  }
  if (parts.scenarioTags.length > 0) {
    lines.push("", `Scenario tags: ${formatTagsMarkdown(parts.scenarioTags)}`);
  }

  if (parts.outcome || parts.durationMs !== undefined || parts.rollupSummary) {
    lines.push("");
    if (parts.rollupSummary) {
      lines.push(`Results: ${parts.rollupSummary}`);
    }
    if (parts.outcome) {
      lines.push(`Last run: **${parts.outcome}**`);
    }
    if (parts.durationMs !== undefined) {
      lines.push(formatDurationTooltip(parts.durationMs));
    }
  }

  return lines.join("\n");
}

export function buildFeatureTooltipMarkdown(
  featureName: string,
  fileName: string,
  scenarioCount: number,
  tags: readonly string[],
  rollupSummary?: string,
): string {
  const lines = [
    `**${featureName}**`,
    "",
    `File: \`${fileName}\``,
    scenarioCount === 1 ? "1 scenario" : `${scenarioCount} scenarios`,
  ];
  if (rollupSummary) {
    lines.push("", `Last run: ${rollupSummary}`);
  }
  if (tags.length > 0) {
    lines.push("", `Tags: ${formatTagsMarkdown(tags)}`);
  }
  return lines.join("\n");
}
