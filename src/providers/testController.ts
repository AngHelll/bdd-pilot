import * as vscode from "vscode";
import { ParallelismMode, RunnerSettings, Stage } from "../core/config/types";
import { TagGroup } from "../core/gherkin/groupByTag";
import { FeatureInfo, OutlineExample, ScenarioInfo, DomainGroup } from "../core/gherkin/model";
import {
  buildTestExplorerDomainDescription,
  buildTestExplorerFeatureDescription,
  buildTestExplorerOutlineRowDescription,
  buildTestExplorerScenarioDescription,
  buildTestExplorerTagDescription,
  TestExplorerDisplaySettings,
} from "../core/gherkin/testExplorerLabels";
import { UnifiedSummary } from "../core/results/resultLoader";
import { findOutlineExampleMatch, matchesScenario } from "../core/results/scenarioMatch";
import { appendSkipReasonToDescription, SkipReason } from "../core/results/skipReason";
import {
  resolveCanceledLeafOutcome,
  skipReasonForTrxOutcome,
} from "../core/results/testRunApply";
import { TestOutcome } from "../core/results/trxParser";
import { analyzeDotnetOutput } from "../core/diagnostics/analyzer";
import { classifyRunCompletion, RunCompletionKind } from "../core/diagnostics/runOutcomeClass";
import { t } from "../core/i18n";
import { RunTarget, buildCombinedFilter } from "../core/runner/filterBuilder";
import { DEFAULT_FILTER_MAPPING } from "../core/runner/filterMapping";
import { estimateTestCount } from "../core/runner/runEstimate";
import { LiveProgressState, TestCompletionEvent } from "../core/runner/liveProgress";
import { outlineRowKey, scenarioKey, collectOutcomeKeysForTargets } from "../core/runner/runScope";
import { PilotLocale } from "../core/i18n";
import { RunService } from "./runService";
import { OutcomeStore } from "./outcomeStore";
import { readTreeDisplaySettings, TreeGroupBy } from "./testTreeProvider";
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
  getLocale: () => import("../core/i18n").PilotLocale;
  onResultsApplied?: (summary: UnifiedSummary) => void;
  acquireRunLock(): boolean;
  releaseRunLock(): void;
  abortActiveRun(): void;
}

export interface ManagedController {
  controller: vscode.TestController;
  refresh(): void;
  finalizePendingDebugRun(
    summary: UnifiedSummary | undefined,
    completionKind: RunCompletionKind,
    outputBuffer: string,
  ): void;
}

export interface PendingTestExplorerDebug {
  run: vscode.TestRun;
  scenarioItems: vscode.TestItem[];
  itemData: WeakMap<vscode.TestItem, TestExplorerItemData>;
  projectDir: string;
}

export function createManagedController(deps: ControllerDeps): ManagedController {
  const controller = vscode.tests.createTestController("bddPilot.testController", "BDD Pilot");
  const itemData = new WeakMap<vscode.TestItem, TestExplorerItemData>();
  let pendingDebugRun: PendingTestExplorerDebug | undefined;

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
    const locale = deps.getLocale();
    const display = readTreeDisplaySettings();
    for (const domain of deps.getDomains()) {
      const domainItem = controller.createTestItem(`domain:${domain.name}`, domain.name);
      domainItem.description = buildTestExplorerDomainDescription(domain, deps.outcomeStore, locale);
      for (const feature of domain.features) {
        const featureItem = addFeatureItem(domainItem, feature, display, locale);
        for (const scenario of feature.scenarios) {
          addScenarioItem(featureItem, feature, scenario, false, display, locale);
        }
      }
      controller.items.add(domainItem);
    }
  }

  function buildTagTree(): void {
    const locale = deps.getLocale();
    const display = readTreeDisplaySettings();
    for (const group of deps.getTagGroups()) {
      const tagItem = controller.createTestItem(`tag:${group.tag.toLowerCase()}`, `@${group.tag}`);
      tagItem.description = buildTestExplorerTagDescription(group, deps.outcomeStore, locale);
      itemData.set(tagItem, { kind: "tag", tag: group.tag });
      for (const ref of group.scenarios) {
        addScenarioItem(tagItem, ref.feature, ref.scenario, true, display, locale);
      }
      controller.items.add(tagItem);
    }
  }

  function addFeatureItem(
    parent: vscode.TestItem,
    feature: FeatureInfo,
    display: TestExplorerDisplaySettings,
    locale: PilotLocale,
  ): vscode.TestItem {
    const featureUri = vscode.Uri.file(feature.filePath);
    const featureItem = controller.createTestItem(`feature:${feature.filePath}`, feature.name, featureUri);
    featureItem.description = buildTestExplorerFeatureDescription(
      feature,
      deps.outcomeStore,
      display,
      locale,
    );
    itemData.set(featureItem, { kind: "feature", feature });
    parent.children.add(featureItem);
    return featureItem;
  }

  function addScenarioItem(
    parent: vscode.TestItem,
    feature: FeatureInfo,
    scenario: ScenarioInfo,
    underTagGroup: boolean,
    display: TestExplorerDisplaySettings,
    locale: PilotLocale,
  ): vscode.TestItem {
    const featureUri = vscode.Uri.file(feature.filePath);
    const hasExamples = scenario.examples && scenario.examples.length > 0;
    const scenarioItem = controller.createTestItem(
      `scenario:${feature.filePath}:${scenario.line}`,
      scenario.name,
      featureUri,
    );
    scenarioItem.range = new vscode.Range(scenario.line - 1, 0, scenario.line - 1, 0);
    itemData.set(scenarioItem, { kind: "scenario", feature, scenario, underTagGroup });

    const desc = buildTestExplorerScenarioDescription(
      feature,
      scenario,
      deps.outcomeStore,
      display,
      locale,
      underTagGroup,
    );
    if (desc) {
      scenarioItem.description = desc;
    }

    if (hasExamples) {
      for (const example of scenario.examples ?? []) {
        addOutlineRowItem(scenarioItem, feature, scenario, example, display, locale);
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
    display: TestExplorerDisplaySettings,
    locale: PilotLocale,
  ): vscode.TestItem {
    const featureUri = vscode.Uri.file(feature.filePath);
    const rowItem = controller.createTestItem(
      `outline:${feature.filePath}:${scenario.line}:${example.rowIndex}`,
      example.label,
      featureUri,
    );
    const rowDesc = buildTestExplorerOutlineRowDescription(
      feature,
      scenario,
      deps.outcomeStore,
      display,
      locale,
      example.rowIndex,
    );
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

    let debugRunHeld = false;

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
        locale: deps.getLocale(),
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
            deps.getLocale(),
            readTreeDisplaySettings(),
          );
        },
        onOutput: (chunk) => {
          deps.output.append(chunk);
          run.appendOutput(chunk.replace(/\r?\n/g, "\r\n"));
        },
      });

      if (result.canceled) {
        applyRunResults({
          run,
          scenarioItems,
          itemData,
          projectDir: project.projectDir,
          summary: result.summary,
          outputBuffer: result.outputBuffer,
          runService: deps.runService,
          outcomeStore: deps.outcomeStore,
          locale: deps.getLocale(),
          display: readTreeDisplaySettings(),
          canceled: true,
          exitCode: result.exitCode,
        });
        if (result.summary) {
          deps.onResultsApplied?.(result.summary);
        }
        run.end();
        return;
      }

      if (debug && result.debugStarted) {
        pendingDebugRun = { run, scenarioItems, itemData, projectDir: project.projectDir };
        debugRunHeld = true;
        return;
      }

      if (debug) {
        run.end();
        return;
      }

      applyRunResults({
        run,
        scenarioItems,
        itemData,
        projectDir: project.projectDir,
        summary: result.summary,
        outputBuffer: result.outputBuffer,
        runService: deps.runService,
        outcomeStore: deps.outcomeStore,
        locale: deps.getLocale(),
        display: readTreeDisplaySettings(),
        canceled: false,
        exitCode: result.exitCode,
      });
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
      if (!debugRunHeld) {
        deps.releaseRunLock();
        run.end();
      }
    }
  }

  function finalizePendingDebugRun(
    summary: UnifiedSummary | undefined,
    completionKind: RunCompletionKind,
    outputBuffer: string,
  ): void {
    const pending = pendingDebugRun;
    pendingDebugRun = undefined;
    if (!pending) {
      return;
    }

    if (summary && summary.total > 0) {
      applyRunResults({
        run: pending.run,
        scenarioItems: pending.scenarioItems,
        itemData: pending.itemData,
        projectDir: pending.projectDir,
        summary,
        outputBuffer,
        runService: deps.runService,
        outcomeStore: deps.outcomeStore,
        locale: deps.getLocale(),
        display: readTreeDisplaySettings(),
        canceled: false,
        exitCode: 0,
      });
    } else {
      const msg = buildInfraTestMessage(outputBuffer, deps.getLocale(), completionKind);
      pending.scenarioItems.forEach((i) => pending.run.errored(i, msg));
    }

    pending.run.end();
    deps.releaseRunLock();
  }

  return {
    controller,
    refresh,
    finalizePendingDebugRun,
  };
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

function updateLeafItemDescription(
  item: vscode.TestItem,
  data: TestExplorerItemData,
  store: OutcomeStore,
  display: TestExplorerDisplaySettings,
  locale: PilotLocale,
): void {
  if (data.kind === "outlineRow") {
    item.description = buildTestExplorerOutlineRowDescription(
      data.feature,
      data.scenario,
      store,
      display,
      locale,
      data.example.rowIndex,
    );
    return;
  }
  if (data.kind === "scenario") {
    const hasExamples = data.scenario.examples && data.scenario.examples.length > 0;
    if (hasExamples) {
      return;
    }
    item.description = buildTestExplorerScenarioDescription(
      data.feature,
      data.scenario,
      store,
      display,
      locale,
      data.underTagGroup,
    );
  }
}

function storeOutcomeForItem(
  store: OutcomeStore,
  data: TestExplorerItemData | undefined,
  outcome: TestOutcome,
  durationMs?: number,
  errorMessage?: string,
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
  store.set(key, outcome, durationMs, errorMessage);
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
  locale: PilotLocale,
  display: TestExplorerDisplaySettings,
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
    updateLeafItemDescription(item, data, outcomeStore, display, locale);
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

function buildInfraTestMessage(
  outputBuffer: string,
  locale: PilotLocale,
  kind: RunCompletionKind,
): vscode.TestMessage {
  const diagnostics = analyzeDotnetOutput(outputBuffer);
  if (diagnostics.length > 0) {
    const top = diagnostics[0];
    return new vscode.TestMessage(`[${top.code}] ${top.title}\n${top.hint}`);
  }
  if (kind === "no_results") {
    return new vscode.TestMessage(t(locale, "toast.debugNoTrx"));
  }
  return new vscode.TestMessage("No test results were produced.");
}

interface ApplyRunResultsOptions {
  run: vscode.TestRun;
  scenarioItems: vscode.TestItem[];
  itemData: WeakMap<vscode.TestItem, TestExplorerItemData>;
  projectDir: string;
  summary: UnifiedSummary | undefined;
  outputBuffer: string;
  runService: RunService;
  outcomeStore: OutcomeStore;
  locale: PilotLocale;
  display: TestExplorerDisplaySettings;
  canceled: boolean;
  exitCode: number | null;
}

function applyRunResults(opts: ApplyRunResultsOptions): void {
  const completionKind = classifyRunCompletion({
    exitCode: opts.exitCode,
    canceled: opts.canceled,
    summary: opts.summary,
    outputBuffer: opts.outputBuffer,
  });

  if (!opts.canceled && (completionKind === "infra" || completionKind === "no_results")) {
    const msg = buildInfraTestMessage(opts.outputBuffer, opts.locale, completionKind);
    opts.scenarioItems.forEach((i) => opts.run.errored(i, msg));
    return;
  }

  if (!opts.canceled && !opts.summary) {
    const msg = buildInfraTestMessage(opts.outputBuffer, opts.locale, completionKind);
    opts.scenarioItems.forEach((i) => opts.run.errored(i, msg));
    return;
  }

  for (const item of opts.scenarioItems) {
    applyLeafRunResult(item, opts);
  }
}

function applyLeafRunResult(item: vscode.TestItem, opts: ApplyRunResultsOptions): void {
  const data = opts.itemData.get(item);
  if (data?.kind !== "scenario" && data?.kind !== "outlineRow") {
    opts.run.skipped(item);
    return;
  }

  const scenarioName = data.scenario.name;
  const match = opts.summary
    ? data.kind === "outlineRow"
      ? opts.summary.results.find((r) =>
          findOutlineExampleMatch(r.testName, scenarioName, [data.example]),
        )
      : opts.summary.results.find((r) => matchesScenario(r.testName, scenarioName))
    : undefined;

  if (match) {
    applyMatchedOutcomeToRun(item, data, match, opts);
    return;
  }

  const storedKey = outlineOrScenarioKey(data);
  const storedOutcome = opts.outcomeStore.get(storedKey);
  const storedDuration = opts.outcomeStore.getDuration(storedKey);
  const storedError = opts.outcomeStore.getErrorMessage(storedKey);

  if (storedOutcome && storedOutcome !== "unknown") {
    applyStoredOutcomeToRun(
      item,
      data,
      storedOutcome,
      storedDuration,
      storedError,
      opts,
      opts.canceled ? "canceled" : "not_in_trx",
    );
    return;
  }

  if (opts.canceled) {
    opts.run.skipped(item);
    setSkippedDescription(item, data, opts, "canceled");
    return;
  }

  opts.run.skipped(item);
  setSkippedDescription(item, data, opts, "not_in_trx");
}

function outlineOrScenarioKey(data: TestExplorerItemData): string {
  if (data.kind === "outlineRow") {
    return outlineRowKey(data.feature, data.scenario, data.example.rowIndex);
  }
  if (data.kind === "scenario") {
    return scenarioKey(data.feature, data.scenario);
  }
  return "";
}

function applyMatchedOutcomeToRun(
  item: vscode.TestItem,
  data: TestExplorerItemData,
  match: { outcome: TestOutcome; durationMs?: number; errorMessage?: string },
  opts: ApplyRunResultsOptions,
): void {
  storeOutcomeForItem(opts.outcomeStore, data, match.outcome, match.durationMs, match.errorMessage);

  switch (match.outcome) {
    case "passed":
      opts.run.passed(item, match.durationMs);
      break;
    case "failed":
      opts.run.failed(
        item,
        opts.runService.buildFailureMessage(opts.projectDir, match.errorMessage),
        match.durationMs,
      );
      break;
    case "unknown":
      opts.run.skipped(item);
      setSkippedDescription(item, data, opts, "unknown");
      return;
    default:
      opts.run.skipped(item);
      setSkippedDescription(item, data, opts, "runner_skipped");
      return;
  }
  updateLeafItemDescription(item, data, opts.outcomeStore, opts.display, opts.locale);
}

function applyStoredOutcomeToRun(
  item: vscode.TestItem,
  data: TestExplorerItemData,
  outcome: TestOutcome,
  durationMs: number | undefined,
  errorMessage: string | undefined,
  opts: ApplyRunResultsOptions,
  skipReason: SkipReason,
): void {
  const resolved = resolveCanceledLeafOutcome(outcome);
  if (resolved === "pending") {
    opts.run.skipped(item);
    setSkippedDescription(item, data, opts, skipReason);
    return;
  }

  switch (resolved) {
    case "passed":
      opts.run.passed(item, durationMs);
      break;
    case "failed":
      opts.run.failed(
        item,
        opts.runService.buildFailureMessage(opts.projectDir, errorMessage),
        durationMs,
      );
      break;
    default:
      opts.run.skipped(item);
      setSkippedDescription(
        item,
        data,
        opts,
        skipReasonForTrxOutcome(outcome, opts.canceled, false) ?? skipReason,
      );
      return;
  }
  updateLeafItemDescription(item, data, opts.outcomeStore, opts.display, opts.locale);
}

function setSkippedDescription(
  item: vscode.TestItem,
  data: TestExplorerItemData,
  opts: ApplyRunResultsOptions,
  reason: SkipReason,
): void {
  updateLeafItemDescription(item, data, opts.outcomeStore, opts.display, opts.locale);
  const base = item.description;
  item.description = appendSkipReasonToDescription(base, reason, opts.locale);
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
