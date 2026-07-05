import * as vscode from "vscode";
import { DomainGroup } from "../core/gherkin/model";
import { summarizeOutcomeStore } from "../core/results/outcomeStoreSummary";
import { RunService } from "../providers/runService";
import { OutcomeStore } from "../providers/outcomeStore";
import {
  assertPilotRunApiExportSurface,
  PilotRunApiV1,
} from "./types";
import {
  countOutcomeStoreLeaves,
  mapLastRun,
  mapRollup,
  mapRunHistory,
} from "./pilotRunApiMapper";

export interface CreatePilotRunApiDeps {
  runService: RunService;
  outcomeStore: OutcomeStore;
  isReady: () => boolean;
  isRunInProgress: () => boolean;
  getDomains: () => DomainGroup[];
}

export function createPilotRunApi(deps: CreatePilotRunApiDeps): PilotRunApiV1 {
  const api: PilotRunApiV1 = {
    apiVersion: 1,

    get isReady(): boolean {
      return deps.isReady();
    },

    isRunInProgress(): boolean {
      return deps.isRunInProgress();
    },

    getRunHistory() {
      return mapRunHistory(deps.runService.getHistory());
    },

    getLastRun() {
      const snapshot = deps.runService.getLastRunSnapshot();
      return snapshot ? mapLastRun(snapshot) : null;
    },

    getCurrentRollup() {
      const domains = deps.getDomains();
      const rollup = summarizeOutcomeStore(deps.outcomeStore, domains);
      if (!rollup) {
        return null;
      }
      return mapRollup(rollup, countOutcomeStoreLeaves(domains));
    },

    onDidCompleteRun(listener: () => void): vscode.Disposable {
      return deps.runService.onRunCompleted(listener);
    },

    onDidChangeHistory(listener: () => void): vscode.Disposable {
      return deps.runService.onHistoryChanged(listener);
    },
  };

  assertPilotRunApiExportSurface(api);
  return api;
}
