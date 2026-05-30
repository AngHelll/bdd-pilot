import { FeatureInfo, OutlineExample, ScenarioInfo } from "../core/gherkin/model";
import { RunTarget } from "../core/runner/filterBuilder";

export type TestExplorerItemData =
  | { kind: "tag"; tag: string }
  | { kind: "feature"; feature: FeatureInfo }
  | { kind: "scenario"; feature: FeatureInfo; scenario: ScenarioInfo }
  | { kind: "outlineRow"; feature: FeatureInfo; scenario: ScenarioInfo; example: OutlineExample };

export interface TestExplorerNode {
  childrenEach: (visit: (child: TestExplorerNode) => void) => void;
}

/** Collects runnable scenario/outline leaves under the selected Test Explorer nodes. */
export function collectTestExplorerLeaves<T extends TestExplorerNode>(
  roots: T[],
  getData: (item: T) => TestExplorerItemData | undefined,
  excluded: ReadonlySet<T>,
): T[] {
  const leaves: T[] = [];
  const visit = (item: T) => {
    if (excluded.has(item)) {
      return;
    }
    const data = getData(item);
    if (data?.kind === "outlineRow") {
      leaves.push(item);
      return;
    }
    if (data?.kind === "scenario") {
      let childCount = 0;
      item.childrenEach(() => {
        childCount++;
      });
      if (childCount === 0) {
        leaves.push(item);
      }
    }
    item.childrenEach((child) => visit(child as T));
  };
  for (const root of roots) {
    visit(root);
  }
  return leaves;
}

/** Resolves dotnet run targets from Test Explorer selection (tag nodes → single tag filter). */
export function resolveTestExplorerRunTargets(
  includedRoots: TestExplorerItemData[],
  leafData: TestExplorerItemData[],
  runningAll: boolean,
): RunTarget[] {
  if (runningAll) {
    return [{ kind: "all" }];
  }

  if (includedRoots.length > 0) {
    const tagTargets: RunTarget[] = [];
    for (const data of includedRoots) {
      if (data.kind === "tag") {
        tagTargets.push({ kind: "tag", tag: data.tag });
      }
    }
    if (tagTargets.length > 0 && tagTargets.length === includedRoots.length) {
      return tagTargets;
    }
  }

  const targets: RunTarget[] = [];
  for (const data of leafData) {
    if (data.kind === "scenario") {
      targets.push({ kind: "scenario", feature: data.feature, scenario: data.scenario });
    } else if (data.kind === "outlineRow") {
      targets.push({
        kind: "outlineRow",
        feature: data.feature,
        scenario: data.scenario,
        example: data.example,
      });
    }
  }
  return targets;
}
