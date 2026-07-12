import * as path from "path";
import * as vscode from "vscode";
import { maybeWriteLastFailureArtifactFromRehydrate } from "../core/diagnostics/lastFailureArtifact";
import { RehydrateNotice } from "../core/results/rehydrateNotice";
import { RunTarget } from "../core/runner/filterBuilder";
import { UnifiedSummary } from "../core/results/resultLoader";
import { TreeMappingStats } from "../core/results/trxTreeMapping";
import { MessageKey } from "../core/i18n";
import { OutcomeStore } from "../providers/outcomeStore";
import { RunService } from "../providers/runService";
import { TestTreeProvider } from "../providers/testTreeProvider";
import { ProjectContext } from "../providers/testController";
import { readOutcomeRehydrateSettings } from "./extensionSettings";
import { loadRunResults } from "../core/results/resultLoader";
import {
  findPilotTrxCandidates,
  selectLatestPilotTrx,
} from "../core/results/pilotTrxDiscovery";

export interface RehydrateDeps {
  output: vscode.OutputChannel;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  runService: RunService;
  outcomeStore: OutcomeStore;
  treeProvider: TestTreeProvider;
  refreshManaged: () => void;
  refreshPilotSurfaces: () => void;
  getProjectContext: () => ProjectContext | undefined;
  isRunActive: () => boolean;
  getRehydrateNotice: () => RehydrateNotice | undefined;
  setRehydrateNotice: (notice: RehydrateNotice | undefined) => void;
}

export function createRehydrateHandlers(deps: RehydrateDeps) {
  function logTreeMapping(stats: TreeMappingStats | undefined): void {
    if (!stats || stats.inScope === 0) {
      return;
    }
    deps.output.appendLine(
      `[bdd-pilot] ${deps.tr("log.treeMapping", {
        mapped: stats.mapped,
        inScope: stats.inScope,
        unmapped: stats.unmapped,
      })}`,
    );
  }

  function applyRunSummaryToTree(
    summary: UnifiedSummary,
    targets: RunTarget[],
    options?: { canceled?: boolean; rawFilter?: boolean },
  ): void {
    if (options?.rawFilter || targets.length === 0) {
      deps.treeProvider.applyResults(summary);
    } else {
      const stats = deps.treeProvider.applyScopedResults(summary, targets, {
        canceled: options?.canceled,
      });
      logTreeMapping(stats);
    }
    deps.refreshManaged();
  }

  function tryRehydrateOutcomes(): void {
    const rehydrate = readOutcomeRehydrateSettings();
    if (!rehydrate.enabled) {
      return;
    }
    if (deps.isRunActive()) {
      return;
    }
    if (!deps.outcomeStore.isEmpty()) {
      return;
    }

    const ctx = deps.getProjectContext();
    if (!ctx) {
      return;
    }

    const latest = selectLatestPilotTrx(findPilotTrxCandidates(ctx.projectDir), {
      maxAgeMs: rehydrate.maxAgeMs,
    });
    if (!latest) {
      return;
    }

    const lastHistory = deps.runService.getHistory().at(-1);
    const historyTrx = lastHistory?.trxPath ? path.resolve(lastHistory.trxPath) : undefined;
    if (historyTrx && path.resolve(latest.absolutePath) !== historyTrx) {
      deps.output.appendLine(`[bdd-pilot] ${deps.tr("log.rehydrateSkippedHistoryMismatch")}`);
      return;
    }

    const summary = loadRunResults(ctx.projectDir, latest.absolutePath);
    if (!summary || summary.total === 0) {
      return;
    }

    deps.treeProvider.applyResults(summary);
    deps.refreshManaged();
    deps.setRehydrateNotice({
      trxFileName: latest.fileName,
      mtimeMs: latest.mtimeMs,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      total: summary.total,
    });
    deps.refreshPilotSurfaces();
    deps.output.appendLine(
      `[bdd-pilot] ${deps.tr("log.rehydrateRestored", {
        file: latest.fileName,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        total: summary.total,
      })}`,
    );

    const artifactResult = maybeWriteLastFailureArtifactFromRehydrate({
      projectDir: ctx.projectDir,
      trxAbsolutePath: latest.absolutePath,
      summary,
      trxMtimeMs: latest.mtimeMs,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      history: lastHistory
        ? {
            stage: lastHistory.stage,
            mode: lastHistory.mode,
            filter: lastHistory.filter,
          }
        : undefined,
    });
    if (!artifactResult.written && artifactResult.error) {
      deps.output.appendLine(`[bdd-pilot] last failure artifact: ${artifactResult.error}`);
    }
  }

  return { tryRehydrateOutcomes, applyRunSummaryToTree, logTreeMapping };
}

export type RehydrateHandlers = ReturnType<typeof createRehydrateHandlers>;
