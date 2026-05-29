import * as path from "path";
import * as vscode from "vscode";
import { discoverDomains } from "../core/gherkin/discovery";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import {
  DEFAULT_COMPACT_TAG_LIMIT,
  DEFAULT_TAG_DISPLAY,
  TagDisplayMode,
  buildFeatureDescription,
  buildFeatureTooltipMarkdown,
  buildScenarioDescription,
  buildScenarioTooltipMarkdown,
} from "../core/gherkin/treeLabels";
import { TestOutcome, TrxSummary, matchesScenario } from "../core/results/trxParser";
import { UnifiedSummary } from "../core/results/resultLoader";

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
  private allDomains: DomainGroup[] = [];
  private searchQuery = "";
  private outcomes = new Map<string, TestOutcome>();
  private durations = new Map<string, number>();

  constructor(private projectDir: () => string | undefined) {}

  setProjectDir(): void {
    this.refresh();
  }

  refresh(): void {
    const dir = this.projectDir();
    this.allDomains = dir ? discoverDomains(dir) : [];
    this.applySearch();
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
    this.applySearch();
  }

  private applySearch(): void {
    if (!this.searchQuery) {
      this.domains = this.allDomains;
    } else {
      this.domains = this.allDomains
        .map((domain) => ({
          name: domain.name,
          features: domain.features
            .map((feature) => ({
              ...feature,
              scenarios: feature.scenarios.filter((s) => matchesSearch(this.searchQuery, feature, s)),
            }))
            .filter(
              (feature) =>
                matchesSearch(this.searchQuery, feature) || feature.scenarios.length > 0,
            ),
        }))
        .filter((domain) => domain.features.length > 0 || domain.name.toLowerCase().includes(this.searchQuery));
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Applies TRX/Cucumber results, decorating scenarios with pass/fail/skip. */
  applyResults(summary: TrxSummary | UnifiedSummary): void {
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
    const display = readTreeDisplaySettings();
    switch (node.kind) {
      case "domain":
        return this.domainItem(node);
      case "feature":
        return this.featureItem(node, display);
      case "scenario":
        return this.scenarioItem(node, display);
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

  private featureItem(
    node: FeatureNode,
    display: TreeDisplaySettings,
  ): vscode.TreeItem {
    const scenarioCount = node.feature.scenarios.length;
    const item = new vscode.TreeItem(node.feature.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.description = buildFeatureDescription(
      scenarioCount,
      node.feature.tags,
      display.tagDisplay,
      display.compactTagLimit,
    );
    const tooltip = new vscode.MarkdownString(
      buildFeatureTooltipMarkdown(
        node.feature.name,
        path.basename(node.feature.filePath),
        scenarioCount,
        node.feature.tags,
      ),
    );
    tooltip.isTrusted = false;
    item.tooltip = tooltip;
    item.iconPath = new vscode.ThemeIcon("file-code");
    item.contextValue = "bddRunnableFeature";
    item.resourceUri = vscode.Uri.file(node.feature.filePath);
    return item;
  }

  private scenarioItem(
    node: ScenarioNode,
    display: TreeDisplaySettings,
  ): vscode.TreeItem {
    const key = scenarioKey(node.feature, node.scenario);
    const outcome = this.outcomes.get(key);
    const durationMs = this.durations.get(key);

    const item = new vscode.TreeItem(node.scenario.name, vscode.TreeItemCollapsibleState.None);
    item.description = buildScenarioDescription(
      node.scenario.tags,
      display.tagDisplay,
      display.compactTagLimit,
      durationMs,
    );

    const tooltip = new vscode.MarkdownString(
      buildScenarioTooltipMarkdown({
        scenarioName: node.scenario.name,
        featureName: node.feature.name,
        fileName: path.basename(node.feature.filePath),
        line: node.scenario.line,
        featureTags: node.feature.tags,
        scenarioTags: node.scenario.tags,
        isOutline: node.scenario.isOutline,
        outcome,
        durationMs,
      }),
    );
    tooltip.isTrusted = false;
    item.tooltip = tooltip;

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

interface TreeDisplaySettings {
  tagDisplay: TagDisplayMode;
  compactTagLimit: number;
}

function readTreeDisplaySettings(): TreeDisplaySettings {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const raw = cfg.get<string>("tree.tagDisplay", DEFAULT_TAG_DISPLAY);
  const tagDisplay: TagDisplayMode =
    raw === "hidden" || raw === "count" || raw === "compact" || raw === "full" ? raw : DEFAULT_TAG_DISPLAY;
  const compactTagLimit = Math.max(1, cfg.get<number>("tree.compactTagLimit", DEFAULT_COMPACT_TAG_LIMIT));
  return { tagDisplay, compactTagLimit };
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

function matchesSearch(query: string, feature: FeatureInfo, scenario?: ScenarioInfo): boolean {
  const haystack = [
    feature.name,
    feature.filePath,
    ...feature.tags.map((t) => `@${t}`),
    scenario?.name ?? "",
    ...(scenario?.tags.map((t) => `@${t}`) ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}
