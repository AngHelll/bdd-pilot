import { TreeGroupBy } from "./treeDisplaySettings";

/**
 * TreeItem ids for the BDD Pilot view.
 *
 * VS Code 1.90 uses `1/${id}` as the element handle when `TreeItem.id` is set,
 * and that handle is global across the tree. These ids are therefore unique
 * for every visible node, including the same scenario mounted under two tags.
 * They follow file, line, example row, and tag membership. They do not include
 * the label, locale, outcome, duration, or sibling index.
 */

export const TREE_ITEM_CONTEXT = {
  summary: "bddPilotSummary",
  summaryRunning: "bddPilotSummaryRunning",
  empty: "bddEmptyGuide",
  domain: "bddRunnableDomain",
  tag: "bddRunnableTag",
  feature: "bddRunnableFeature",
  scenario: "bddRunnableScenario",
} as const;

/** Same predicate as `view/item/context` for Run and Debug (`viewItem =~ /^bddRunnable/`). */
export function contextValueAllowsRunAndDebug(contextValue: string): boolean {
  return /^bddRunnable/.test(contextValue);
}

export interface TagPlacement {
  tag: string;
  scenarios: readonly { filePath: string; line: number }[];
}

export interface DomainPlacement {
  name: string;
  features: readonly { filePath: string }[];
}

/** Case-insensitive tag identity. Matches `groupByTag`, which folds case into one group. */
export function tagIdentityKey(tag: string): string {
  return tag.toLowerCase();
}

export function scenarioNodeIsOutline(scenario: {
  isOutline: boolean;
  examples?: readonly unknown[] | undefined;
}): boolean {
  return scenario.isOutline || (scenario.examples !== undefined && scenario.examples.length > 0);
}

function field(value: string): string {
  return encodeURIComponent(value);
}

export function summaryTreeItemId(): string {
  return "summary";
}

export function emptyGuideTreeItemId(kind: string): string {
  return `empty|${field(kind)}`;
}

export function domainTreeItemId(name: string): string {
  return `domain|${field(name)}`;
}

export function tagTreeItemId(tag: string): string {
  return `tag|${field(tagIdentityKey(tag))}`;
}

export function featureTreeItemId(filePath: string): string {
  return `feature|${field(filePath)}`;
}

export function scenarioTreeItemId(input: {
  filePath: string;
  line: number;
  isOutline: boolean;
  parentTagKey?: string;
}): string {
  const kind = input.isOutline ? "outline" : "scenario";
  const base = `${kind}|${field(input.filePath)}|${input.line}`;
  return input.parentTagKey ? `${base}|tag|${field(tagIdentityKey(input.parentTagKey))}` : base;
}

export function exampleTreeItemId(input: {
  filePath: string;
  line: number;
  rowIndex: number;
  parentTagKey?: string;
}): string {
  const base = `example|${field(input.filePath)}|${input.line}|${input.rowIndex}`;
  return input.parentTagKey ? `${base}|tag|${field(tagIdentityKey(input.parentTagKey))}` : base;
}

/**
 * Tag of the visible parent. An explicit key wins so two copies of one
 * scenario keep their own parent. Otherwise the first placement group that
 * contains the scenario, which is the copy `reveal` can address.
 */
export function resolveParentTagKey(
  explicit: string | undefined,
  filePath: string,
  scenarioLine: number,
  groups: readonly TagPlacement[],
): string | undefined {
  if (explicit) {
    return tagIdentityKey(explicit);
  }
  for (const group of groups) {
    if (group.scenarios.some((scenario) => scenario.filePath === filePath && scenario.line === scenarioLine)) {
      return tagIdentityKey(group.tag);
    }
  }
  return undefined;
}

export function visibleScenarioItemId(
  filePath: string,
  line: number,
  isOutline: boolean,
  explicitTag: string | undefined,
  groupBy: TreeGroupBy,
  groups: readonly TagPlacement[],
): string {
  const parentTagKey =
    groupBy === "tag" ? resolveParentTagKey(explicitTag, filePath, line, groups) : undefined;
  return scenarioTreeItemId({ filePath, line, isOutline, parentTagKey });
}

export function visibleExampleItemId(
  filePath: string,
  line: number,
  rowIndex: number,
  explicitTag: string | undefined,
  groupBy: TreeGroupBy,
  groups: readonly TagPlacement[],
): string {
  const parentTagKey =
    groupBy === "tag" ? resolveParentTagKey(explicitTag, filePath, line, groups) : undefined;
  return exampleTreeItemId({ filePath, line, rowIndex, parentTagKey });
}

/** Element reduced to the fields that decide its parent in the visible tree. */
export interface PlacedNode {
  kind: "pilotSummary" | "emptyGuide" | "domain" | "tag" | "feature" | "scenario" | "outlineRow";
  domainName?: string;
  /** Lowercase tag key when `kind` is `tag`. */
  tag?: string;
  filePath?: string;
  /** Scenario line (not the Examples row line). */
  line?: number;
  rowIndex?: number;
  parentTagKey?: string;
}

/**
 * Parent in the hierarchy that is actually on screen.
 * Domain mode: domain → feature → scenario → example.
 * Tag mode: tag → scenario → example. A feature has no parent there.
 */
export function resolveVisibleParent(
  node: PlacedNode,
  groupBy: TreeGroupBy,
  domains: readonly DomainPlacement[],
  groups: readonly TagPlacement[],
): PlacedNode | undefined {
  if (
    node.kind === "pilotSummary" ||
    node.kind === "emptyGuide" ||
    node.kind === "domain" ||
    node.kind === "tag"
  ) {
    return undefined;
  }

  if (node.kind === "feature") {
    if (groupBy === "tag" || !node.filePath) {
      return undefined;
    }
    const domain = domains.find((candidate) =>
      candidate.features.some((feature) => feature.filePath === node.filePath),
    );
    return domain ? { kind: "domain", domainName: domain.name } : undefined;
  }

  if (node.kind === "scenario") {
    if (!node.filePath || node.line === undefined) {
      return undefined;
    }
    if (groupBy === "tag") {
      const parentTagKey = resolveParentTagKey(node.parentTagKey, node.filePath, node.line, groups);
      return parentTagKey ? { kind: "tag", tag: parentTagKey } : undefined;
    }
    return { kind: "feature", filePath: node.filePath };
  }

  if (!node.filePath || node.line === undefined) {
    return undefined;
  }
  if (groupBy === "tag") {
    const parentTagKey = resolveParentTagKey(node.parentTagKey, node.filePath, node.line, groups);
    return {
      kind: "scenario",
      filePath: node.filePath,
      line: node.line,
      parentTagKey,
    };
  }
  return { kind: "scenario", filePath: node.filePath, line: node.line };
}

export interface FailurePlacement {
  filePath: string;
  scenarioLine: number;
  /** Set when the failed leaf is an Examples row. */
  rowIndex?: number;
}

export interface ExpandRef {
  kind: "tag" | "scenario";
  tagKey: string;
  filePath?: string;
  line?: number;
}

/**
 * Containers to expand after collapse-all while the tree is grouped by tag.
 * Every tag that shows a failed scenario is included. Outline parents are
 * included only when a failed leaf is an example row.
 */
export function tagFailureExpandRefs(
  failures: readonly FailurePlacement[],
  groups: readonly TagPlacement[],
): ExpandRef[] {
  const refs: ExpandRef[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    const tagKey = tagIdentityKey(group.tag);
    const outlines: ExpandRef[] = [];
    const outlineIds = new Set<string>();
    let hit = false;

    for (const failure of failures) {
      const member = group.scenarios.some(
        (scenario) => scenario.filePath === failure.filePath && scenario.line === failure.scenarioLine,
      );
      if (!member) {
        continue;
      }
      hit = true;
      if (failure.rowIndex === undefined) {
        continue;
      }
      const outlineId = scenarioTreeItemId({
        filePath: failure.filePath,
        line: failure.scenarioLine,
        isOutline: true,
        parentTagKey: tagKey,
      });
      if (outlineIds.has(outlineId)) {
        continue;
      }
      outlineIds.add(outlineId);
      outlines.push({
        kind: "scenario",
        tagKey,
        filePath: failure.filePath,
        line: failure.scenarioLine,
      });
    }

    if (!hit) {
      continue;
    }
    const tagId = tagTreeItemId(group.tag);
    if (!seen.has(tagId)) {
      seen.add(tagId);
      refs.push({ kind: "tag", tagKey });
    }
    for (const outline of outlines) {
      const outlineId = scenarioTreeItemId({
        filePath: outline.filePath!,
        line: outline.line!,
        isOutline: true,
        parentTagKey: outline.tagKey,
      });
      if (seen.has(outlineId)) {
        continue;
      }
      seen.add(outlineId);
      refs.push(outline);
    }
  }

  return refs;
}

/** Ancestors from the visible root down to, but not including, `node`. */
export function visibleAncestorChain(
  node: PlacedNode,
  groupBy: TreeGroupBy,
  domains: readonly DomainPlacement[],
  groups: readonly TagPlacement[],
): PlacedNode[] {
  const parent = resolveVisibleParent(node, groupBy, domains, groups);
  if (!parent) {
    return [];
  }
  return [...visibleAncestorChain(parent, groupBy, domains, groups), parent];
}
