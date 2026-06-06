import { LastRunSnapshot } from "../diagnostics/aiFailureContext";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";
import { isCanceledRun } from "./dashboardLastKnown";
import {
  FilterMappingConfig,
} from "../runner/filterMapping";
import {
  RunTarget,
  buildFilter,
  featureClassName,
  sanitizeIdentifier,
} from "../runner/filterBuilder";
import { RunHistoryEntry, ScenarioRunRecord } from "./runHistory";

export interface DashboardActionTarget {
  kind: "session" | "history";
  entryId?: string;
  failed: number;
  stage: string;
  mode: string;
  filter?: string;
  timestamp: number;
}

export interface DashboardActionsViewModel {
  target?: DashboardActionTarget;
  canRerunFailed: boolean;
  canCopyForAi: boolean;
  aiEnabled: boolean;
}

export interface BuildDashboardActionsOptions {
  history: RunHistoryEntry[];
  sessionSnapshot?: LastRunSnapshot;
  sessionRerunFilter?: string;
  domains?: DomainGroup[];
  filterMapping?: FilterMappingConfig;
  aiEnabled: boolean;
}

export function resolveDashboardActionTarget(
  history: RunHistoryEntry[],
  sessionSnapshot?: LastRunSnapshot,
): DashboardActionTarget | undefined {
  if (sessionSnapshot && sessionSnapshot.summary.failed > 0) {
    return {
      kind: "session",
      failed: sessionSnapshot.summary.failed,
      stage: sessionSnapshot.stage,
      mode: sessionSnapshot.mode,
      filter: sessionSnapshot.filter,
      timestamp: sessionSnapshot.timestamp,
    };
  }

  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i]!;
    if (entry.failed > 0 && !isCanceledRun(entry)) {
      return targetFromHistoryEntry(entry);
    }
  }

  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i]!;
    if (entry.failed > 0 && isCanceledRun(entry)) {
      return targetFromHistoryEntry(entry);
    }
  }

  return undefined;
}

export function buildDashboardActionsViewModel(
  options: BuildDashboardActionsOptions,
): DashboardActionsViewModel {
  const target = resolveDashboardActionTarget(options.history, options.sessionSnapshot);
  if (!target) {
    return { canRerunFailed: false, canCopyForAi: false, aiEnabled: options.aiEnabled };
  }

  const historyEntry =
    target.kind === "history" && target.entryId
      ? options.history.find((e) => e.id === target.entryId)
      : undefined;

  const canRerunFailed = canRerunFailedForTarget(
    target,
    options.sessionRerunFilter,
    historyEntry,
    options.domains,
    options.filterMapping,
  );

  const canCopyForAi =
    options.aiEnabled && target.kind === "session" && !!options.sessionSnapshot;

  return {
    target,
    canRerunFailed,
    canCopyForAi,
    aiEnabled: options.aiEnabled,
  };
}

export function canRerunFailedForTarget(
  target: DashboardActionTarget,
  sessionRerunFilter: string | undefined,
  historyEntry: RunHistoryEntry | undefined,
  domains: DomainGroup[] | undefined,
  mapping: FilterMappingConfig | undefined,
): boolean {
  if (target.kind === "session") {
    return !!sessionRerunFilter;
  }
  if (!historyEntry || !mapping) {
    return false;
  }
  return !!buildRerunFilterFromHistoryEntry(historyEntry, mapping, domains);
}

export function buildRerunFilterFromHistoryEntry(
  entry: RunHistoryEntry,
  mapping: FilterMappingConfig,
  domains?: DomainGroup[],
): string | undefined {
  const failed = entry.scenarios.filter((s) => s.outcome === "failed");
  if (failed.length === 0) {
    return undefined;
  }

  const clauses: string[] = [];
  for (const scenario of failed) {
    const target = resolveTargetForFailedScenario(scenario, domains);
    if (target) {
      const clause = buildFilter(target, mapping);
      if (clause) {
        clauses.push(clause);
      }
      continue;
    }
    const clause = clauseFromFailedScenario(scenario, mapping);
    if (clause) {
      clauses.push(clause);
    }
  }

  const unique = clauses.filter((c, i, arr) => arr.indexOf(c) === i);
  return unique.length > 0 ? unique.join("|") : undefined;
}

function targetFromHistoryEntry(entry: RunHistoryEntry): DashboardActionTarget {
  return {
    kind: "history",
    entryId: entry.id,
    failed: entry.failed,
    stage: entry.stage,
    mode: entry.mode,
    filter: entry.filter,
    timestamp: entry.timestamp,
  };
}

function resolveTargetForFailedScenario(
  record: ScenarioRunRecord,
  domains?: DomainGroup[],
): RunTarget | undefined {
  if (!domains?.length) {
    return undefined;
  }
  const { featurePath, scenarioLine, scenarioName } = record;
  if (!featurePath || !scenarioName) {
    return undefined;
  }

  for (const domain of domains) {
    for (const feature of domain.features) {
      if (feature.filePath !== featurePath) {
        continue;
      }
      const scenario = findScenario(feature, scenarioLine, scenarioName);
      if (scenario) {
        return { kind: "scenario", feature, scenario };
      }
    }
  }
  return undefined;
}

function findScenario(
  feature: FeatureInfo,
  scenarioLine: number,
  scenarioName: string,
): ScenarioInfo | undefined {
  if (scenarioLine > 0) {
    const byLine = feature.scenarios.find(
      (s) => s.line === scenarioLine && s.name === scenarioName,
    );
    if (byLine) {
      return byLine;
    }
  }
  return feature.scenarios.find((s) => s.name === scenarioName);
}

function clauseFromFailedScenario(
  record: ScenarioRunRecord,
  mapping: FilterMappingConfig,
): string | undefined {
  if (record.featurePath && record.scenarioName) {
    const baseName = record.featurePath.replace(/\\/g, "/").split("/").pop() ?? "";
    const featureTitle = baseName.replace(/\.feature$/i, "");
    if (featureTitle) {
      const cls = featureClassName(featureTitle, mapping);
      const scenarioId = sanitizeIdentifier(record.scenarioName);
      return `FullyQualifiedName~${cls}.${scenarioId}`;
    }
  }
  if (record.scenarioName) {
    return `FullyQualifiedName~${shortTestName(record.scenarioName)}`;
  }
  return undefined;
}

function shortTestName(name: string): string {
  const parts = name.split(".");
  return parts[parts.length - 1] ?? name;
}

export type DashboardWebviewCommand = "showOutput" | "rerunFailed" | "copyForAi";

const WEBVIEW_COMMANDS = new Set<DashboardWebviewCommand>([
  "showOutput",
  "rerunFailed",
  "copyForAi",
]);

export function parseDashboardWebviewMessage(
  message: unknown,
): DashboardWebviewCommand | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const command = (message as { command?: unknown }).command;
  if (typeof command !== "string" || !WEBVIEW_COMMANDS.has(command as DashboardWebviewCommand)) {
    return undefined;
  }
  return command as DashboardWebviewCommand;
}
