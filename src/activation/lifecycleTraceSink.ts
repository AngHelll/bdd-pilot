import * as vscode from "vscode";
import {
  flushPresentation,
  isTraceEnabled,
  startTraceSession,
  stopTraceSession,
  trace,
} from "../core/observability/lifecycleTrace";
import { readLifecycleTraceEnabled } from "./extensionSettings";

/**
 * Reuses the existing "BDD Pilot" output channel. The run stream stays on the
 * pseudoterminal, so these JSON lines do not mix with `dotnet test` output.
 */
export function syncLifecycleTrace(output: vscode.OutputChannel): void {
  try {
    const want = readLifecycleTraceEnabled();
    if (want && !isTraceEnabled()) {
      startTraceSession((line) => {
        try {
          output.appendLine(line);
        } catch {
          // Channel already disposed.
        }
      });
      trace("session.start");
      return;
    }
    if (!want && isTraceEnabled()) {
      trace("session.stop");
      flushPresentation();
      stopTraceSession();
    }
  } catch {
    // Diagnostics must not break activation or configuration changes.
  }
}
