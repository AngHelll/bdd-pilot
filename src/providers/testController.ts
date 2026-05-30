import * as vscode from "vscode";
import { ParallelismMode, RunnerSettings, Stage } from "../core/config/types";
import { TagGroup } from "../core/gherkin/groupByTag";
import { computeRollup, prependRollup } from "../core/gherkin/outcomeRollup";
import { FeatureInfo, OutlineExample, ScenarioInfo, DomainGroup } from "../core/gherkin/model";
import { UnifiedSummary } from "../core/results/resultLoader";
import { findOutlineExampleMatch, matchesScenario } from "../core/results/scenarioMatch";
import { TestOutcome } from "../core/results/trxParser";
import { analyzeDotnetOutput } from "../core/diagnostics/analyzer";
import { RunTarget, buildCombinedFilter } from "../core/runner/filterBuilder";
import { DEFAULT_FILTER_MAPPING } from "../core/runner/filterMapping";
import { estimateTestCount } from "../core/runner/runEstimate";
import { LiveProgressState, TestCompletionEvent } from "../core/runner/liveProgress";
import { outlineRowKey, scenarioKey, collectOutcomeKeysForTargets } from "../core/runner/runScope";
import { RunService } from "./runService";
import { OutcomeStore, outcomeDescription } from "./outcomeStore";
import { TreeGroupBy } from "./testTreeProvider";
import {
  TestExplorerItemData,
  resolveTestExplorerRunTargets,
} from "./testExplorerRun";

export interface ProjectContext {
  projectDir: string;
  testTarget: string;
  discoveryRoot: string;
  label: string;
}

export interface ControllerDeps {
  getProjectContext(): ProjectContext | undefined;
  getStage(): Stage;
  getMode(): ParallelismMode;
  getSettings(): RunnerSettings;
  output: vscode.OutputChannel;
  runService: RunService;
  outcomeStore: OutcomeStore;
  getDomains: () => DomainGroup[];
  getTagGroups: () => TagGroup[];
  getTreeGroupBy: () => TreeGroupBy;
  onResultsApplied?: (summary: UnifiedSummary) => void;
  acquireRunLock(): boolean;
  releaseRunLock(): void;
  abortActiveRun(): void;
}

export interface ManagedController {
  controller: vscode.TestController;
  refresh(): void;
}

export function createManagedController(deps: ControllerDeps): ManagedController {
  const controller = vscode.tests.createTestController("bddPilot.testController", "BDD Pilot");
  const itemData = new WeakMap<vscode.TestItem, TestExplorerItemData>();

  const refresh = () => buildTree();
  controller.refreshHandler = async () => buildTree();
  buildTree();

  controller.createRunProfile(
    "Run",
    vscode.TestRunProfileKind.Run,
    (request, token) => void runHandler(request, token, false),
    true,
  );

  controller.createRunProfile(
    "Debug",
    vscode.TestRunProfileKind.Debug,
    (request, token) => void runHandler(request, token, true),
    false,
  );

  function buildTree(): void {
    controller.items.replace([]);
    const ctx = deps.getProjectContext();
    if (!ctx) {
      return;
    }
    if (deps.getTreeGroupBy() === "tag") {
      buildTagTree();
    } else {
      buildDomainTree();
    }
  }

  function buildDomainTree(): void {
    for (const domain of deps.getDomains()) {
      const domainItem = controller.createTestItem(`domain:${domain.name}`, domain.name);
      for (const feature of domain.features) {
        const featureItem = addFeatureItem(domainItem, feature);
        for (const scenario of feature.scenarios) {
          addScenarioItem(featureItem, feature, scenario, false);
        }
      }
      controller.items.add(domainItem);
    }
  }

  function buildTagTree(): void {
    for (const group of deps.getTagGroups()) {
      const tagItem = controller.createTestItem(`tag:${group.tag.toLowerCase()}`, `@${group.tag}`);
      tagItem.description = tagGroupDescription(group, deps.outcomeStore);
      itemData.set(tagItem, { kind: "tag", tag: group.tag });
      for (const ref of group.scenarios) {
        addScenarioItem(tagItem, ref.feature, ref.scenario, true);
      }
      controller.items.add(tagItem);
    }
  }

  function addFeatureItem(parent: vscode.TestItem, feature: FeatureInfo): vscode.TestItem {
    const featureUri = vscode.Uri.file(feature.filePath);
    const featureItem = controller.createTestItem(`feature:${feature.filePath}`, feature.name, featureUri);
    itemData.set(featureItem, { kind: "feature", feature });
    parent.children.add(featureItem);
    return featureItem;
  }

  function addScenarioItem(
    parent: vscode.TestItem,
    feature: FeatureInfo,
    scenario: ScenarioInfo,
    underTagGroup: boolean,
  ): vscode.TestItem {
    const featureUri = vscode.Uri.file(feature.filePath);
    const hasExamples = scenario.examples && scenario.examples.length > 0;
    const scenarioItem = controller.createTestItem(
      `scenario:${feature.filePath}:${scenario.line}`,
      scenario.name,
      featureUri,
    );
    scenarioItem.range = new vscode.Range(scenario.line - 1, 0, scenario.line - 1, 0);
    itemData.set(scenarioItem, { kind: "scenario", feature, scenario });

    const desc = scenarioItemDescription(feature, scenario, deps.outcomeStore, underTagGroup);
    if (desc) {
      scenarioItem.description = desc;
    }

    if (hasExamples) {
      for (const example of scenario.examples ?? []) {
        addOutlineRowItem(scenarioItem, feature, scenario, example);
      }
    }

    parent.children.add(scenarioItem);
    return scenarioItem;
  }

  function addOutlineRowItem(
    parent: vscode.TestItem,
    feature: FeatureInfo,
    scenario: ScenarioInfo,
    example: OutlineExample,
  ): vscode.TestItem {
    const featureUri = vscode.Uri.file(feature.filePath);
    const rowItem = controller.createTestItem(
      `outline:${feature.filePath}:${scenario.line}:${example.rowIndex}`,
      example.label,
      featureUri,
    );
    const rowKey = outlineRowKey(feature, scenario, example.rowIndex);
    const rowDesc = outcomeDescription(deps.outcomeStore.get(rowKey));
    if (rowDesc) {
      rowItem.description = rowDesc;
    }
    itemData.set(rowItem, { kind: "outlineRow", feature, scenario, example });
    parent.children.add(rowItem);
    return rowItem;
  }

  async function runHandler(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
    debug: boolean,
  ): Promise<void> {
    const run = controller.createTestRun(request);
    const project = deps.getProjectContext();
    const roots = collectRunRoots(request, controller);
    const scenarioItems = collectRunLeaves(roots, itemData, request.exclude ?? []);
    const includedRootData = roots
      .map((item) => itemData.get(item))
      .filter((data): data is TestExplorerItemData => data !== undefined);

    if (!project) {
      scenarioItems.forEach((i) =>
        run.errored(i, new vscode.TestMessage("Test project not found. Select a project in the status bar.")),
      );
      run.end();
      return;
    }

    if (!deps.acquireRunLock()) {
      scenarioItems.forEach((i) =>
        run.errored(i, new vscode.TestMessage("Another test run is already in progress.")),
      );
      run.end();
      return;
    }

    scenarioItems.forEach((i) => run.started(i));

    const runningAll = !request.include;
    const leafData = scenarioItems
      .map((item) => itemData.get(item))
      .filter((data): data is TestExplorerItemData => data !== undefined);
    const targets = resolveTestExplorerRunTargets(includedRootData, leafData, runningAll);
    if (!debug) {
      deps.outcomeStore.clearForRunScope(
        runningAll ? [{ kind: "all" }] : targets,
        deps.getDomains(),
      );
      clearDescriptionsForScope(scenarioItems, itemData, runningAll ? "all" : targets, deps.getDomains());
    }
    const totalExpected = estimateTestCount(
      runningAll ? [{ kind: "all" }] : targets,
      project.discoveryRoot,
    );
    const signal = new AbortController();
    token.onCancellationRequested(() => {
      signal.abort();
      deps.abortActiveRun();
    });

    try {
      const result = await deps.runService.run({
        targets,
        stage: deps.getStage(),
        mode: deps.getMode(),
        settings: deps.getSettings(),
        projectDir: project.projectDir,
        testTarget: project.testTarget,
        debug,
        signal: signal.signal,
        totalExpected,
        onProgress: (_state: LiveProgressState, event?: TestCompletionEvent) => {
          if (!event) {
            return;
          }
          applyLiveTestRunResult(
            run,
            scenarioItems,
            itemData,
            event,
            project.projectDir,
            deps.runService,
            deps.outcomeStore,
          );
        },
        onOutput: (chunk) => {
          deps.output.append(chunk);
          run.appendOutput(chunk.replace(/\r?\n/g, "\r\n"));
        },
      });

      if (result.canceled) {
        scenarioItems.forEach((i) => run.skipped(i));
        run.end();
        return;
      }

      if (debug) {
        run.end();
        return;
      }

      applyResults(
        run,
        scenarioItems,
        itemData,
        project.projectDir,
        result.summary,
        deps.runService,
        deps.outcomeStore,
      );
      if (result.summary) {
        deps.onResultsApplied?.(result.summary);
      }

      if (result.exitCode !== 0) {
        for (const d of analyzeDotnetOutput(result.outputBuffer)) {
          deps.output.appendLine(`[bdd-pilot] [${d.code}] ${d.title} → ${d.hint}`);
        }
      }
    } catch (err) {
      const message = new vscode.TestMessage(String(err));
      scenarioItems.forEach((i) => run.errored(i, message));
    } finally {
      deps.releaseRunLock();
      run.end();
    }
  }

  return { controller, refresh };
}

function collectRunRoots(
  request: vscode.TestRunRequest,
  controller: vscode.TestController,
): vscode.TestItem[] {
  const roots: vscode.TestItem[] = [];
  if (request.include) {
    request.include.forEach((i) => roots.push(i));
  } else {
    controller.items.forEach((i) => roots.push(i));
  }
  return roots;
}

function collectRunLeaves(
  roots: vscode.TestItem[],
  itemData: WeakMap<vscode.TestItem, TestExplorerItemData>,
  exclude: readonly vscode.TestItem[],
): vscode.TestItem[] {
  const excluded = new Set(exclude);
  const leaves: vscode.TestItem[] = [];
  const visit = (item: vscode.TestItem) => {
    if (excluded.has(item)) {
      return;
    }
    const data = itemData.get(item);
    if (data?.kind === "outlineRow") {
      leaves.push(item);
      return;
    }
    if (data?.kind === "scenario" && item.children.size === 0) {
      leaves.push(item);
    }
    item.children.forEach(visit);
  };
  for (const root of roots) {
    visit(root);
  }
  return leaves;
}

function scenarioItemDescription(
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  store: OutcomeStore,
  underTagGroup: boolean,
): string | undefined {
  const hasExamples = scenario.examples && scenario.examples.length > 0;
  if (hasExamples) {
    return underTagGroup ? feature.name : undefined;
  }
  const outcomeDesc = outcomeDescription(store.get(scenarioKey(feature, scenario)));
  if (underTagGroup) {
    return outcomeDesc ? `${feature.name} · ${outcomeDesc}` : feature.name;
  }
  return outcomeDesc;
}

function tagGroupDescription(group: TagGroup, store: OutcomeStore): string {
  const values = group.scenarios.flatMap((ref) =>
    collectScenarioOutcomeValues(ref.feature, ref.scenario, store),
  );
  const rollup = computeRollup(values);
  const base = `${group.scenarios.length} scenario${group.scenarios.length === 1 ? "" : "s"}`;
  return prependRollup(base, rollup);
}

function collectScenarioOutcomeValues(
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  store: OutcomeStore,
): Array<TestOutcome | undefined> {
  if (scenario.examples && scenario.examples.length > 0) {
    return scenario.examples.map((ex) => store.get(outlineRowKey(feature, scenario, ex.rowIndex)));
  }
  return [store.get(scenarioKey(feature, scenario))];
}

function storeOutcomeForItem(
  store: OutcomeStore,
  data: TestExplorerItemData | undefined,
  outcome: TestOutcome,
  durationMs?: number,
): string | undefined {
  if (data?.kind !== "scenario" && data?.kind !== "outlineRow") {
    return undefined;
  }
  if (!data.feature || !data.scenario) {
    return undefined;
  }
  const key =
    data.kind === "outlineRow"
      ? outlineRowKey(data.feature, data.scenario, data.example.rowIndex)
      : scenarioKey(data.feature, data.scenario);
  store.set(key, outcome, durationMs);
  return key;
}

function clearDescriptionsForScope(
  scenarioItems: vscode.TestItem[],
  itemData: WeakMap<vscode.TestItem, TestExplorerItemData>,
  targets: RunTarget[] | "all",
  domains: DomainGroup[],
): void {
  if (targets === "all") {
    for (const item of scenarioItems) {
      item.description = undefined;
    }
    return;
  }
  const scope = collectOutcomeKeysForTargets(targets, domains);
  if (scope === "all") {
    for (const item of scenarioItems) {
      item.description = undefined;
    }
    return;
  }
  for (const item of scenarioItems) {
    const data = itemData.get(item);
    if (data?.kind !== "scenario" && data?.kind !== "outlineRow") {
      continue;
    }
    if (!data.feature || !data.scenario) {
      continue;
    }
    const key =
      data.kind === "outlineRow"
        ? outlineRowKey(data.feature, data.scenario, data.example.rowIndex)
        : scenarioKey(data.feature, data.scenario);
    if (scope.has(key)) {
      item.description = undefined;
    }
  }
}

function applyLiveTestRunResult(
  run: vscode.TestRun,
  scenarioItems: vscode.TestItem[],
  itemData: WeakMap<vscode.TestItem, TestExplorerItemData>,
  event: TestCompletionEvent,
  projectDir: string,
  runService: RunService,
  outcomeStore: OutcomeStore,
): void {
  for (const item of scenarioItems) {
    const data = itemData.get(item);
    if (data?.kind !== "scenario" && data?.kind !== "outlineRow") {
      continue;
    }
    const scenarioName = data.scenario.name;
    const matched =
      data.kind === "outlineRow"
        ? !!findOutlineExampleMatch(event.testName, scenarioName, [data.example])
        : matchesScenario(event.testName, scenarioName);
    if (!matched) {
      continue;
    }
    storeOutcomeForItem(outcomeStore, data, event.outcome);
    item.description = outcomeDescription(event.outcome);
    switch (event.outcome) {
      case "passed":
        run.passed(item);
        break;
      case "failed":
        run.failed(item, runService.buildFailureMessage(projectDir));
        break;
      default:
        run.skipped(item);
        break;
    }
  }
}

function applyResults(
  run: vscode.TestRun,
  scenarioItems: vscode.TestItem[],
  itemData: WeakMap<vscode.TestItem, TestExplorerItemData>,
  projectDir: string,
  summary: UnifiedSummary | undefined,
  runService: RunService,
  outcomeStore: OutcomeStore,
): void {
  if (!summary) {
    const msg = new vscode.TestMessage("No test results were produced.");
    scenarioItems.forEach((i) => run.errored(i, msg));
    return;
  }

  for (const item of scenarioItems) {
    const data = itemData.get(item);
    if (data?.kind !== "scenario" && data?.kind !== "outlineRow") {
      run.skipped(item);
      continue;
    }
    const scenarioName = data.scenario.name;
    const match =
      data.kind === "outlineRow"
        ? summary.results.find((r) =>
            findOutlineExampleMatch(r.testName, scenarioName, [data.example]),
          )
        : summary.results.find((r) => matchesScenario(r.testName, scenarioName));
    if (!match) {
      run.skipped(item);
      continue;
    }
    switch (match.outcome) {
      case "passed":
        run.passed(item, match.durationMs);
        storeOutcomeForItem(outcomeStore, data, "passed", match.durationMs);
        item.description = "passed";
        break;
      case "failed":
        run.failed(item, runService.buildFailureMessage(projectDir, match.errorMessage), match.durationMs);
        storeOutcomeForItem(outcomeStore, data, "failed", match.durationMs);
        item.description = "failed";
        break;
      default:
        run.skipped(item);
        storeOutcomeForItem(outcomeStore, data, "skipped", match.durationMs);
        item.description = "skipped";
    }
  }
}

/** Re-run only scenarios that failed in the last run (Test Explorer helper). */
export function buildRerunFailedFilter(
  runService: RunService,
  mapping = DEFAULT_FILTER_MAPPING,
): string | undefined {
  const filter = runService.getLastFailedFilter();
  if (filter) {
    return filter;
  }
  const targets = runService.getLastFailedTargets();
  return targets.length > 0 ? buildCombinedFilter(targets, mapping) : undefined;
}
