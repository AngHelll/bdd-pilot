import { RunTarget } from "../core/runner/filterBuilder";
import {
  DomainNode,
  FeatureNode,
  OutlineRowNode,
  ScenarioNode,
  TagNode,
  TreeNode,
} from "../providers/testTreeProvider";

export function toRunTarget(node: TreeNode | undefined): RunTarget | undefined {
  if (!node) {
    return { kind: "all" };
  }
  if (node.kind === "pilotSummary") {
    return undefined;
  }
  if (node.kind === "domain") {
    return { kind: "domain", group: (node as DomainNode).group };
  }
  if (node.kind === "tag") {
    return { kind: "tag", tag: (node as TagNode).group.tag };
  }
  if (node.kind === "feature") {
    return { kind: "feature", feature: (node as FeatureNode).feature };
  }
  if (node.kind === "outlineRow") {
    const row = node as OutlineRowNode;
    return {
      kind: "outlineRow",
      feature: row.feature,
      scenario: row.scenario,
      example: row.example,
    };
  }
  return {
    kind: "scenario",
    feature: (node as ScenarioNode).feature,
    scenario: (node as ScenarioNode).scenario,
  };
}

export function normalizeTargets(target: RunTarget): RunTarget[] {
  if (target.kind === "all") {
    return [{ kind: "all" }];
  }
  return [target];
}

export function resolveRunTargets(target: RunTarget | RunTarget[]): RunTarget[] {
  if (Array.isArray(target)) {
    return target;
  }
  return normalizeTargets(target);
}
