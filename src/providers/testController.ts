import * as vscode from "vscode";
import { ParallelismMode, RunnerSettings, Stage } from "../core/config/types";
import { discoverDomains } from "../core/gherkin/discovery";
import { FeatureInfo, OutlineExample, ScenarioInfo } from "../core/gherkin/model";
import { UnifiedSummary } from "../core/results/resultLoader";
import { findOutlineExampleMatch, matchesScenario } from "../core/results/scenarioMatch";
import { analyzeDotnetOutput } from "../core/diagnostics/analyzer";
import { RunTarget, buildCombinedFilter } from "../core/runner/filterBuilder";
import { DEFAULT_FILTER_MAPPING } from "../core/runner/filterMapping";
import { estimateTestCount } from "../core/runner/runEstimate";
import { LiveProgressState, TestCompletionEvent } from "../core/runner/liveProgress";
import { RunService } from "./runService";

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
  onResultsApplied?: (summary: UnifiedSummary) => void;
  acquireRunLock(): boolean;
  releaseRunLock(): void;
  abortActiveRun(): void;
}

interface ItemData {
  kind: "feature" | "scenario" | "outlineRow";
  feature: FeatureInfo;
  scenario?: ScenarioInfo;
  example?: OutlineExample;
}

export interface ManagedController {
  controller: vscode.TestController;
  refresh(): void;
}

export function createManagedController(deps: ControllerDeps): ManagedController {
  const controller = vscode.tests.createTestController("bddPilot.testController", "BDD Pilot");
  const itemData = new WeakMap<vscode.TestItem, ItemData>();

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
    for (const domain of discoverDomains(ctx.discoveryRoot)) {
      const domainItem = controller.createTestItem(`domain:${domain.name}`, domain.name);
      for (const feature of domain.features) {
        const featureUri = vscode.Uri.file(feature.filePath);
        const featureItem = controller.createTestItem(
          `feature:${feature.filePath}`,
          feature.name,
          featureUri,
        );
        itemData.set(featureItem, { kind: "feature", feature });
        for (const scenario of feature.scenarios) {
          const hasExamples = scenario.examples && scenario.examples.length > 0;
          const scenarioItem = controller.createTestItem(
            `scenario:${feature.filePath}:${scenario.line}`,
            scenario.name,
            featureUri,
          );
          scenarioItem.range = new vscode.Range(scenario.line - 1, 0, scenario.line - 1, 0);
          itemData.set(scenarioItem, { kind: "scenario", feature, scenario });

          if (hasExamples) {
            for (const example of scenario.examples ?? []) {
              const rowItem = controller.createTestItem(
                `outline:${feature.filePath}:${scenario.line}:${example.rowIndex}`,
                example.label,
                featureUri,
              );
              itemData.set(rowItem, { kind: "outlineRow", feature, scenario, example });
              scenarioItem.children.add(rowItem);
            }
          }

          featureItem.children.add(scenarioItem);
        }
        domainItem.children.add(featureItem);
      }
      controller.items.add(domainItem);
    }
  }

  async function runHandler(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
    debug: boolean,
  ): Promise<void> {
    const run = controller.createTestRun(request);
    const project = deps.getProjectContext();
    const scenarioItems = collectScenarioItems(request, controller, itemData);

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
    const targets = buildTargets(scenarioItems, itemData, runningAll);
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

      applyResults(run, scenarioItems, itemData, project.projectDir, result.summary, deps.runService);
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

function collectScenarioItems(
  request: vscode.TestRunRequest,
  controller: vscode.TestController,
  itemData: WeakMap<vscode.TestItem, ItemData>,
): vscode.TestItem[] {
  const roots: vscode.TestItem[] = [];
  if (request.include) {
    request.include.forEach((i) => roots.push(i));
  } else {
    controller.items.forEach((i) => roots.push(i));
  }

  const excluded = new Set(request.exclude ?? []);
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
    if (data?.kind === "scenario") {
      if (item.children.size === 0) {
        leaves.push(item);
      }
    }
    item.children.forEach(visit);
  };
  roots.forEach(visit);
  return leaves;
}

function buildTargets(
  scenarioItems: vscode.TestItem[],
  itemData: WeakMap<vscode.TestItem, ItemData>,
  runningAll: boolean,
): RunTarget[] {
  if (runningAll) {
    return [{ kind: "all" }];
  }
  const targets: RunTarget[] = [];
  for (const item of scenarioItems) {
    const data = itemData.get(item);
    if (data?.kind === "scenario" && data.scenario) {
      targets.push({ kind: "scenario", feature: data.feature, scenario: data.scenario });
    } else if (data?.kind === "outlineRow" && data.scenario && data.example) {
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

function applyLiveTestRunResult(
  run: vscode.TestRun,
  scenarioItems: vscode.TestItem[],
  itemData: WeakMap<vscode.TestItem, ItemData>,
  event: TestCompletionEvent,
  projectDir: string,
  runService: RunService,
): void {
  for (const item of scenarioItems) {
    const data = itemData.get(item);
    const scenarioName = data?.scenario?.name;
    if (!scenarioName) {
      continue;
    }
    const matched =
      data?.kind === "outlineRow" && data.example
        ? !!findOutlineExampleMatch(event.testName, scenarioName, [data.example])
        : matchesScenario(event.testName, scenarioName);
    if (!matched) {
      continue;
    }
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
  itemData: WeakMap<vscode.TestItem, ItemData>,
  projectDir: string,
  summary: UnifiedSummary | undefined,
  runService: RunService,
): void {
  if (!summary) {
    const msg = new vscode.TestMessage("No test results were produced.");
    scenarioItems.forEach((i) => run.errored(i, msg));
    return;
  }

  for (const item of scenarioItems) {
    const data = itemData.get(item);
    const scenarioName = data?.scenario?.name;
    const match = scenarioName
      ? data?.kind === "outlineRow" && data.example
        ? summary.results.find((r) =>
            findOutlineExampleMatch(r.testName, scenarioName, [data.example!]),
          )
        : summary.results.find((r) => matchesScenario(r.testName, scenarioName))
      : undefined;
    if (!match) {
      run.skipped(item);
      continue;
    }
    switch (match.outcome) {
      case "passed":
        run.passed(item, match.durationMs);
        break;
      case "failed":
        run.failed(item, runService.buildFailureMessage(projectDir, match.errorMessage), match.durationMs);
        break;
      default:
        run.skipped(item);
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
