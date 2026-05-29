import * as path from "path";
import * as vscode from "vscode";
import { discoverDomains } from "../core/gherkin/discovery";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import { TestOutcome, TrxSummary, matchesScenario } from "../core/results/trxParser";

export type TreeNode = DomainNode | FeatureNode | ScenarioNode;

export interface DomainNode {
  kind: "domain";
  group: DomainGroup;
}

export interface FeatureNode {
  kind: "feature";
  feature: FeatureInfo;
}

export interface ScenarioNode {
  kind: "scenario";
  feature: FeatureInfo;
  scenario: ScenarioInfo;
}

export class TestTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private domains: DomainGroup[] = [];
  private outcomes = new Map<string, TestOutcome>();
  private durations = new Map<string, number>();

  constructor(private projectDir: () => string | undefined) {}

  setProjectDir(): void {
    this.refresh();
  }

  refresh(): void {
    const dir = this.projectDir();
    this.domains = dir ? discoverDomains(dir) : [];
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Applies TRX results, decorating scenarios with pass/fail/skip. */
  applyResults(summary: TrxSummary): void {
    for (const domain of this.domains) {
      for (const feature of domain.features) {
        for (const scenario of feature.scenarios) {
          const match = summary.results.find((r) => matchesScenario(r.testName, scenario.name));
          if (match) {
            const key = scenarioKey(feature, scenario);
            this.outcomes.set(key, match.outcome);
            if (match.durationMs !== undefined) {
              this.durations.set(key, match.durationMs);
            }
          }
        }
      }
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  clearResults(): void {
    this.outcomes.clear();
    this.durations.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    switch (node.kind) {
      case "domain":
        return this.domainItem(node);
      case "feature":
        return this.featureItem(node);
      case "scenario":
        return this.scenarioItem(node);
    }
  }

  getChildren(node?: TreeNode): TreeNode[] {
    if (!node) {
      return this.domains.map((group) => ({ kind: "domain", group }));
    }
    if (node.kind === "domain") {
      return node.group.features.map((feature) => ({ kind: "feature", feature }));
    }
    if (node.kind === "feature") {
      return node.feature.scenarios.map((scenario) => ({
        kind: "scenario",
        feature: node.feature,
        scenario,
      }));
    }
    return [];
  }

  private domainItem(node: DomainNode): vscode.TreeItem {
    const scenarioCount = node.group.features.reduce((n, f) => n + f.scenarios.length, 0);
    const item = new vscode.TreeItem(node.group.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.description = `${node.group.features.length} features · ${scenarioCount} scenarios`;
    item.iconPath = new vscode.ThemeIcon("folder");
    item.contextValue = "bddRunnableDomain";
    return item;
  }

  private featureItem(node: FeatureNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.feature.name, vscode.TreeItemCollapsibleState.Collapsed);
    if (node.feature.tags.length > 0) {
      item.description = node.feature.tags.map((t) => `@${t}`).join(" ");
    }
    item.tooltip = path.basename(node.feature.filePath);
    item.iconPath = new vscode.ThemeIcon("file-code");
    item.contextValue = "bddRunnableFeature";
    item.resourceUri = vscode.Uri.file(node.feature.filePath);
    return item;
  }

  private scenarioItem(node: ScenarioNode): vscode.TreeItem {
    const key = scenarioKey(node.feature, node.scenario);
    const outcome = this.outcomes.get(key);
    const item = new vscode.TreeItem(node.scenario.name, vscode.TreeItemCollapsibleState.None);

    const tagText = node.scenario.tags.map((t) => `@${t}`).join(" ");
    const durationMs = this.durations.get(key);
    item.description = [tagText, durationMs !== undefined ? `${durationMs} ms` : ""]
      .filter((s) => s.length > 0)
      .join("  ");

    item.iconPath = outcomeIcon(outcome, node.scenario.isOutline);
    item.contextValue = "bddRunnableScenario";
    item.command = {
      command: "vscode.open",
      title: "Open Feature",
      arguments: [
        vscode.Uri.file(node.feature.filePath),
        { selection: new vscode.Range(node.scenario.line - 1, 0, node.scenario.line - 1, 0) },
      ],
    };
    return item;
  }
}

function outcomeIcon(outcome: TestOutcome | undefined, isOutline: boolean): vscode.ThemeIcon {
  switch (outcome) {
    case "passed":
      return new vscode.ThemeIcon("pass", new vscode.ThemeColor("testing.iconPassed"));
    case "failed":
      return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
    case "skipped":
      return new vscode.ThemeIcon("circle-slash", new vscode.ThemeColor("testing.iconSkipped"));
    default:
      return new vscode.ThemeIcon(isOutline ? "list-tree" : "beaker");
  }
}

export function scenarioKey(feature: FeatureInfo, scenario: ScenarioInfo): string {
  return `${feature.filePath}::${scenario.line}::${scenario.name}`;
}
