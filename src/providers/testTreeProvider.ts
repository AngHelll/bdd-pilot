import * as path from "path";
import * as vscode from "vscode";
import { discoverDomains } from "../core/gherkin/discovery";
import {
  countFeaturesInDomains,
  resolveTreeEmptyKind,
  TreeEmptyKind,
} from "../core/gherkin/treeEmptyState";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import { PilotLocale } from "../core/i18n";
import {
  computeRollup,
  containerHealth,
  formatRollupDescription,
  formatRollupDescriptionLocalized,
  rollupSeverity,
} from "../core/gherkin/outcomeRollup";
import {
  conciseContainerDescription,
  conciseLeafDescription,
} from "../core/gherkin/conciseTreeDescription";
import {
  shouldTintContainerIcon,
  TreeDisplayMode,
} from "../core/gherkin/treeContainerLabels";
import {
  formatOutcomeForTooltip,
  truncateErrorSnippet,
} from "../core/results/outcomeFeedback";
import {
  skipReasonLabelForTreeOutcome,
  skipReasonMessage,
} from "../core/results/skipReason";
import {
  resolveLeafIconSpec,
  treeRowDurationMs,
  TreeLeafIconSpec,
} from "../core/results/treeLeafVisual";
import {
  applyScopedTrxResults,
  applyTrxMatchesToStore,
  TreeMappingReport,
} from "../core/results/trxTreeMapping";
import { groupByTag, TagGroup } from "../core/gherkin/groupByTag";
import {
  collectFilteredRunTargets,
  filterDomainsBySearch,
  normalizeSearchQuery,
  tagGroupMatchesSearch,
} from "../core/gherkin/treeSearch";
import {
  buildDomainTooltipMarkdown,
  buildFeatureTooltipMarkdown,
  buildScenarioTooltipMarkdown,
  treeLeafNavigationLine,
} from "../core/gherkin/treeLabels";
import {
  containerResultStateLabel,
  formatTreeLeafLabel,
  leafResultStateLabel,
  nativeAccessibilityLabel,
  prependScenarioLevelTooltip,
  TreeA11yLevel,
  TreeLeafLevel,
} from "../core/gherkin/treePresentation";
import {
  TreeDisplaySettings,
  TreeGroupBy,
} from "../core/gherkin/treeDisplaySettings";
import {
  domainTreeItemId,
  emptyGuideTreeItemId,
  ExpandRef,
  featureTreeItemId,
  PlacedNode,
  resolveVisibleParent,
  scenarioNodeIsOutline,
  summaryTreeItemId,
  tagFailureExpandRefs,
  tagIdentityKey,
  tagTreeItemId,
  TagPlacement,
  TREE_ITEM_CONTEXT,
  visibleExampleItemId,
  visibleScenarioItemId,
} from "../core/gherkin/treeIdentity";
import {
  DomainNode,
  EmptyGuideNode,
  FeatureNode,
  OutlineRowNode,
  PilotSummaryNode,
  ScenarioNode,
  TagNode,
  TreeNode,
} from "../core/gherkin/treeNodes";
import {
  collectFailedLeaves,
  containerKeysToExpandForFailures,
} from "../core/results/failureTreeNav";
import { readTreeDisplaySettings, readTreeGroupBy, readTreePresentation } from "./treeSettings";
import { DurationDisplayMode, formatDuration } from "../core/results/durationFormat";
import { UnifiedSummary } from "../core/results/resultLoader";
import {
  buildLiveMatchIndex,
  liveOutcomeKey,
  LiveMatchIndex,
  selectLiveMatchCandidates,
} from "../core/results/liveMatchIndex";
import { TestOutcome, TrxSummary } from "../core/results/trxParser";
import { RunTarget } from "../core/runner/filterBuilder";
import {
  collectOutcomeKeysForTargets,
  outlineRowKey,
  scenarioKey,
} from "../core/runner/runScope";
import {
  applySavedFeature as applySavedFeatureModel,
  indexFeatureFileKeys,
  removeSavedFeature,
  renameSavedFeature,
} from "../core/gherkin/featureFileSync";
import { enrichFeaturesWithTheoryTests, scenarioNeedsTheoryDiscovery } from "../core/gherkin/theoryExamples";
import {
  formatPilotSummaryDescription,
  formatPilotSummaryFilterTooltip,
  formatPilotSummaryLabel,
  formatSummaryDiagnosticTooltip,
  formatTrxDivergenceTooltip,
  PilotSummaryViewModel,
  resolvePilotSummaryCommand,
  resolvePilotSummaryIcon,
  resolveSummaryDiagnostic,
} from "../core/results/pilotSummaryViewModel";
import { t } from "../core/i18n";
import { OutcomeStore } from "./outcomeStore";

export type { TreeGroupBy, TreeDisplaySettings };
export { readTreeDisplaySettings, readTreeGroupBy } from "./treeSettings";
export type {
  TreeNode,
  PilotSummaryNode,
  EmptyGuideNode,
  DomainNode,
  TagNode,
  FeatureNode,
  ScenarioNode,
  OutlineRowNode,
} from "../core/gherkin/treeNodes";
export { TREE_ITEM_CONTEXT, contextValueAllowsRunAndDebug } from "../core/gherkin/treeIdentity";

export class TestTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private domains: DomainGroup[] = [];
  private tagGroups: TagGroup[] = [];
  private allDomains: DomainGroup[] = [];
  private searchQuery = "";
  private searchQueryDisplay = "";
  private refreshPending = false;
  private fileKeys = new Map<string, string>();
  private liveMatchIndex: LiveMatchIndex | undefined;

  constructor(
    private projectDir: () => string | undefined,
    private readonly outcomeStore: OutcomeStore,
    private readonly getLocale: () => PilotLocale = () => "en",
    private readonly getPilotSummary: () => PilotSummaryViewModel = () => ({
      running: false,
    }),
    private readonly onSearchQueryChanged?: (displayQuery: string) => void,
  ) {}

  /** Refreshes the pilot summary row without re-scanning features. */
  refreshPilotSummary(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Repaints the tree from the current model. Does not rescan feature files. */
  rerender(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setProjectDir(): void {
    this.refresh();
  }

  refresh(): void {
    const dir = this.projectDir();
    this.allDomains = dir ? discoverDomains(dir) : [];
    this.fileKeys = indexFeatureFileKeys(this.allDomains);
    this.applySearch();
  }

  /** Replaces one parsed feature. Returns false when its file identity did not change. */
  applyParsedFeature(feature: FeatureInfo): boolean {
    const next = applySavedFeatureModel(this.allDomains, this.fileKeys, feature);
    if (!next.changed) {
      return false;
    }
    this.allDomains = next.domains;
    this.fileKeys = next.fileKeys;
    this.applySearch();
    return true;
  }

  removeFeatureFile(filePath: string): boolean {
    const next = removeSavedFeature(this.allDomains, this.fileKeys, filePath);
    if (!next.changed) {
      return false;
    }
    this.allDomains = next.domains;
    this.fileKeys = next.fileKeys;
    this.applySearch();
    return true;
  }

  renameFeatureFile(oldPath: string, newPath: string): boolean {
    const next = renameSavedFeature(this.allDomains, this.fileKeys, oldPath, newPath);
    if (!next.changed) {
      return false;
    }
    this.allDomains = next.domains;
    this.fileKeys = next.fileKeys;
    this.applySearch();
    return true;
  }

  getDomains(): DomainGroup[] {
    return this.allDomains;
  }

  getOutcomeStore(): OutcomeStore {
    return this.outcomeStore;
  }

  /**
   * Required for TreeView.reveal. The parent is the one on screen:
   * domain → feature → scenario → example, or tag → scenario → example.
   */
  getParent(element: TreeNode): TreeNode | undefined {
    const parent = resolveVisibleParent(
      placedNode(element),
      readTreeGroupBy(),
      this.domains.map((domain) => ({
        name: domain.name,
        features: domain.features.map((feature) => ({ filePath: feature.filePath })),
      })),
      this.tagPlacements(),
    );
    if (!parent) {
      return undefined;
    }
    return this.hydrateParent(parent, element);
  }

  /**
   * Containers that collapse-to-failures re-expands. Domain grouping keeps the
   * existing domain / feature / outline list. Tag grouping expands each tag
   * that shows a failure, plus outline parents when the failure is an example.
   */
  nodesToExpandForFailures(includeOutcomeKey?: (outcomeKey: string) => boolean): TreeNode[] {
    const domains = this.allDomains;
    if (readTreeGroupBy() === "tag") {
      const leaves = collectFailedLeaves(domains, this.outcomeStore, includeOutcomeKey);
      const refs = tagFailureExpandRefs(
        leaves.map((leaf) => ({
          filePath: leaf.feature.filePath,
          scenarioLine: leaf.scenario.line,
          rowIndex: leaf.outlineRowIndex,
        })),
        this.getTagGroups().map((group) => ({
          tag: group.tag,
          scenarios: group.scenarios.map((ref) => ({
            filePath: ref.feature.filePath,
            line: ref.scenario.line,
          })),
        })),
      );
      const nodes: TreeNode[] = [];
      for (const ref of refs) {
        const node = this.nodeForExpandRef(ref);
        if (node) {
          nodes.push(node);
        }
      }
      return nodes;
    }

    const containers = containerKeysToExpandForFailures(
      domains,
      this.outcomeStore,
      includeOutcomeKey ? { includeOutcomeKey } : undefined,
    );
    const nodes: TreeNode[] = [];
    for (const container of containers) {
      let node: TreeNode | undefined;
      if (container.kind === "domain") {
        node = this.findDomainNode(container.id);
      } else if (container.kind === "feature") {
        node = this.findFeatureNode(container.id);
      } else {
        const featurePath = container.id.split("::")[0];
        node = this.findScenarioOutlineNode(featurePath, container.id);
      }
      if (node) {
        nodes.push(node);
      }
    }
    return nodes;
  }

  /** Resolve a leaf TreeNode for an outcome key. Tag placement is resolved by getParent. */
  findLeafNodeByOutcomeKey(outcomeKey: string): TreeNode | undefined {
    for (const domain of this.allDomains) {
      for (const feature of domain.features) {
        for (const scenario of feature.scenarios) {
          if (scenario.examples && scenario.examples.length > 0) {
            for (const example of scenario.examples) {
              if (outlineRowKey(feature, scenario, example.rowIndex) === outcomeKey) {
                return { kind: "outlineRow", feature, scenario, example };
              }
            }
            continue;
          }
          if (scenarioKey(feature, scenario) === outcomeKey) {
            return { kind: "scenario", feature, scenario };
          }
        }
      }
    }
    return undefined;
  }

  findDomainNode(name: string): DomainNode | undefined {
    const group = this.allDomains.find((d) => d.name === name);
    return group ? { kind: "domain", group } : undefined;
  }

  findFeatureNode(filePath: string): FeatureNode | undefined {
    for (const domain of this.allDomains) {
      const feature = domain.features.find((f) => f.filePath === filePath);
      if (feature) {
        return { kind: "feature", feature };
      }
    }
    return undefined;
  }

  findScenarioOutlineNode(featurePath: string, scenarioOutcomeKey: string): ScenarioNode | undefined {
    for (const domain of this.allDomains) {
      for (const feature of domain.features) {
        if (feature.filePath !== featurePath) {
          continue;
        }
        for (const scenario of feature.scenarios) {
          if (scenarioKey(feature, scenario) === scenarioOutcomeKey) {
            return { kind: "scenario", feature, scenario };
          }
        }
      }
    }
    return undefined;
  }

  getEmptyKind(): TreeEmptyKind {
    const hasProject = this.projectDir() !== undefined;
    const totalFeatureCount = countFeaturesInDomains(this.allDomains);
    const visibleFeatureCount = countFeaturesInDomains(this.domains);
    return resolveTreeEmptyKind({
      hasProject,
      totalFeatureCount,
      visibleFeatureCount,
      searchActive: this.searchQuery.length > 0,
    });
  }

  /** Tag groups from full discovery (Test Explorer tag mode; ignores tree search filter). */
  getTagGroups(): TagGroup[] {
    return groupByTag(this.allDomains);
  }

  /** Fills missing outline rows from `dotnet test --list-tests` when needed. */
  enrichTheoryRows(listTests: () => Promise<string[]>, signal?: AbortSignal): Promise<boolean> {
    if (!this.needsTheoryDiscovery()) {
      return Promise.resolve(false);
    }

    return listTests()
      .then((testNames) => {
        let enriched = 0;
        for (const domain of this.allDomains) {
          enriched += enrichFeaturesWithTheoryTests(domain.features, testNames);
        }
        if (enriched > 0) {
          this.applySearch();
          return true;
        }
        return false;
      })
      .catch((err) => {
        if (signal?.aborted) {
          throw err;
        }
        return false;
      });
  }

  setSearchQuery(query: string): void {
    this.searchQueryDisplay = query.trim();
    this.searchQuery = normalizeSearchQuery(this.searchQueryDisplay);
    this.applySearch();
    this.onSearchQueryChanged?.(this.searchQueryDisplay);
  }

  getSearchQuery(): string {
    return this.searchQueryDisplay;
  }

  isSearchActive(): boolean {
    return this.searchQuery.length > 0;
  }

  getFilteredDomains(): DomainGroup[] {
    return this.domains;
  }

  hasFilteredRunnableLeaves(): boolean {
    return collectFilteredRunTargets(this.domains).length > 0;
  }

  getFilteredRunTargets(): RunTarget[] {
    return collectFilteredRunTargets(this.domains);
  }

  private applySearch(): void {
    const filtered = filterDomainsBySearch(this.allDomains, this.searchQuery);
    this.domains = filtered;
    this.tagGroups = groupByTag(filtered).filter((group) =>
      tagGroupMatchesSearch(group.tag, group.scenarios.length, this.searchQuery),
    );
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Applies TRX/Cucumber results, decorating scenarios and outline rows. */
  applyResults(summary: TrxSummary | UnifiedSummary): void {
    applyTrxMatchesToStore(this.outcomeStore, this.allDomains, summary);
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Applies TRX for a scoped run (marks unmapped) or Run All (honesty unused only).
   */
  applyScopedResults(
    summary: TrxSummary | UnifiedSummary,
    targets: RunTarget[],
    options?: { canceled?: boolean },
  ): TreeMappingReport | undefined {
    const stats = applyScopedTrxResults(
      this.outcomeStore,
      this.allDomains,
      summary,
      targets,
      options,
    );
    this._onDidChangeTreeData.fire(undefined);
    return stats;
  }

  needsTheoryDiscovery(): boolean {
    return this.allDomains.some((domain) =>
      domain.features.some((feature) =>
        feature.scenarios.some((scenario) => scenarioNeedsTheoryDiscovery(scenario)),
      ),
    );
  }

  clearResults(): void {
    this.outcomeStore.clearAll();
    this._onDidChangeTreeData.fire(undefined);
  }

  clearResultsForRunScope(targets: RunTarget[]): void {
    const scope = collectOutcomeKeysForTargets(targets, this.allDomains);
    if (scope === "all") {
      this.clearResults();
      return;
    }
    if (scope.size === 0) {
      return;
    }
    this.outcomeStore.clearForRunScope(targets, this.allDomains);
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Updates tree decorations as individual tests finish (parsed from stdout).
   * Uses throttled refresh to stay light on large parallel runs.
   */
  applyLiveResult(testName: string, outcome: TestOutcome): void {
    const index = this.liveMatchIndexFor(this.allDomains);
    const candidates = selectLiveMatchCandidates(index, testName);
    let matched = false;
    for (const ref of candidates.scenarios) {
      const key = liveOutcomeKey(ref.feature, ref.scenario, testName);
      if (!key) {
        continue;
      }
      this.outcomeStore.set(key, outcome);
      matched = true;
    }
    if (matched) {
      this.scheduleRefresh();
    }
  }

  /** Rebuilt when discovery replaces the domain array. Example rows are read live. */
  private liveMatchIndexFor(domains: DomainGroup[]): LiveMatchIndex {
    if (!this.liveMatchIndex || this.liveMatchIndex.domains !== domains) {
      this.liveMatchIndex = buildLiveMatchIndex(domains);
    }
    return this.liveMatchIndex;
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

  getTreeItem(node: TreeNode): vscode.TreeItem {
    const display = readTreeDisplaySettings();
    switch (node.kind) {
      case "pilotSummary":
        return this.pilotSummaryItem();
      case "emptyGuide":
        return this.emptyGuideItem(node);
      case "domain":
        return this.domainItem(node, display);
      case "tag":
        return this.tagItem(node, display);
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
      const summaryRow: PilotSummaryNode = { kind: "pilotSummary" };
      const emptyKind = this.getEmptyKind();
      const guideRow: EmptyGuideNode | undefined =
        emptyKind !== "none" ? { kind: "emptyGuide", emptyKind } : undefined;
      const prefix: TreeNode[] = guideRow ? [summaryRow, guideRow] : [summaryRow];
      if (readTreeGroupBy() === "tag") {
        return [...prefix, ...this.tagGroups.map((group) => ({ kind: "tag" as const, group }))];
      }
      return [...prefix, ...this.domains.map((group) => ({ kind: "domain" as const, group }))];
    }
    if (node.kind === "pilotSummary" || node.kind === "emptyGuide") {
      return [];
    }
    if (node.kind === "tag") {
      const parentTagKey = tagIdentityKey(node.group.tag);
      return node.group.scenarios.map((ref) => ({
        kind: "scenario" as const,
        feature: ref.feature,
        scenario: ref.scenario,
        underTagGroup: true,
        parentTagKey,
      }));
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
        kind: "outlineRow" as const,
        feature: node.feature,
        scenario: node.scenario,
        example,
        parentTagKey: node.parentTagKey,
      }));
    }
    return [];
  }

  private pilotSummaryItem(): vscode.TreeItem {
    const locale = this.getLocale();
    const model = this.getPilotSummary();
    const status = formatPilotSummaryLabel(model, locale);
    const filterActive = !!model.searchQuery;
    const diagnostic = resolveSummaryDiagnostic(model);
    const storeFailure = model.storeFailureSnippet;
    const summaryCommand = resolvePilotSummaryCommand(model, locale);
    const item = new vscode.TreeItem(status, vscode.TreeItemCollapsibleState.None);
    item.id = summaryTreeItemId();
    item.iconPath = new vscode.ThemeIcon(
      resolvePilotSummaryIcon(
        model.running,
        model.debugging ?? false,
        diagnostic,
        !!storeFailure,
      ),
    );
    item.command = {
      command: summaryCommand.command,
      title: summaryCommand.title,
    };
    const description = formatPilotSummaryDescription(model, locale);
    if (description) {
      item.description = description;
    }
    const tooltipParts: string[] = [];
    if (model.running) {
      tooltipParts.push(summaryCommand.title);
    } else if (filterActive && model.searchQuery) {
      tooltipParts.push(formatPilotSummaryFilterTooltip(model.searchQuery, locale));
    }
    if (model.lastKnown?.trx) {
      tooltipParts.push(formatTrxDivergenceTooltip(locale));
    }
    if (diagnostic) {
      tooltipParts.push(formatSummaryDiagnosticTooltip(diagnostic, locale));
    } else if (storeFailure) {
      tooltipParts.push(storeFailure);
    }
    if (tooltipParts.length > 0) {
      const tooltip = new vscode.MarkdownString(tooltipParts.join("\n\n"));
      tooltip.isTrusted = false;
      item.tooltip = tooltip;
    } else {
      const tooltip = new vscode.MarkdownString(`*${summaryCommand.title}*`);
      tooltip.isTrusted = false;
      item.tooltip = tooltip;
    }
    item.contextValue = model.running ? TREE_ITEM_CONTEXT.summaryRunning : TREE_ITEM_CONTEXT.summary;
    applyExperimentalAccessibility(
      item,
      locale,
      "summary",
      status,
      model.running ? t(locale, "tree.a11y.running") : undefined,
    );
    return item;
  }

  private emptyGuideItem(node: EmptyGuideNode): vscode.TreeItem {
    const locale = this.getLocale();
    const { emptyKind } = node;
    let title: string;
    let subtitle: string;
    let tooltip: vscode.MarkdownString | undefined;
    let command: string | undefined;
    let icon: string;

    switch (emptyKind) {
      case "no_project":
        title = t(locale, "tree.guideNoProject.title");
        subtitle = t(locale, "tree.guideNoProject.subtitle");
        command = "bddPilot.selectProject";
        icon = "warning";
        break;
      case "no_features":
        title = t(locale, "tree.guideNoFeatures.title");
        subtitle = t(locale, "tree.guideNoFeatures.subtitle");
        tooltip = new vscode.MarkdownString(t(locale, "tree.guideNoFeatures.tooltip"));
        icon = "info";
        break;
      case "search_no_match":
        title = t(locale, "tree.guideSearch.title");
        subtitle = t(locale, "tree.guideSearch.subtitle");
        tooltip = new vscode.MarkdownString(t(locale, "tree.guideSearch.tooltip"));
        command = "bddPilot.searchTests";
        icon = "info";
        break;
    }

    const item = new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.None);
    item.id = emptyGuideTreeItemId(emptyKind);
    item.description = subtitle;
    item.iconPath = new vscode.ThemeIcon(icon);
    item.contextValue = TREE_ITEM_CONTEXT.empty;
    if (command) {
      item.command = { command, title: subtitle };
    }
    if (tooltip) {
      tooltip.isTrusted = true;
      item.tooltip = tooltip;
    }
    applyExperimentalAccessibility(item, locale, "guide", title);
    return item;
  }

  private tagItem(node: TagNode, display: TreeDisplaySettings): vscode.TreeItem {
    const locale = this.getLocale();
    const refs = node.group.scenarios;
    const rollup = computeRollup(
      refs.flatMap((ref) => this.collectScenarioOutcomeValues(ref.feature, ref.scenario)),
    );
    const item = new vscode.TreeItem(`@${node.group.tag}`, vscode.TreeItemCollapsibleState.Collapsed);
    item.id = tagTreeItemId(node.group.tag);
    assignConciseDescription(item, conciseContainerDescription(rollup, locale));
    item.iconPath = containerIcon("tag", rollup, display.displayMode);
    item.contextValue = TREE_ITEM_CONTEXT.tag;
    item.tooltip = new vscode.MarkdownString(
      [`**@${node.group.tag}**`, "", `${refs.length} scenario(s)`, formatRollupDescription(rollup)].join("\n"),
    );
    applyExperimentalAccessibility(
      item,
      locale,
      "tag",
      `@${node.group.tag}`,
      containerResultStateLabel(locale, rollupSeverity(rollup)),
    );
    return item;
  }

  private domainItem(node: DomainNode, display: TreeDisplaySettings): vscode.TreeItem {
    const locale = this.getLocale();
    const scenarioCount = node.group.features.reduce((n, f) => n + f.scenarios.length, 0);
    const rollup = this.rollupFeatureOutcomes(node.group.features);
    const item = new vscode.TreeItem(node.group.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.id = domainTreeItemId(node.group.name);
    assignConciseDescription(item, conciseContainerDescription(rollup, locale));
    item.iconPath = containerIcon("folder", rollup, display.displayMode);
    item.contextValue = TREE_ITEM_CONTEXT.domain;
    const rollupText = formatRollupDescriptionLocalized(rollup, locale) ?? formatRollupDescription(rollup);
    const tooltip = new vscode.MarkdownString(
      buildDomainTooltipMarkdown(
        node.group.name,
        node.group.features.length,
        scenarioCount,
        rollupText,
      ),
    );
    tooltip.isTrusted = false;
    item.tooltip = tooltip;
    applyExperimentalAccessibility(
      item,
      locale,
      "domain",
      node.group.name,
      containerResultStateLabel(locale, rollupSeverity(rollup)),
    );
    return item;
  }

  private featureItem(node: FeatureNode, display: TreeDisplaySettings): vscode.TreeItem {
    const scenarioCount = node.feature.scenarios.length;
    const rollup = this.rollupFeatureOutcomes([node.feature]);
    const locale = this.getLocale();
    const item = new vscode.TreeItem(node.feature.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.id = featureTreeItemId(node.feature.filePath);
    assignConciseDescription(item, conciseContainerDescription(rollup, locale));
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
    item.iconPath = containerIcon("file-code", rollup, display.displayMode);
    item.contextValue = TREE_ITEM_CONTEXT.feature;
    item.resourceUri = vscode.Uri.file(node.feature.filePath);
    applyExperimentalAccessibility(
      item,
      locale,
      "feature",
      node.feature.name,
      containerResultStateLabel(locale, rollupSeverity(rollup)),
    );
    return item;
  }

  private scenarioItem(node: ScenarioNode, display: TreeDisplaySettings): vscode.TreeItem {
    const locale = this.getLocale();
    const hasExamples = !!node.scenario.examples && node.scenario.examples.length > 0;
    const rollup = hasExamples ? this.rollupScenarioOutcomes(node.feature, node.scenario) : undefined;
    const key = scenarioKey(node.feature, node.scenario);
    const outcome = hasExamples ? rollupToOutcome(rollup) : this.outcomeStore.get(key);
    const skipReason = hasExamples ? undefined : this.outcomeStore.getSkipReason(key);
    const durationMs = treeRowDurationMs(
      hasExamples ? undefined : this.outcomeStore.getDuration(key),
    );
    const errorMessage = hasExamples ? undefined : this.outcomeStore.getErrorMessage(key);

    const presentation = readTreePresentation();
    const level: TreeLeafLevel = node.scenario.isOutline || hasExamples ? "outline" : "scenario";
    const item = new vscode.TreeItem(
      formatTreeLeafLabel(level, node.scenario.name, locale, presentation),
      hasExamples ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
    );
    item.id = visibleScenarioItemId(
      node.feature.filePath,
      node.scenario.line,
      scenarioNodeIsOutline(node.scenario),
      node.parentTagKey,
      readTreeGroupBy(),
      this.tagPlacements(),
    );
    if (hasExamples) {
      assignConciseDescription(
        item,
        rollup ? conciseContainerDescription(rollup, locale) : "",
      );
    } else {
      const showPendingHint =
        !this.outcomeStore.isEmpty() && !outcome && !skipReason;
      assignConciseDescription(
        item,
        conciseLeafDescription({
          outcome,
          skipReason,
          errorSnippet: errorMessage,
          locale,
          durationMs,
          durationDisplay: display.durationDisplay,
          showPendingHint,
        }),
      );
    }

    const rollupText = rollup
      ? formatRollupDescriptionLocalized(rollup, locale) ?? formatRollupDescription(rollup)
      : undefined;
    const tooltipMarkdown = buildScenarioTooltipMarkdown(
      {
        scenarioName: node.scenario.name,
        featureName: node.feature.name,
        fileName: path.basename(node.feature.filePath),
        line: node.scenario.line,
        featureTags: node.feature.tags,
        scenarioTags: node.scenario.tags,
        isOutline: node.scenario.isOutline,
        outcomeLabel: outcome ? formatOutcomeForTooltip(outcome, locale) : undefined,
        durationMs,
        exampleCount: node.scenario.examples?.length,
        rollupSummary: rollupText,
        errorSnippet:
          outcome === "failed" && errorMessage
            ? truncateErrorSnippet(errorMessage)
            : undefined,
        skipReasonLabel: skipReason
          ? skipReasonMessage(skipReason, locale)
          : skipReasonLabelForTreeOutcome(outcome, locale),
      },
      locale,
    );
    const tooltip = new vscode.MarkdownString(
      level === "scenario"
        ? prependScenarioLevelTooltip(tooltipMarkdown, locale, presentation)
        : tooltipMarkdown,
    );
    tooltip.isTrusted = false;
    item.tooltip = tooltip;

    const sessionHasResults = !this.outcomeStore.isEmpty();
    item.iconPath = themeIconFromSpec(
      resolveLeafIconSpec({
        presentation,
        level,
        classicBareOutline: node.scenario.isOutline && !hasExamples,
        outcome,
        skipReason,
        sessionHasResults,
      }),
    );
    applyExperimentalAccessibility(
      item,
      locale,
      level,
      node.scenario.name,
      hasExamples
        ? containerResultStateLabel(locale, rollup ? rollupSeverity(rollup) : undefined)
        : leafResultStateLabel(locale, outcome, skipReason),
      hasExamples ? undefined : formatDurationLabel(durationMs, display.durationDisplay),
    );
    item.contextValue = TREE_ITEM_CONTEXT.scenario;
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
    const locale = this.getLocale();
    const key = outlineRowKey(node.feature, node.scenario, node.example.rowIndex);
    const outcome = this.outcomeStore.get(key);
    const skipReason = this.outcomeStore.getSkipReason(key);
    const durationMs = treeRowDurationMs(this.outcomeStore.getDuration(key));
    const errorMessage = this.outcomeStore.getErrorMessage(key);

    const presentation = readTreePresentation();
    const navigationLine = treeLeafNavigationLine(node.scenario.line, node.example.line);
    const item = new vscode.TreeItem(
      formatTreeLeafLabel("example", node.example.label, locale, presentation),
      vscode.TreeItemCollapsibleState.None,
    );
    item.id = visibleExampleItemId(
      node.feature.filePath,
      node.scenario.line,
      node.example.rowIndex,
      node.parentTagKey,
      readTreeGroupBy(),
      this.tagPlacements(),
    );
    const showPendingHint = !this.outcomeStore.isEmpty() && !outcome && !skipReason;
    assignConciseDescription(
      item,
      conciseLeafDescription({
        outcome,
        skipReason,
        errorSnippet: errorMessage,
        locale,
        durationMs,
        durationDisplay: display.durationDisplay,
        showPendingHint,
      }),
    );

    const tooltip = new vscode.MarkdownString(
      buildScenarioTooltipMarkdown(
        {
          scenarioName: node.scenario.name,
          featureName: node.feature.name,
          fileName: path.basename(node.feature.filePath),
          line: navigationLine,
          featureTags: node.feature.tags,
          scenarioTags: node.scenario.tags,
          isOutline: true,
          exampleRowLabel: node.example.label,
          outcomeLabel: outcome ? formatOutcomeForTooltip(outcome, locale) : undefined,
          durationMs,
          errorSnippet:
            outcome === "failed" && errorMessage
              ? truncateErrorSnippet(errorMessage)
              : undefined,
          skipReasonLabel: skipReason
            ? skipReasonMessage(skipReason, locale)
            : skipReasonLabelForTreeOutcome(outcome, locale),
        },
        locale,
      ),
    );
    tooltip.isTrusted = false;
    item.tooltip = tooltip;
    item.iconPath = themeIconFromSpec(
      resolveLeafIconSpec({
        presentation,
        level: "example",
        classicBareOutline: false,
        outcome,
        skipReason,
        sessionHasResults: !this.outcomeStore.isEmpty(),
      }),
    );
    applyExperimentalAccessibility(
      item,
      locale,
      "example",
      node.example.label,
      leafResultStateLabel(locale, outcome, skipReason),
      formatDurationLabel(durationMs, display.durationDisplay),
    );
    item.contextValue = TREE_ITEM_CONTEXT.scenario;
    item.command = {
      command: "vscode.open",
      title: "Open Feature",
      arguments: [
        vscode.Uri.file(node.feature.filePath),
        {
          selection: new vscode.Range(navigationLine - 1, 0, navigationLine - 1, 0),
        },
      ],
    };
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
        this.outcomeStore.get(outlineRowKey(feature, scenario, ex.rowIndex)),
      );
    }
    return [this.outcomeStore.get(scenarioKey(feature, scenario))];
  }

  private tagPlacements(): TagPlacement[] {
    return this.tagGroups.map((group) => ({
      tag: group.tag,
      scenarios: group.scenarios.map((ref) => ({
        filePath: ref.feature.filePath,
        line: ref.scenario.line,
      })),
    }));
  }

  private hydrateParent(parent: PlacedNode, child: TreeNode): TreeNode | undefined {
    if (parent.kind === "domain" && parent.domainName) {
      const group = this.domains.find((domain) => domain.name === parent.domainName);
      return group ? { kind: "domain", group } : undefined;
    }
    if (parent.kind === "tag" && parent.tag) {
      const group = this.tagGroups.find((candidate) => tagIdentityKey(candidate.tag) === parent.tag);
      return group ? { kind: "tag", group } : undefined;
    }
    if (parent.kind === "feature" && child.kind === "scenario") {
      return { kind: "feature", feature: child.feature };
    }
    if (parent.kind === "scenario" && child.kind === "outlineRow") {
      return {
        kind: "scenario",
        feature: child.feature,
        scenario: child.scenario,
        underTagGroup: readTreeGroupBy() === "tag",
        parentTagKey: parent.parentTagKey,
      };
    }
    return undefined;
  }

  private nodeForExpandRef(ref: ExpandRef): TreeNode | undefined {
    if (ref.kind === "tag") {
      const group = this.getTagGroups().find((candidate) => tagIdentityKey(candidate.tag) === ref.tagKey);
      return group ? { kind: "tag", group } : undefined;
    }
    if (!ref.filePath || ref.line === undefined) {
      return undefined;
    }
    for (const domain of this.allDomains) {
      for (const feature of domain.features) {
        if (feature.filePath !== ref.filePath) {
          continue;
        }
        const scenario = feature.scenarios.find((candidate) => candidate.line === ref.line);
        if (scenario) {
          return {
            kind: "scenario",
            feature,
            scenario,
            underTagGroup: true,
            parentTagKey: ref.tagKey,
          };
        }
      }
    }
    return undefined;
  }
}

function placedNode(element: TreeNode): PlacedNode {
  switch (element.kind) {
    case "pilotSummary":
      return { kind: "pilotSummary" };
    case "emptyGuide":
      return { kind: "emptyGuide" };
    case "domain":
      return { kind: "domain", domainName: element.group.name };
    case "tag":
      return { kind: "tag", tag: tagIdentityKey(element.group.tag) };
    case "feature":
      return { kind: "feature", filePath: element.feature.filePath };
    case "scenario":
      return {
        kind: "scenario",
        filePath: element.feature.filePath,
        line: element.scenario.line,
        parentTagKey: element.parentTagKey,
      };
    case "outlineRow":
      return {
        kind: "outlineRow",
        filePath: element.feature.filePath,
        line: element.scenario.line,
        rowIndex: element.example.rowIndex,
        parentTagKey: element.parentTagKey,
      };
  }
}

function assignConciseDescription(
  item: vscode.TreeItem,
  description: string | undefined,
): void {
  if (description) {
    item.description = description;
  }
}

function formatDurationLabel(durationMs: number | undefined, mode: DurationDisplayMode): string | undefined {
  const presentable = treeRowDurationMs(durationMs);
  return presentable !== undefined ? formatDuration(presentable, mode) : undefined;
}

function containerIcon(
  baseIcon: string,
  rollup: ReturnType<typeof computeRollup>,
  mode: TreeDisplayMode,
): vscode.ThemeIcon {
  if (!shouldTintContainerIcon(mode, rollup)) {
    return new vscode.ThemeIcon(baseIcon);
  }
  const health = containerHealth(rollup);
  switch (health) {
    case "watch":
      return new vscode.ThemeIcon(baseIcon, new vscode.ThemeColor("list.warningForeground"));
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

function themeIconFromSpec(spec: TreeLeafIconSpec): vscode.ThemeIcon {
  switch (spec.color) {
    case "passed":
      return new vscode.ThemeIcon(spec.id, new vscode.ThemeColor("testing.iconPassed"));
    case "failed":
      return new vscode.ThemeIcon(spec.id, new vscode.ThemeColor("testing.iconFailed"));
    case "skipped":
      return new vscode.ThemeIcon(spec.id, new vscode.ThemeColor("testing.iconSkipped"));
    default:
      return new vscode.ThemeIcon(spec.id);
  }
}

function applyExperimentalAccessibility(
  item: vscode.TreeItem,
  locale: PilotLocale,
  level: TreeA11yLevel,
  name: string,
  state?: string,
  duration?: string,
): void {
  const label = nativeAccessibilityLabel(
    readTreePresentation(),
    locale,
    level,
    name,
    state,
    duration,
  );
  if (!label) {
    return;
  }
  item.accessibilityInformation = { label };
}

export { outlineRowKey, scenarioKey } from "../core/runner/runScope";
