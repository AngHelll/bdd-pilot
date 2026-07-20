import * as path from "path";
import * as vscode from "vscode";
import { maybeWriteLastFailureArtifactFromRehydrate } from "../core/diagnostics/lastFailureArtifact";
import { tryBuildRehydratedFailureSnapshot } from "../core/diagnostics/failureSnapshotFromArtifacts";
import { RehydrateNotice } from "../core/results/rehydrateNotice";
import { RunTarget } from "../core/runner/filterBuilder";
import { UnifiedSummary } from "../core/results/resultLoader";
import { TreeMappingReport } from "../core/results/trxTreeMapping";
import { selectUnmappedForOutput } from "../core/results/mappingReportFormat";
import { clearLastMappingReport, setLastMappingReport } from "../core/results/lastMappingReport";
import {
  applySkipReasonSnapshot,
  buildSkipReasonSnapshot,
  mappingReportFromSkipSnapshot,
  parseSkipReasonSnapshot,
  shouldRestoreSkipSnapshot,
} from "../core/results/skipReasonSnapshot";
import { MessageKey } from "../core/i18n";
import { OutcomeStore } from "../providers/outcomeStore";
import { RunService } from "../providers/runService";
import { TestTreeProvider } from "../providers/testTreeProvider";
import { ProjectContext } from "../providers/testController";
import { readAiSettings, readOutcomeRehydrateSettings } from "./extensionSettings";
import { loadRunResults } from "../core/results/resultLoader";
import {
  findPilotTrxCandidates,
  selectEligiblePilotTrx,
  selectLatestPilotTrx,
} from "../core/results/pilotTrxDiscovery";
import { SKIP_REASON_SNAPSHOT_KEY } from "./storageKeys";

export interface RehydrateDeps {
  context: vscode.ExtensionContext;
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
  function persistSkipReasonSnapshot(report: TreeMappingReport | undefined): void {
    if (!report || report.inScope === 0) {
      return;
    }
    const lastHistory = deps.runService.getHistory().at(-1);
    const trxPath = lastHistory?.trxPath ? path.resolve(lastHistory.trxPath) : undefined;
    const snapshot = buildSkipReasonSnapshot({
      report,
      store: deps.outcomeStore,
      trxPath,
    });
    void deps.context.workspaceState.update(SKIP_REASON_SNAPSHOT_KEY, snapshot);
  }

  function logTreeMapping(report: TreeMappingReport | undefined): void {
    if (!report || report.inScope === 0) {
      clearLastMappingReport();
      return;
    }
    setLastMappingReport(report);
    persistSkipReasonSnapshot(report);
    deps.output.appendLine(
      `[bdd-pilot] ${deps.tr("log.treeMapping", {
        mapped: report.mapped,
        inScope: report.inScope,
        unmapped: report.unmapped,
      })}`,
    );
    if (report.unmapped <= 0) {
      return;
    }
    const { shown, remaining } = selectUnmappedForOutput(report.unmappedLeaves);
    for (const leaf of shown) {
      deps.output.appendLine(
        `[bdd-pilot] ${deps.tr("log.treeMappingUnmappedItem", { label: leaf.label })}`,
      );
    }
    if (remaining > 0) {
      deps.output.appendLine(
        `[bdd-pilot] ${deps.tr("log.treeMappingUnmappedMore", { count: remaining })}`,
      );
    }
  }

  function applyRunSummaryToTree(
    summary: UnifiedSummary,
    targets: RunTarget[],
    options?: { canceled?: boolean; rawFilter?: boolean },
  ): void {
    if (options?.rawFilter || targets.length === 0) {
      deps.treeProvider.applyResults(summary);
      clearLastMappingReport();
    } else {
      const stats = deps.treeProvider.applyScopedResults(summary, targets, {
        canceled: options?.canceled,
      });
      logTreeMapping(stats);
      deps.refreshPilotSurfaces();
    }
    deps.refreshManaged();
  }

  function tryRestoreSkipReasons(trxAbsolutePath: string, maxAgeMs: number | undefined): void {
    const snapshot = parseSkipReasonSnapshot(
      deps.context.workspaceState.get(SKIP_REASON_SNAPSHOT_KEY),
    );
    if (!shouldRestoreSkipSnapshot(snapshot, trxAbsolutePath, Date.now(), maxAgeMs)) {
      return;
    }
    const domains = deps.treeProvider.getDomains();
    applySkipReasonSnapshot(deps.outcomeStore, domains, snapshot!);
    const liteReport = mappingReportFromSkipSnapshot(snapshot!, domains);
    if (liteReport.unmapped > 0) {
      setLastMappingReport(liteReport);
    }
    deps.treeProvider.refreshPilotSummary();
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

    const lastHistory = deps.runService.getHistory().at(-1);
    const historyTrx = lastHistory?.trxPath ? path.resolve(lastHistory.trxPath) : undefined;
    const latest = selectEligiblePilotTrx(ctx.projectDir, {
      maxAgeMs: rehydrate.maxAgeMs,
      historyTrxAbsolutePath: historyTrx,
    });
    if (!latest) {
      if (historyTrx) {
        const newest = selectLatestPilotTrx(findPilotTrxCandidates(ctx.projectDir), {
          maxAgeMs: rehydrate.maxAgeMs,
        });
        if (newest && path.resolve(newest.absolutePath) !== historyTrx) {
          deps.output.appendLine(`[bdd-pilot] ${deps.tr("log.rehydrateSkippedHistoryMismatch")}`);
        }
      }
      return;
    }

    const summary = loadRunResults(ctx.projectDir, latest.absolutePath);
    if (!summary || summary.total === 0) {
      return;
    }

    deps.treeProvider.applyResults(summary);
    tryRestoreSkipReasons(latest.absolutePath, rehydrate.maxAgeMs);
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

    const historyMeta = lastHistory
      ? {
          stage: lastHistory.stage,
          mode: lastHistory.mode,
          filter: lastHistory.filter,
        }
      : undefined;

    if (readAiSettings().rehydrateFromTrx && summary.failed > 0 && !deps.isRunActive()) {
      const aiSnapshot = tryBuildRehydratedFailureSnapshot({
        projectDir: ctx.projectDir,
        trxAbsolutePath: latest.absolutePath,
        trxMtimeMs: latest.mtimeMs,
        history: historyMeta,
      });
      if (aiSnapshot) {
        deps.runService.hydrateLastFailedRunSnapshot(aiSnapshot);
      }
    }

    const artifactResult = maybeWriteLastFailureArtifactFromRehydrate({
      projectDir: ctx.projectDir,
      trxAbsolutePath: latest.absolutePath,
      summary,
      trxMtimeMs: latest.mtimeMs,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      history: historyMeta,
    });
    if (!artifactResult.written && artifactResult.error) {
      deps.output.appendLine(`[bdd-pilot] last failure artifact: ${artifactResult.error}`);
    }
  }

  return { tryRehydrateOutcomes, applyRunSummaryToTree, logTreeMapping };
}

export type RehydrateHandlers = ReturnType<typeof createRehydrateHandlers>;
