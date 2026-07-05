/**
 * Pilot Run API v1 — serializable DTOs for extension.exports consumers.
 * @see docs/EXTENSION_API.md
 */

export type PilotRunStatus = "completed" | "canceled";

export interface PilotScenarioRunRecordDto {
  featurePath: string;
  scenarioLine: number;
  scenarioName: string;
  outcome: "passed" | "failed" | "skipped" | "unknown";
  durationMs?: number;
  errorMessage?: string;
}

export interface PilotRunHistoryEntryDto {
  id: string;
  timestamp: number;
  stage: string;
  mode: string;
  scopeLabel?: string;
  filter?: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs?: number;
  status?: PilotRunStatus;
  scenarios: PilotScenarioRunRecordDto[];
  trxPath?: string;
}

export interface PilotRunSummaryDto {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  source?: string;
}

export interface PilotFailedScenarioDto {
  featurePath: string;
  scenarioName: string;
  errorMessage?: string;
}

export interface PilotDiagnosticDto {
  code: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail?: string;
  hint: string;
}

export interface PilotEvidenceDto {
  kind: string;
  path: string;
}

export interface PilotLastRunDto {
  timestamp: number;
  stage: string;
  mode: string;
  filter?: string;
  scopeLabels: string[];
  projectDir: string;
  testTarget?: string;
  exitCode: number | null;
  status: PilotRunStatus;
  summary: PilotRunSummaryDto;
  failedScenarios: PilotFailedScenarioDto[];
  diagnostics: PilotDiagnosticDto[];
  evidence: PilotEvidenceDto[];
  trxPath?: string;
}

export interface PilotOutcomeRollupDto {
  passed: number;
  failed: number;
  skipped: number;
  withResults: number;
  pending: number;
}

export interface PilotRunApiV1 {
  readonly apiVersion: 1;
  readonly isReady: boolean;
  isRunInProgress(): boolean;
  getRunHistory(): PilotRunHistoryEntryDto[];
  getLastRun(): PilotLastRunDto | null;
  getCurrentRollup(): PilotOutcomeRollupDto | null;
  onDidCompleteRun(listener: () => void): import("vscode").Disposable;
  onDidChangeHistory(listener: () => void): import("vscode").Disposable;
}

export function isPilotRunApiV1(v: unknown): v is PilotRunApiV1 {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as PilotRunApiV1).apiVersion === 1 &&
    typeof (v as PilotRunApiV1).isReady === "boolean" &&
    typeof (v as PilotRunApiV1).isRunInProgress === "function" &&
    typeof (v as PilotRunApiV1).getRunHistory === "function" &&
    typeof (v as PilotRunApiV1).getLastRun === "function" &&
    typeof (v as PilotRunApiV1).getCurrentRollup === "function" &&
    typeof (v as PilotRunApiV1).onDidCompleteRun === "function" &&
    typeof (v as PilotRunApiV1).onDidChangeHistory === "function"
  );
}

const FORBIDDEN_EXPORT_METHODS = ["run", "cancel", "debug"] as const;

/** Validates producer export surface has no execution methods. */
export function assertPilotRunApiExportSurface(api: PilotRunApiV1): void {
  for (const key of FORBIDDEN_EXPORT_METHODS) {
    if (key in api) {
      throw new Error(`Pilot Run API must not expose ${key}()`);
    }
  }
}
