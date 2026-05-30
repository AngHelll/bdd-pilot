import * as vscode from "vscode";
import { MessageKey, PilotLocale, resolveLocale, t } from "../core/i18n";

/** Reads bddPilot.locale and exposes translated strings to providers. */
export class LocaleService implements vscode.Disposable {
  private readonly _onDidChangeLocale = new vscode.EventEmitter<void>();
  readonly onDidChangeLocale = this._onDidChangeLocale.event;

  private readonly configListener: vscode.Disposable;

  constructor() {
    this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("bddPilot.locale")) {
        this._onDidChangeLocale.fire();
      }
    });
  }

  getLocale(): PilotLocale {
    const setting = vscode.workspace.getConfiguration("bddPilot").get<string>("locale", "auto");
    return resolveLocale(setting, vscode.env.language);
  }

  tr(key: MessageKey, params?: Record<string, string | number>): string {
    return t(this.getLocale(), key, params);
  }

  dispose(): void {
    this.configListener.dispose();
    this._onDidChangeLocale.dispose();
  }
}
