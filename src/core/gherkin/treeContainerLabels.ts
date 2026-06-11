import { PilotLocale, t } from "../i18n";
import {
  formatRollupDescriptionLocalized,
  OutcomeRollup,
  prependRollupLocalized,
  rollupSeverity,
} from "./outcomeRollup";

export type TreeDisplayMode = "compact" | "detailed";

export const DEFAULT_TREE_DISPLAY_MODE: TreeDisplayMode = "detailed";

export function isTreeDisplayMode(value: string | undefined): value is TreeDisplayMode {
  return value === "compact" || value === "detailed";
}

/** Container description: structural metadata; rollup only per display mode rules. */
export function buildContainerDescription(
  mode: TreeDisplayMode,
  rollup: OutcomeRollup,
  structuralBase: string,
  locale: PilotLocale,
): string {
  if (mode === "detailed") {
    return prependRollupLocalized(structuralBase, rollup, locale);
  }
  if (rollup.failed > 0) {
    const rollupText = formatRollupDescriptionLocalized(rollup, locale);
    const sep = t(locale, "rollup.separator");
    if (rollupText && structuralBase.length > 0) {
      return `${rollupText}${sep}${structuralBase}`;
    }
    return rollupText ?? structuralBase;
  }
  return structuralBase;
}

export function shouldTintContainerIcon(mode: TreeDisplayMode, rollup: OutcomeRollup): boolean {
  if (mode === "detailed") {
    return rollupSeverity(rollup) !== undefined;
  }
  return rollup.failed > 0;
}

/** Outline scenario parent description (rows container, not a leaf). */
export function buildOutlineParentDescription(
  mode: TreeDisplayMode,
  rollup: OutcomeRollup | undefined,
  rowCount: number,
  locale: PilotLocale,
  tagBase = "",
): string {
  if (mode === "compact") {
    return rowCount === 1
      ? t(locale, "tree.outlineRowCountOne")
      : t(locale, "tree.outlineRowCount", { count: rowCount });
  }
  if (rollup && rollup.withResults > 0) {
    return prependRollupLocalized(tagBase, rollup, locale);
  }
  return tagBase;
}

/** Tag display for leaf descriptions — hidden in compact. */
export function effectiveLeafTagDisplay(
  mode: TreeDisplayMode,
  tagDisplay: "hidden" | "count" | "compact" | "full",
): "hidden" | "count" | "compact" | "full" {
  return mode === "compact" ? "hidden" : tagDisplay;
}
