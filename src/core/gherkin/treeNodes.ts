import { TreeEmptyKind } from "./treeEmptyState";
import { TagGroup } from "./groupByTag";
import { DomainGroup, FeatureInfo, OutlineExample, ScenarioInfo } from "./model";

export type TreeNode =
  | PilotSummaryNode
  | EmptyGuideNode
  | DomainNode
  | TagNode
  | FeatureNode
  | ScenarioNode
  | OutlineRowNode;

export interface PilotSummaryNode {
  kind: "pilotSummary";
}

export interface EmptyGuideNode {
  kind: "emptyGuide";
  emptyKind: Exclude<TreeEmptyKind, "none">;
}

export interface DomainNode {
  kind: "domain";
  group: DomainGroup;
}

export interface TagNode {
  kind: "tag";
  group: TagGroup;
}

export interface FeatureNode {
  kind: "feature";
  feature: FeatureInfo;
}

export interface ScenarioNode {
  kind: "scenario";
  feature: FeatureInfo;
  scenario: ScenarioInfo;
  /** When true, description shows feature name (tag-grouped tree). */
  underTagGroup?: boolean;
  /**
   * Lowercase tag key of the visible parent. Set when the same scenario
   * is mounted under more than one tag. Absent in domain grouping.
   */
  parentTagKey?: string;
}

export interface OutlineRowNode {
  kind: "outlineRow";
  feature: FeatureInfo;
  scenario: ScenarioInfo;
  example: OutlineExample;
  /** Lowercase tag key when this row is mounted under a tag group. */
  parentTagKey?: string;
}
