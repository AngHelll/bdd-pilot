import * as vscode from "vscode";
import { isGuardianIndexApiV1, hasGuardianResolveStepApi } from "./guardianApiTypes";

export type GuardianSkipReason = "notInstalled" | "disabled" | "notReady" | "unsupported" | "error";

export type GuardianResolveStepFn = (featurePath: string, line0: number) => unknown;

export type GuardianResolverResult =
  | { kind: "ready"; resolveStep: GuardianResolveStepFn }
  | { kind: "skip"; reason: GuardianSkipReason };

const GUARDIAN_EXTENSION_ID = "anghelll.bdd-guardian";

export async function tryGetGuardianResolveStep(): Promise<GuardianResolverResult> {
  const ext = vscode.extensions.getExtension(GUARDIAN_EXTENSION_ID);
  if (!ext) {
    return { kind: "skip", reason: "notInstalled" };
  }

  try {
    await ext.activate();
  } catch {
    return { kind: "skip", reason: "disabled" };
  }

  const exportsValue = ext.exports;
  if (!isGuardianIndexApiV1(exportsValue)) {
    return { kind: "skip", reason: "error" };
  }

  if (!exportsValue.isReady) {
    return { kind: "skip", reason: "notReady" };
  }

  if (!hasGuardianResolveStepApi(exportsValue)) {
    return { kind: "skip", reason: "unsupported" };
  }

  const resolveStep = exportsValue.resolveStep!.bind(exportsValue);
  return {
    kind: "ready",
    resolveStep: (featurePath: string, line0: number) => resolveStep(featurePath, line0),
  };
}
