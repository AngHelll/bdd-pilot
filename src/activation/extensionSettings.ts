import * as vscode from "vscode";
import { isBindingGateMode, BindingGateMode } from "../core/bindings/resolveBindingGateUx";
import { readStatusBarDisplayMode, StatusBarDisplayMode } from "../core/config/statusBarViewModel";
import {
  DEFAULT_BLAME_HANG_TIMEOUT,
  DEFAULT_SETTINGS,
  ParallelismMode,
  RunConfiguration,
  RunnerSettings,
  Stage,
  isBlameHangMode,
  isMode,
  isStage,
  normalizeCliVerbosity,
} from "../core/config/types";
import { AnalyzeDotnetOutputOptions } from "../core/diagnostics/analyzer";
import { DiagnosticsInOutputMode } from "../core/diagnostics/diagnosticsOutput";
import {
  DotnetVerbosity,
  isDotnetVerbosity,
} from "../core/feedback/dotnetOutputFilter";
import {
  AutoShowOutputMode,
  isAutoShowOutputMode,
} from "../core/results/failureTreeNav";
import { DEFAULT_FILTER_MAPPING, FilterMappingConfig } from "../core/runner/filterMapping";
import { parseStageRunByStage } from "../core/runner/stageRunFlags";
import { PilotLocale } from "../core/i18n";
import { STAGE_KEY, MODE_KEY } from "./storageKeys";

export type PostRunToastMode = "off" | "failures" | "always";

export function readStatusBarDisplay(): StatusBarDisplayMode {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  return readStatusBarDisplayMode(cfg.get<string>("statusBar.display", "compact"));
}

export function readSearchRunCap(): number {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  return Math.max(0, cfg.get<number>("tree.searchRunCap", 80));
}

export function readBindingGate(): BindingGateMode {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const value = cfg.get<string>("preRun.bindingGate", "warn");
  return isBindingGateMode(value) ? value : "warn";
}

function isRunConfiguration(value: string): value is RunConfiguration {
  return value === "" || value === "Debug" || value === "Release";
}

export function readSettings(): RunnerSettings {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const stage = cfg.get<string>("defaultStage", DEFAULT_SETTINGS.defaultStage);
  const mode = cfg.get<string>("defaultMode", DEFAULT_SETTINGS.defaultMode);
  const confirmStages = cfg
    .get<string[]>("requireConfirmationForStages", DEFAULT_SETTINGS.requireConfirmationForStages)
    .filter(isStage);
  const runConfiguration = cfg.get<string>("run.configuration", DEFAULT_SETTINGS.runConfiguration);
  const blameHang = cfg.get<string>("run.blameHang", DEFAULT_SETTINGS.runBlameHang);
  const hangTimeout = cfg.get<string>(
    "run.blameHangTimeout",
    DEFAULT_SETTINGS.runBlameHangTimeout,
  );
  return {
    projectPath: cfg.get<string>("projectPath", DEFAULT_SETTINGS.projectPath),
    defaultStage: isStage(stage) ? stage : DEFAULT_SETTINGS.defaultStage,
    defaultMode: isMode(mode) ? mode : DEFAULT_SETTINGS.defaultMode,
    requireConfirmationForStages: confirmStages as Stage[],
    allowProductionRuns: cfg.get<boolean>(
      "security.allowProductionRuns",
      DEFAULT_SETTINGS.allowProductionRuns,
    ),
    dotnetPath: cfg.get<string>("dotnetPath", DEFAULT_SETTINGS.dotnetPath),
    filterMapping: readFilterMapping(cfg),
    runConfiguration: isRunConfiguration(runConfiguration)
      ? runConfiguration
      : DEFAULT_SETTINGS.runConfiguration,
    runNoBuild: cfg.get<boolean>("run.noBuild", DEFAULT_SETTINGS.runNoBuild),
    runSettingsPath: cfg.get<string>("run.runSettings", DEFAULT_SETTINGS.runSettingsPath),
    runByStage: parseStageRunByStage(cfg.get("run.byStage")),
    runCliVerbosity: normalizeCliVerbosity(
      cfg.get<string>("run.cliVerbosity", DEFAULT_SETTINGS.runCliVerbosity),
    ),
    runBlame: cfg.get<boolean>("run.blame", DEFAULT_SETTINGS.runBlame),
    runBlameHang: isBlameHangMode(blameHang) ? blameHang : DEFAULT_SETTINGS.runBlameHang,
    runBlameHangTimeout: hangTimeout.trim() || DEFAULT_BLAME_HANG_TIMEOUT,
  };
}

export function readFilterMapping(cfg: vscode.WorkspaceConfiguration): FilterMappingConfig {
  const outlineRow = cfg.get<string>("filter.outlineRowFilter", DEFAULT_FILTER_MAPPING.outlineRowFilter);
  return {
    featureClassSuffix: cfg.get<string>(
      "filter.featureClassSuffix",
      DEFAULT_FILTER_MAPPING.featureClassSuffix,
    ),
    tagTraitName: cfg.get<string>("filter.tagTraitName", DEFAULT_FILTER_MAPPING.tagTraitName),
    outlineRowFilter:
      outlineRow === "scenarioOnly" ? "scenarioOnly" : DEFAULT_FILTER_MAPPING.outlineRowFilter,
  };
}

export function readStoredStage(context: vscode.ExtensionContext): Stage | undefined {
  const value = context.workspaceState.get<string>(STAGE_KEY);
  return value && isStage(value) ? value : undefined;
}

export function readStoredMode(context: vscode.ExtensionContext): ParallelismMode | undefined {
  const value = context.workspaceState.get<string>(MODE_KEY);
  return value && isMode(value) ? value : undefined;
}

export function readOutcomeRehydrateSettings(): { enabled: boolean; maxAgeMs: number | undefined } {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const mode = cfg.get<string>("outcomes.rehydrateOnActivate", "on");
  const hours = Math.max(0, cfg.get<number>("outcomes.rehydrateMaxAgeHours", 168));
  return {
    enabled: mode !== "off",
    maxAgeMs: hours > 0 ? hours * 3_600_000 : undefined,
  };
}

export function readAiSettings(): {
  enabled: boolean;
  contextMaxOutputLines: number;
  rehydrateFromTrx: boolean;
} {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  return {
    enabled: cfg.get<boolean>("ai.enabled", true),
    contextMaxOutputLines: Math.max(1, cfg.get<number>("ai.contextMaxOutputLines", 80)),
    rehydrateFromTrx: cfg.get<boolean>("ai.rehydrateFromTrx", false),
  };
}

export function readPostRunToast(): PostRunToastMode {
  const value = vscode.workspace.getConfiguration("bddPilot").get<string>("feedback.postRunToast", "failures");
  if (value === "off" || value === "always") {
    return value;
  }
  return "failures";
}

export function readAnalyzeOptions(locale: PilotLocale): AnalyzeDotnetOutputOptions {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  return {
    extendedRules: cfg.get<boolean>("diagnostics.extendedRules", false),
    locale,
  };
}

export function readDiagnosticsInOutput(): DiagnosticsInOutputMode {
  const value = vscode.workspace
    .getConfiguration("bddPilot")
    .get<string>("feedback.diagnosticsInOutput", "summary");
  if (value === "off" || value === "full") {
    return value;
  }
  return "summary";
}

export function readDotnetVerbosity(): DotnetVerbosity {
  const value = vscode.workspace
    .getConfiguration("bddPilot")
    .get<string>("feedback.dotnetVerbosity", "filtered");
  return isDotnetVerbosity(value) ? value : "filtered";
}

export function readAutoShowOutput(): AutoShowOutputMode {
  const value = vscode.workspace
    .getConfiguration("bddPilot")
    .get<string>("feedback.autoShowOutput", "off");
  return isAutoShowOutputMode(value) ? value : "off";
}
