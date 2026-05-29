import * as fs from "fs";
import * as vscode from "vscode";
import * as path from "path";
import { resolveProjectDir } from "./core/config/projectLocator";
import { loadStageEnv } from "./core/config/envFile";
import {
  ALL_MODES,
  ALL_STAGES,
  DEFAULT_SETTINGS,
  MODE_PROFILES,
  ParallelismMode,
  RunnerSettings,
  Stage,
  isMode,
  isStage,
} from "./core/config/types";
import { RunTarget, buildFilter } from "./core/runner/filterBuilder";
import { runDotnetTest } from "./core/runner/dotnetTest";
import { parseTrx } from "./core/results/trxParser";
import { analyzeDotnetOutput } from "./core/diagnostics/analyzer";
import { evaluateRun } from "./security/envGuard";
import { sanitize } from "./security/sanitizer";
import {
  DomainNode,
  FeatureNode,
  ScenarioNode,
  TestTreeProvider,
  TreeNode,
} from "./providers/testTreeProvider";
import { StatusBar } from "./providers/statusBar";

const STAGE_KEY = "bddPilot.stage";
const MODE_KEY = "bddPilot.mode";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("BDD Pilot");
  const statusBar = new StatusBar();

  let currentStage: Stage = readStoredStage(context) ?? readSettings().defaultStage;
  let currentMode: ParallelismMode = readStoredMode(context) ?? readSettings().defaultMode;
  let activeRun: AbortController | undefined;

  const treeProvider = new TestTreeProvider(() => getProjectDir());
  const treeView = vscode.window.createTreeView("bddPilot.tests", {
    treeDataProvider: treeProvider,
  });

  const refreshUi = () => {
    statusBar.update(currentStage, currentMode);
    void vscode.commands.executeCommand("setContext", "bddPilot.running", !!activeRun);
  };

  treeProvider.refresh();
  refreshUi();

  context.subscriptions.push(
    output,
    statusBar,
    treeView,

    vscode.commands.registerCommand("bddPilot.refresh", () => treeProvider.refresh()),

    vscode.commands.registerCommand("bddPilot.showOutput", () => output.show(true)),

    vscode.commands.registerCommand("bddPilot.selectStage", async () => {
      const picked = await vscode.window.showQuickPick(ALL_STAGES, {
        placeHolder: `Current: ${currentStage}. Select environment (STAGE)`,
      });
      if (picked && isStage(picked)) {
        currentStage = picked;
        await context.workspaceState.update(STAGE_KEY, picked);
        refreshUi();
      }
    }),

    vscode.commands.registerCommand("bddPilot.selectMode", async () => {
      const picked = await vscode.window.showQuickPick(ALL_MODES, {
        placeHolder: `Current: ${currentMode}. Select parallelism mode`,
      });
      if (picked && isMode(picked)) {
        currentMode = picked;
        await context.workspaceState.update(MODE_KEY, picked);
        refreshUi();
      }
    }),

    vscode.commands.registerCommand("bddPilot.cancel", () => {
      if (activeRun) {
        activeRun.abort();
        output.appendLine("\n[bdd-pilot] Cancellation requested...");
      } else {
        void vscode.window.showInformationMessage("No test run is currently active.");
      }
    }),

    vscode.commands.registerCommand("bddPilot.runAll", async () => {
      await run({ kind: "all" });
    }),

    vscode.commands.registerCommand("bddPilot.runNode", async (node: TreeNode) => {
      const target = toRunTarget(node);
      if (target) {
        await run(target);
      }
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("bddPilot")) {
        treeProvider.refresh();
      }
    }),

    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.toLowerCase().endsWith(".feature")) {
        treeProvider.refresh();
      }
    }),
  );

  function toRunTarget(node: TreeNode | undefined): RunTarget | undefined {
    if (!node) {
      return { kind: "all" };
    }
    if (node.kind === "domain") {
      return { kind: "domain", group: (node as DomainNode).group };
    }
    if (node.kind === "feature") {
      return { kind: "feature", feature: (node as FeatureNode).feature };
    }
    return {
      kind: "scenario",
      feature: (node as ScenarioNode).feature,
      scenario: (node as ScenarioNode).scenario,
    };
  }

  async function run(target: RunTarget): Promise<void> {
    if (activeRun) {
      void vscode.window.showWarningMessage("A test run is already in progress.");
      return;
    }

    const settings = readSettings();
    const projectDir = getProjectDir();
    if (!projectDir) {
      void vscode.window.showErrorMessage(
        "BDD Pilot: could not locate the .NET test project. Set 'bddPilot.projectPath'.",
      );
      return;
    }

    const decision = evaluateRun(currentStage, settings.requireConfirmationForStages);
    if (decision.requiresConfirmation) {
      const choice = await vscode.window.showWarningMessage(
        decision.message,
        { modal: true },
        "Run",
      );
      if (choice !== "Run") {
        return;
      }
    }

    const loadedEnv = loadStageEnv(projectDir, currentStage);
    const filter = buildFilter(target);
    const trxFileName = `bdd-pilot-${Date.now()}.trx`;
    const controller = new AbortController();
    activeRun = controller;
    refreshUi();

    output.clear();
    output.show(true);
    treeProvider.clearResults();

    if (loadedEnv.loadedFiles.length > 0) {
      const names = loadedEnv.loadedFiles.map((f) => path.basename(f)).join(", ");
      const count = Object.keys(loadedEnv.vars).length;
      output.appendLine(`[bdd-pilot] Loaded environment from ${names} (${count} variables, values hidden).`);
    } else {
      output.appendLine(
        `[bdd-pilot] No config/.env.${currentStage} found. Tests will rely on the current process environment.`,
      );
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Running tests (${currentStage}/${currentMode})`,
        cancellable: true,
      },
      async (_progress, token) => {
        token.onCancellationRequested(() => controller.abort());
        let buffer = "";
        const capture = (chunk: string): string => {
          const clean = sanitize(chunk);
          buffer += clean;
          return clean;
        };
        try {
          const result = await runDotnetTest(
            {
              dotnetPath: settings.dotnetPath,
              projectDir,
              filter,
              stage: currentStage,
              mode: MODE_PROFILES[currentMode],
              resultsDir: "TestResults",
              trxFileName,
              extraEnv: loadedEnv.vars,
            },
            {
              onStart: (cmd) => output.appendLine(`[bdd-pilot] ${sanitize(cmd)}\n`),
              onStdout: (chunk) => output.append(capture(chunk)),
              onStderr: (chunk) => output.append(capture(chunk)),
            },
            controller.signal,
          );

          if (result.canceled) {
            output.appendLine("\n[bdd-pilot] Run canceled.");
            return;
          }

          output.appendLine(`\n[bdd-pilot] Process exited with code ${result.exitCode}.`);
          if (result.exitCode === 0) {
            loadResults(result.trxPath);
          } else {
            loadResults(result.trxPath);
            reportDiagnostics(buffer);
          }
        } catch (err) {
          const text = sanitize(String(err));
          output.appendLine(`\n[bdd-pilot] Error: ${text}`);
          reportDiagnostics(`${buffer}\n${text}`, `BDD Pilot: ${text}`);
        } finally {
          activeRun = undefined;
          refreshUi();
        }
      },
    );
  }

  function reportDiagnostics(text: string, fallbackMessage?: string): void {
    const diagnostics = analyzeDotnetOutput(text);
    if (diagnostics.length === 0) {
      if (fallbackMessage) {
        void vscode.window.showErrorMessage(fallbackMessage);
      }
      return;
    }

    output.appendLine("\n[bdd-pilot] Diagnostics:");
    for (const d of diagnostics) {
      const parts = [`  • [${d.code}] ${d.title}`, d.detail ? `    ${d.detail}` : "", `    → ${d.hint}`];
      output.appendLine(parts.filter((p) => p.length > 0).join("\n"));
    }

    const top = diagnostics[0];
    const show =
      top.severity === "error"
        ? vscode.window.showErrorMessage
        : top.severity === "warning"
          ? vscode.window.showWarningMessage
          : vscode.window.showInformationMessage;
    void show(`${top.title} ${top.hint}`, "Show Output").then((choice) => {
      if (choice === "Show Output") {
        output.show(true);
      }
    });
  }

  function loadResults(trxPath: string): void {
    try {
      if (!fs.existsSync(trxPath)) {
        output.appendLine(`[bdd-pilot] No TRX file found at ${trxPath}.`);
        return;
      }
      const xml = fs.readFileSync(trxPath, "utf8");
      const summary = parseTrx(xml);
      treeProvider.applyResults(summary);
      output.appendLine(
        `[bdd-pilot] Results: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped (${summary.total} total).`,
      );
    } catch (err) {
      output.appendLine(`[bdd-pilot] Failed to parse TRX: ${sanitize(String(err))}`);
    }
  }

  function getProjectDir(): string | undefined {
    const settings = readSettings();
    const roots = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
    return resolveProjectDir(roots, settings.projectPath);
  }
}

export function deactivate(): void {
  // no-op
}

function readSettings(): RunnerSettings {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const stage = cfg.get<string>("defaultStage", DEFAULT_SETTINGS.defaultStage);
  const mode = cfg.get<string>("defaultMode", DEFAULT_SETTINGS.defaultMode);
  const confirmStages = cfg
    .get<string[]>("requireConfirmationForStages", DEFAULT_SETTINGS.requireConfirmationForStages)
    .filter(isStage);
  return {
    projectPath: cfg.get<string>("projectPath", DEFAULT_SETTINGS.projectPath),
    defaultStage: isStage(stage) ? stage : DEFAULT_SETTINGS.defaultStage,
    defaultMode: isMode(mode) ? mode : DEFAULT_SETTINGS.defaultMode,
    requireConfirmationForStages: confirmStages as Stage[],
    dotnetPath: cfg.get<string>("dotnetPath", DEFAULT_SETTINGS.dotnetPath),
  };
}

function readStoredStage(context: vscode.ExtensionContext): Stage | undefined {
  const value = context.workspaceState.get<string>(STAGE_KEY);
  return value && isStage(value) ? value : undefined;
}

function readStoredMode(context: vscode.ExtensionContext): ParallelismMode | undefined {
  const value = context.workspaceState.get<string>(MODE_KEY);
  return value && isMode(value) ? value : undefined;
}
