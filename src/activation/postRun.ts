import * as vscode from "vscode";
import { Stage } from "../core/config/types";
import { analyzeDotnetOutput } from "../core/diagnostics/analyzer";
import { buildAiFailureContext } from "../core/diagnostics/aiFailureContext";
import { formatDiagnosticsOutputLines } from "../core/diagnostics/diagnosticsOutput";
import {
  buildPostRunFeedback,
  PostRunFeedbackRequest,
  PostRunFeedbackViewModel,
} from "../core/feedback/postRunFeedback";
import { MessageKey } from "../core/i18n";
import { buildRerunFailedFilter } from "../providers/testController";
import { LocaleService } from "../providers/localeService";
import { RunService } from "../providers/runService";
import {
  readAiSettings,
  readAnalyzeOptions,
  readDiagnosticsInOutput,
  readPostRunToast,
  readSettings,
} from "./extensionSettings";

export interface PostRunDeps {
  context: vscode.ExtensionContext;
  output: vscode.OutputChannel;
  localeService: LocaleService;
  runService: RunService;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  copyFailureContextForAi: () => Promise<void>;
}

export function createPostRunHandlers(deps: PostRunDeps) {
  function appendRunDiagnosticsToOutput(text: string): void {
    const analyzeOptions = readAnalyzeOptions(deps.localeService.getLocale());
    const diagnostics = analyzeDotnetOutput(text, analyzeOptions);
    for (const line of formatDiagnosticsOutputLines(
      diagnostics,
      readDiagnosticsInOutput(),
      analyzeOptions.locale ?? "en",
    )) {
      deps.output.appendLine(line);
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
      } else if (choice === deps.tr("action.rerunFailed")) {
        void vscode.commands.executeCommand("bddPilot.rerunFailed");
      } else if (choice === deps.tr("action.copyForAi")) {
        void deps.copyFailureContextForAi();
      }
    });
  }

  function notifyPostRunFeedback(request: PostRunFeedbackRequest): void {
    if (!request.canceled && !request.debug) {
      if (request.exitCode !== 0 || (request.summary?.failed ?? 0) > 0) {
        appendRunDiagnosticsToOutput(request.outputBuffer);
      }
    }
    const vm = buildPostRunFeedback({
      ...request,
      locale: deps.localeService.getLocale(),
      analyzeOptions: readAnalyzeOptions(deps.localeService.getLocale()),
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
}): () => Promise<void> {
  return async (): Promise<void> => {
    const snapshot = deps.runService.getLastFailedRunSnapshot();
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

    const ai = readAiSettings();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const markdown = buildAiFailureContext(snapshot, {
      maxOutputLines: ai.contextMaxOutputLines,
      extensionVersion: deps.context.extension.packageJSON.version,
      workspaceRoot,
      analyzeOptions: readAnalyzeOptions(deps.localeService.getLocale()),
    });
    await vscode.env.clipboard.writeText(markdown);
    void vscode.window.showInformationMessage(deps.tr("toast.failureContextCopied"));
  };
}

export type PostRunHandlers = ReturnType<typeof createPostRunHandlers>;
