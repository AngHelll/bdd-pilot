import * as path from "path";
import * as vscode from "vscode";
import { discoverDomains } from "../core/gherkin/discovery";
import { DomainGroup, FeatureInfo, OutlineExample, ScenarioInfo } from "../core/gherkin/model";
import {
  computeRollup,
  formatRollupDescription,
  prependRollup,
  rollupSeverity,
} from "../core/gherkin/outcomeRollup";
import { effectiveScenarioTags } from "../core/gherkin/tags";
import {
  DEFAULT_COMPACT_TAG_LIMIT,
  DEFAULT_TAG_DISPLAY,
  TagDisplayMode,
  buildFeatureDescription,
  buildFeatureTooltipMarkdown,
  buildScenarioDescription,
  buildScenarioTooltipMarkdown,
} from "../core/gherkin/treeLabels";
import {
  DEFAULT_DURATION_DISPLAY,
  DurationDisplayMode,
  formatDuration,
  formatDurationTooltip,
} from "../core/results/durationFormat";
import { UnifiedSummary } from "../core/results/resultLoader";
import {
  findOutlineExampleMatch,
  matchesScenario,
} from "../core/results/scenarioMatch";
import { TestOutcome, TrxSummary } from "../core/results/trxParser";
import { RunTarget } from "../core/runner/filterBuilder";
import {
  collectOutcomeKeysForTargets,
  outlineRowKey,
  scenarioKey,
} from "../core/runner/runScope";

export type TreeNode = DomainNode | FeatureNode | ScenarioNode | OutlineRowNode;

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

export interface OutlineRowNode {
  kind: "outlineRow";
  feature: FeatureInfo;
  scenario: ScenarioInfo;
  example: OutlineExample;
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

  /** Applies TRX/Cucumber results, decorating scenarios and outline rows. */
  applyResults(summary: TrxSummary | UnifiedSummary): void {
    for (const domain of this.allDomains) {
      for (const feature of domain.features) {
        for (const scenario of feature.scenarios) {
          if (scenario.examples && scenario.examples.length > 0) {
            for (const example of scenario.examples) {
              const match = summary.results.find((r) =>
                findOutlineExampleMatch(r.testName, scenario.name, [example]),
              );
              if (match) {
                const key = outlineRowKey(feature, scenario, example.rowIndex);
                this.outcomes.set(key, match.outcome);
                if (match.durationMs !== undefined) {
                  this.durations.set(key, match.durationMs);
                }
              }
            }
          } else {
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
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  clearResults(): void {
    this.outcomes.clear();
    this.durations.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Clears decorations only for tests in the current run scope so results from
   * prior runs remain visible for everything else.
   */
  clearResultsForRunScope(targets: RunTarget[]): void {
    const scope = collectOutcomeKeysForTargets(targets, this.allDomains);
    if (scope === "all") {
      this.clearResults();
      return;
    }
    if (scope.size === 0) {
      return;
    }
    for (const key of scope) {
      this.outcomes.delete(key);
      this.durations.delete(key);
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Updates tree decorations as individual tests finish (parsed from stdout).
   * Uses throttled refresh to stay light on large parallel runs.
   */
  applyLiveResult(testName: string, outcome: TestOutcome): void {
    let matched = false;
    for (const domain of this.allDomains) {
      for (const feature of domain.features) {
        for (const scenario of feature.scenarios) {
          if (scenario.examples && scenario.examples.length > 0) {
            const example = findOutlineExampleMatch(testName, scenario.name, scenario.examples);
            if (example) {
              this.outcomes.set(outlineRowKey(feature, scenario, example.rowIndex), outcome);
              matched = true;
            }
          } else if (matchesScenario(testName, scenario.name)) {
            this.outcomes.set(scenarioKey(feature, scenario), outcome);
            matched = true;
          }
        }
      }
    }
    if (matched) {
      this.scheduleRefresh();
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshPending) {
      return;
    }
    this.refreshPending = true;
    setTimeout(() => {
      this.refreshPending = false;
      this._onDidChangeTreeData.fire(undefined);
    }, 120);
  }

  private refreshPending = false;

  getTreeItem(node: TreeNode): vscode.TreeItem {
    const display = readTreeDisplaySettings();
    switch (node.kind) {
      case "domain":
        return this.domainItem(node);
      case "feature":
        return this.featureItem(node, display);
      case "scenario":
        return this.scenarioItem(node, display);
      case "outlineRow":
        return this.outlineRowItem(node, display);
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
    if (node.kind === "scenario" && node.scenario.examples && node.scenario.examples.length > 0) {
      return node.scenario.examples.map((example) => ({
        kind: "outlineRow",
        feature: node.feature,
        scenario: node.scenario,
        example,
      }));
    }
    return [];
  }

  private domainItem(node: DomainNode): vscode.TreeItem {
    const scenarioCount = node.group.features.reduce((n, f) => n + f.scenarios.length, 0);
    const rollup = this.rollupFeatureOutcomes(node.group.features);
    const base = `${node.group.features.length} features · ${scenarioCount} scenarios`;
    const item = new vscode.TreeItem(node.group.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.description = prependRollup(base, rollup);
    item.iconPath = containerIcon("folder", rollup);
    item.contextValue = "bddRunnableDomain";
    return item;
  }

  private featureItem(node: FeatureNode, display: TreeDisplaySettings): vscode.TreeItem {
    const scenarioCount = node.feature.scenarios.length;
    const rollup = this.rollupFeatureOutcomes([node.feature]);
    const base = buildFeatureDescription(
      scenarioCount,
      node.feature.tags,
      display.tagDisplay,
      display.compactTagLimit,
    );
    const item = new vscode.TreeItem(node.feature.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.description = prependRollup(base, rollup);
    const tooltip = new vscode.MarkdownString(
      buildFeatureTooltipMarkdown(
        node.feature.name,
        path.basename(node.feature.filePath),
        scenarioCount,
        node.feature.tags,
        formatRollupDescription(rollup),
      ),
    );
    tooltip.isTrusted = false;
    item.tooltip = tooltip;
    item.iconPath = containerIcon("file-code", rollup);
    item.contextValue = "bddRunnableFeature";
    item.resourceUri = vscode.Uri.file(node.feature.filePath);
    return item;
  }

  private scenarioItem(node: ScenarioNode, display: TreeDisplaySettings): vscode.TreeItem {
    const hasExamples = !!node.scenario.examples && node.scenario.examples.length > 0;
    const rollup = hasExamples ? this.rollupScenarioOutcomes(node.feature, node.scenario) : undefined;
    const key = scenarioKey(node.feature, node.scenario);
    const outcome = hasExamples ? rollupToOutcome(rollup) : this.outcomes.get(key);
    const durationMs = hasExamples ? undefined : this.durations.get(key);
    const tags = effectiveScenarioTags(node.feature, node.scenario);

    const item = new vscode.TreeItem(
      node.scenario.name,
      hasExamples ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
    );
    const base = buildScenarioDescription(
      tags,
      display.tagDisplay,
      display.compactTagLimit,
      formatDurationLabel(durationMs, display.durationDisplay),
    );
    item.description = rollup && rollup.withResults > 0 ? prependRollup(base, rollup) : base;

    const tooltip = new vscode.MarkdownString(
      buildScenarioTooltipMarkdown({
        scenarioName: node.scenario.name,
        featureName: node.feature.name,
        fileName: path.basename(node.feature.filePath),
        line: node.scenario.line,
        featureTags: node.feature.tags,
        scenarioTags: node.scenario.tags,
        isOutline: node.scenario.isOutline,
        outcome: outcome,
        durationMs,
        exampleCount: node.scenario.examples?.length,
        rollupSummary: rollup ? formatRollupDescription(rollup) : undefined,
      }),
    );
    tooltip.isTrusted = false;
    item.tooltip = tooltip;

    item.iconPath = outcomeIcon(outcome, node.scenario.isOutline && !hasExamples);
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

  private outlineRowItem(node: OutlineRowNode, display: TreeDisplaySettings): vscode.TreeItem {
    const key = outlineRowKey(node.feature, node.scenario, node.example.rowIndex);
    const outcome = this.outcomes.get(key);
    const durationMs = this.durations.get(key);
    const tags = effectiveScenarioTags(node.feature, node.scenario);

    const item = new vscode.TreeItem(node.example.label, vscode.TreeItemCollapsibleState.None);
    item.description = buildScenarioDescription(
      tags,
      display.tagDisplay,
      display.compactTagLimit,
      formatDurationLabel(durationMs, display.durationDisplay),
    );

    const tooltip = new vscode.MarkdownString(
      [
        `**${node.scenario.name}**`,
        "",
        `Example row: \`${node.example.label}\``,
        "",
        `Feature: ${node.feature.name}`,
        `File: \`${path.basename(node.feature.filePath)}\` · line ${node.scenario.line}`,
        outcome ? `\nLast run: **${outcome}**` : "",
        durationMs !== undefined ? `\n${formatDurationTooltip(durationMs)}` : "",
      ].join("\n"),
    );
    tooltip.isTrusted = false;
    item.tooltip = tooltip;
    item.iconPath = outcomeIcon(outcome, false);
    item.contextValue = "bddRunnableScenario";
    return item;
  }

  private rollupFeatureOutcomes(features: FeatureInfo[]) {
    const values: Array<TestOutcome | undefined> = [];
    for (const feature of features) {
      for (const scenario of feature.scenarios) {
        values.push(...this.collectScenarioOutcomeValues(feature, scenario));
      }
    }
    return computeRollup(values);
  }

  private rollupScenarioOutcomes(feature: FeatureInfo, scenario: ScenarioInfo) {
    return computeRollup(this.collectScenarioOutcomeValues(feature, scenario));
  }

  private collectScenarioOutcomeValues(
    feature: FeatureInfo,
    scenario: ScenarioInfo,
  ): Array<TestOutcome | undefined> {
    if (scenario.examples && scenario.examples.length > 0) {
      return scenario.examples.map((ex) =>
        this.outcomes.get(outlineRowKey(feature, scenario, ex.rowIndex)),
      );
    }
    return [this.outcomes.get(scenarioKey(feature, scenario))];
  }
}

interface TreeDisplaySettings {
  tagDisplay: TagDisplayMode;
  compactTagLimit: number;
  durationDisplay: DurationDisplayMode;
}

function readTreeDisplaySettings(): TreeDisplaySettings {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const raw = cfg.get<string>("tree.tagDisplay", DEFAULT_TAG_DISPLAY);
  const tagDisplay: TagDisplayMode =
    raw === "hidden" || raw === "count" || raw === "compact" || raw === "full" ? raw : DEFAULT_TAG_DISPLAY;
  const compactTagLimit = Math.max(1, cfg.get<number>("tree.compactTagLimit", DEFAULT_COMPACT_TAG_LIMIT));
  const durationRaw = cfg.get<string>("tree.durationDisplay", DEFAULT_DURATION_DISPLAY);
  const durationDisplay: DurationDisplayMode =
    durationRaw === "auto" || durationRaw === "ms" || durationRaw === "seconds" || durationRaw === "compact"
      ? durationRaw
      : DEFAULT_DURATION_DISPLAY;
  return { tagDisplay, compactTagLimit, durationDisplay };
}

function formatDurationLabel(durationMs: number | undefined, mode: DurationDisplayMode): string | undefined {
  return durationMs !== undefined ? formatDuration(durationMs, mode) : undefined;
}

function containerIcon(baseIcon: string, rollup: ReturnType<typeof computeRollup>): vscode.ThemeIcon {
  const severity = rollupSeverity(rollup);
  switch (severity) {
    case "failed":
      return new vscode.ThemeIcon(baseIcon, new vscode.ThemeColor("testing.iconFailed"));
    case "passed":
      return new vscode.ThemeIcon(baseIcon, new vscode.ThemeColor("testing.iconPassed"));
    case "skipped":
      return new vscode.ThemeIcon(baseIcon, new vscode.ThemeColor("testing.iconSkipped"));
    default:
      return new vscode.ThemeIcon(baseIcon);
  }
}

function rollupToOutcome(rollup: ReturnType<typeof computeRollup> | undefined): TestOutcome | undefined {
  if (!rollup || rollup.withResults === 0) {
    return undefined;
  }
  if (rollup.failed > 0) {
    return "failed";
  }
  if (rollup.passed === rollup.withResults) {
    return "passed";
  }
  if (rollup.skipped > 0) {
    return "skipped";
  }
  return undefined;
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

export { outlineRowKey, scenarioKey } from "../core/runner/runScope";

function matchesSearch(query: string, feature: FeatureInfo, scenario?: ScenarioInfo): boolean {
  const haystack = [
    feature.name,
    feature.filePath,
    ...feature.tags.map((t) => `@${t}`),
    scenario?.name ?? "",
    ...(scenario ? effectiveScenarioTags(feature, scenario).map((t) => `@${t}`) : []),
    ...(scenario?.examples?.map((ex) => ex.label) ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}
