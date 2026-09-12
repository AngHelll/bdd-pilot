import * as path from "path";
import * as vscode from "vscode";
import { Stage } from "../core/config/types";
import { analyzeDotnetOutput } from "../core/diagnostics/analyzer";
import { buildAiFailureContext } from "../core/diagnostics/aiFailureContext";
import { tryBuildRehydratedFailureSnapshot } from "../core/diagnostics/failureSnapshotFromArtifacts";
import { formatDiagnosticsOutputLines } from "../core/diagnostics/diagnosticsOutput";
import {
  buildDiagnosticsByDomainRollUp,
  formatDiagnosticsByDomainLines,
} from "../core/diagnostics/diagnosticsByDomain";
import { DomainGroup } from "../core/gherkin/model";
import {
  buildMatchingDebugPack,
  collectMatchingDebugLayoutLeaves,
} from "../core/results/matchingDebugPack";
import { getLastMappingReport } from "../core/results/lastMappingReport";
import { getMatchingDebugSource } from "../core/results/matchingDebugSession";
import { readTreeGroupBy } from "../providers/treeSettings";
import {
  buildPostRunFeedback,
  PostRunFeedbackRequest,
  PostRunFeedbackViewModel,
} from "../core/feedback/postRunFeedback";
import { formatOutputSectionHeader } from "../core/feedback/dotnetOutputFilter";
import { MessageKey } from "../core/i18n";
import { selectEligiblePilotTrx } from "../core/results/pilotTrxDiscovery";
import { TrxSummary } from "../core/results/trxParser";
import { buildRerunFailedFilter, ProjectContext } from "../providers/testController";
import { LocaleService } from "../providers/localeService";
import { RunService } from "../providers/runService";
import {
  readAiSettings,
  readAnalyzeOptions,
  readAutoShowOutput,
  readDiagnosticsInOutput,
  readOutcomeRehydrateSettings,
  readPostRunToast,
  readSettings,
} from "./extensionSettings";
import { shouldAutoShowOutput } from "../core/results/failureTreeNav";

export interface PostRunDeps {
  context: vscode.ExtensionContext;
  output: vscode.OutputChannel;
  localeService: LocaleService;
  runService: RunService;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  copyFailureContextForAi: () => Promise<void>;
  getDomains: () => DomainGroup[];
}

export function createPostRunHandlers(deps: PostRunDeps) {
  function appendRunDiagnosticsToOutput(text: string, trxSummary?: TrxSummary): void {
    const analyzeOptions = {
      ...readAnalyzeOptions(deps.localeService.getLocale()),
      trxSummary,
    };
    const locale = analyzeOptions.locale ?? deps.localeService.getLocale();
    const diagnostics = analyzeDotnetOutput(text, analyzeOptions);
    const lines = formatDiagnosticsOutputLines(
      diagnostics,
      readDiagnosticsInOutput(),
      locale,
    );
    const byDomainLines =
      trxSummary && trxSummary.failed > 0
        ? formatDiagnosticsByDomainLines(
            buildDiagnosticsByDomainRollUp(trxSummary.results, deps.getDomains()),
            locale,
          )
        : [];

    if (lines.length === 0 && byDomainLines.length === 0) {
      return;
    }
    if (lines.length > 0) {
      deps.output.appendLine(
        formatOutputSectionHeader(deps.localeService.getLocale(), "diagnostics"),
      );
      for (const line of lines) {
        deps.output.appendLine(line);
      }
    }
    if (byDomainLines.length > 0) {
      if (lines.length === 0) {
        deps.output.appendLine(
          formatOutputSectionHeader(deps.localeService.getLocale(), "diagnostics"),
        );
      }
      for (const line of byDomainLines) {
        deps.output.appendLine(line);
      }
    }
  }

  function presentPostRunFeedback(vm: PostRunFeedbackViewModel | undefined): void {
    if (!vm?.message) {
      return;
    }
    const labels = vm.actions.map((action) => {
      switch (action) {
        case "showOutput":
          return deps.tr("action.showOutput");
        case "jumpToFailure":
          return deps.tr("action.jumpToFailure");
        case "rerunFailed":
          return deps.tr("action.rerunFailed");
        case "copyForAi":
          return deps.tr("action.copyForAi");
      }
    });
    const show =
      vm.severity === "error"
        ? vscode.window.showErrorMessage
        : vm.severity === "warning"
          ? vscode.window.showWarningMessage
          : vscode.window.showInformationMessage;
    void show(vm.message, ...labels).then((choice) => {
      if (choice === deps.tr("action.showOutput")) {
        deps.output.show(true);
      } else if (choice === deps.tr("action.jumpToFailure")) {
        void vscode.commands.executeCommand("bddPilot.jumpToFirstFailure");
      } else if (choice === deps.tr("action.rerunFailed")) {
        void vscode.commands.executeCommand("bddPilot.rerunFailed");
      } else if (choice === deps.tr("action.copyForAi")) {
        void deps.copyFailureContextForAi();
      }
    });
  }

  function maybeAutoShowOutput(request: PostRunFeedbackRequest): void {
    if (request.debug) {
      return;
    }
    if (
      shouldAutoShowOutput(readAutoShowOutput(), {
        exitCode: request.exitCode,
        failed: request.summary?.failed ?? 0,
        canceled: request.canceled,
      })
    ) {
      deps.output.show(true);
    }
  }

  function notifyPostRunFeedback(request: PostRunFeedbackRequest): void {
    if (!request.canceled && !request.debug) {
      if (request.exitCode !== 0 || (request.summary?.failed ?? 0) > 0) {
        appendRunDiagnosticsToOutput(
          request.outputBuffer,
          request.summary
            ? {
                total: request.summary.total,
                passed: request.summary.passed,
                failed: request.summary.failed,
                skipped: request.summary.skipped,
                results: request.summary.results,
              }
            : undefined,
        );
      }
    }
    maybeAutoShowOutput(request);
    const vm = buildPostRunFeedback({
      ...request,
      locale: deps.localeService.getLocale(),
      analyzeOptions: {
        ...readAnalyzeOptions(deps.localeService.getLocale()),
        trxSummary: request.summary
          ? {
              total: request.summary.total,
              passed: request.summary.passed,
              failed: request.summary.failed,
              skipped: request.summary.skipped,
              results: request.summary.results,
            }
          : undefined,
      },
      toastMode: readPostRunToast(),
      canRerunFailed: !!buildRerunFailedFilter(deps.runService, readSettings().filterMapping),
      canCopyForAi: readAiSettings().enabled && !!deps.runService.getLastFailedRunSnapshot(),
    });
    presentPostRunFeedback(vm);
  }

  return { notifyPostRunFeedback, appendRunDiagnosticsToOutput, presentPostRunFeedback };
}

export function createCopyFailureContextForAi(deps: {
  context: vscode.ExtensionContext;
  runService: RunService;
  localeService: LocaleService;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  getProjectContext: () => ProjectContext | undefined;
  isRunActive: () => boolean;
}): () => Promise<void> {
  return async (): Promise<void> => {
    let snapshot = deps.runService.getLastFailedRunSnapshot();
    const ai = readAiSettings();
    if (!snapshot && ai.rehydrateFromTrx && !deps.isRunActive()) {
      const ctx = deps.getProjectContext();
      if (ctx) {
        const outcomeAge = readOutcomeRehydrateSettings();
        const lastHistory = deps.runService.getHistory().at(-1);
        const historyTrx = lastHistory?.trxPath ? path.resolve(lastHistory.trxPath) : undefined;
        const latest = selectEligiblePilotTrx(ctx.projectDir, {
          maxAgeMs: outcomeAge.maxAgeMs,
          historyTrxAbsolutePath: historyTrx,
        });
        if (latest) {
          snapshot = tryBuildRehydratedFailureSnapshot({
            projectDir: ctx.projectDir,
            trxAbsolutePath: latest.absolutePath,
            trxMtimeMs: latest.mtimeMs,
            history: lastHistory
              ? {
                  stage: lastHistory.stage,
                  mode: lastHistory.mode,
                  filter: lastHistory.filter,
                }
              : undefined,
          });
          if (snapshot) {
            deps.runService.hydrateLastFailedRunSnapshot(snapshot);
          }
        }
      }
    }

    if (!snapshot) {
      void vscode.window.showInformationMessage(deps.tr("toast.noFailureContext"));
      return;
    }

    const sensitiveStages = new Set<Stage>(["stg", "prod"]);
    if (sensitiveStages.has(snapshot.stage as Stage)) {
      const copyAnyway = deps.tr("action.copyAnyway");
      const choice = await vscode.window.showWarningMessage(
        deps.tr("toast.failureContextProdWarning"),
        { modal: true },
        copyAnyway,
      );
      if (choice !== copyAnyway) {
        return;
      }
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const trxFile = snapshot.trxPath ? path.basename(snapshot.trxPath) : "TRX";
    const markdown = buildAiFailureContext(snapshot, {
      maxOutputLines: ai.contextMaxOutputLines,
      extensionVersion: deps.context.extension.packageJSON.version,
      workspaceRoot,
      analyzeOptions: {
        ...readAnalyzeOptions(deps.localeService.getLocale()),
        trxSummary: snapshot.trxSummary,
      },
      rehydratedFromTrxNote:
        snapshot.provenance === "rehydrated-trx"
          ? deps.tr("ai.rehydratedFromTrxNote", { file: trxFile })
          : undefined,
    });
    await vscode.env.clipboard.writeText(markdown);
    void vscode.window.showInformationMessage(deps.tr("toast.failureContextCopied"));
  };
}

/** Copies the last session `dotnet test …` line (CF1 Cockpit fidelity). */
export function createCopyEffectiveDotnetCommand(deps: {
  runService: RunService;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
}): () => Promise<void> {
  return async (): Promise<void> => {
    const snapshot = deps.runService.getLastEffectiveDotnetCommand();
    if (!snapshot) {
      void vscode.window.showInformationMessage(deps.tr("toast.noEffectiveCommand"));
      return;
    }
    await vscode.env.clipboard.writeText(snapshot.commandLine);
    void vscode.window.showInformationMessage(deps.tr("toast.effectiveCommandCopied"));
  };
}

/** Copies Matching Debug Pack from last session mapping report (D1 + D3 layout). */
export function createCopyMatchingDebugPack(deps: {
  context: vscode.ExtensionContext;
  runService: RunService;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  getDomains: () => DomainGroup[];
  getProjectContext: () => ProjectContext | undefined;
}): () => Promise<void> {
  return async (): Promise<void> => {
    const report = getLastMappingReport();
    if (!report) {
      void vscode.window.showInformationMessage(deps.tr("toast.noMatchingReport"));
      return;
    }

    const session = deps.runService.getLastRunSnapshot();
    const lastHistory = deps.runService.getHistory().at(-1);
    const debugSource = getMatchingDebugSource();
    const projectCtx = deps.getProjectContext();
    const projectDir = session?.projectDir ?? projectCtx?.projectDir ?? "";
    const layoutLeaves = collectMatchingDebugLayoutLeaves(report, deps.getDomains());
    const markdown = buildMatchingDebugPack({
      report,
      meta: {
        stage: session?.stage ?? lastHistory?.stage ?? "unknown",
        mode: session?.mode ?? lastHistory?.mode ?? "unknown",
        filter: session?.filter ?? lastHistory?.filter,
        testTarget: session?.testTarget,
        extensionVersion: deps.context.extension.packageJSON.version as string,
      },
      candidatesByLabel: debugSource?.candidatesByLabel,
      layout: {
        projectDir: projectDir || ".",
        groupBy: readTreeGroupBy(),
        leaves: layoutLeaves,
      },
    });

    if (!markdown) {
      void vscode.window.showInformationMessage(deps.tr("toast.matchingDebugNoGaps"));
      return;
    }

    await vscode.env.clipboard.writeText(markdown);
    void vscode.window.showInformationMessage(deps.tr("toast.matchingDebugCopied"));
  };
}

export type PostRunHandlers = ReturnType<typeof createPostRunHandlers>;
