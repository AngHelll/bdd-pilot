import * as crypto from "crypto";
import * as vscode from "vscode";
import { Diagnostic } from "../core/diagnostics/analyzer";
import { PilotLocale, t } from "../core/i18n";
import {
  DashboardActionsViewModel,
  DashboardWebviewCommand,
  parseDashboardWebviewMessage,
} from "../core/results/dashboardActions";
import { FlakyOpenTarget, parseFlakyOpenMessage } from "../core/results/flakyDashboard";
import {
  DEFAULT_DASHBOARD_HISTORY_FILTER,
  DashboardHistoryFilter,
  parseDashboardHistoryFilterMessage,
} from "../core/results/dashboardHistoryFilter";
import { LastKnownSnapshot } from "../core/results/dashboardLastKnown";
import {
  buildDashboardRegions,
  dashboardApplyPayload,
  dashboardPaintKind,
  renderDashboardShell,
  resolveDashboardTheme,
} from "../core/results/dashboardView";
import { RehydrateNotice } from "../core/results/rehydrateNotice";
import { RunHistoryEntry } from "../core/results/runHistory";

export interface DashboardContext {
  lastKnown?: LastKnownSnapshot;
  rehydrateNotice?: RehydrateNotice;
  actions?: DashboardActionsViewModel;
  primaryDiagnostic?: Diagnostic;
}

export class DashboardPanel {
  private panel: vscode.WebviewPanel | undefined;
  private lastHistory: RunHistoryEntry[] = [];
  private lastContext: DashboardContext = {};
  private lastLocale: PilotLocale = "en";
  private historyFilter: DashboardHistoryFilter = { ...DEFAULT_DASHBOARD_HISTORY_FILTER };
  private documentReady = false;
  private webviewReady = false;
  private messageHandler?: (command: DashboardWebviewCommand) => void;
  private flakyOpenHandler?: (target: FlakyOpenTarget) => void;

  setMessageHandler(handler: (command: DashboardWebviewCommand) => void): void {
    this.messageHandler = handler;
  }

  setFlakyOpenHandler(handler: (target: FlakyOpenTarget) => void): void {
    this.flakyOpenHandler = handler;
  }

  show(history: RunHistoryEntry[], locale: PilotLocale, context: DashboardContext = {}): void {
    this.lastHistory = history;
    this.lastContext = context;
    this.lastLocale = locale;
    if (this.panel) {
      this.panel.reveal();
      this.paint();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "bddPilot.dashboard",
      t(locale, "dashboard.panelTitle"),
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel.webview.onDidReceiveMessage((message) => {
      if (isDashboardReadyMessage(message)) {
        this.webviewReady = true;
        this.paint();
        return;
      }
      const filter = parseDashboardHistoryFilterMessage(message);
      if (filter) {
        this.historyFilter = filter;
        this.paint();
        return;
      }
      const flakyTarget = parseFlakyOpenMessage(message);
      if (flakyTarget) {
        this.flakyOpenHandler?.(flakyTarget);
        return;
      }
      const command = parseDashboardWebviewMessage(message);
      if (command) {
        this.messageHandler?.(command);
      }
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.documentReady = false;
      this.webviewReady = false;
      this.historyFilter = { ...DEFAULT_DASHBOARD_HISTORY_FILTER };
    });
    this.paint();
  }

  update(history: RunHistoryEntry[], locale: PilotLocale, context: DashboardContext = {}): void {
    this.lastHistory = history;
    this.lastContext = context;
    this.lastLocale = locale;
    this.paint();
  }

  refreshLocale(locale: PilotLocale, context?: DashboardContext): void {
    this.lastLocale = locale;
    if (context) {
      this.lastContext = context;
    }
    this.paint();
  }

  private paint(): void {
    if (!this.panel) {
      return;
    }
    const locale = this.lastLocale;
    this.panel.title = t(locale, "dashboard.panelTitle");
    const theme = resolveDashboardTheme(
      vscode.workspace.getConfiguration("bddPilot").get<string>("dashboard.theme"),
    );
    const lang = locale === "es" ? "es" : "en";
    const regions = buildDashboardRegions({
      history: this.lastHistory,
      filter: this.historyFilter,
      locale,
      context: this.lastContext,
    });

    if (dashboardPaintKind(this.documentReady) === "shell") {
      const nonce = crypto.randomBytes(16).toString("base64");
      this.webviewReady = false;
      this.panel.webview.html = renderDashboardShell({ nonce, lang, theme, regions });
      this.documentReady = true;
      return;
    }

    if (!this.webviewReady) {
      return;
    }

    void this.panel.webview.postMessage(dashboardApplyPayload(theme, lang, regions));
  }
}

function isDashboardReadyMessage(message: unknown): message is { type: "ready" } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type: unknown }).type === "ready"
  );
}
