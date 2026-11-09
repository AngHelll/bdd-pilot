import * as fs from "fs";
import * as path from "path";
import { PilotLocale, t } from "../i18n";

export type BuildOutputAssessment = "present" | "missing";

export const OUTPUT_WATCH_DEBOUNCE_MS = 300;

/** Execution target Pilot already resolved. Solutions and bare directories are skipped. */
export function isCsprojExecutionTarget(testTarget: string): boolean {
  return testTarget.toLowerCase().endsWith(".csproj");
}

/**
 * `present` when any `*.dll` exists under `{projectDir}/bin`.
 * Does not read the csproj or invoke MSBuild. `obj/` is not an output.
 */
export function assessBuildOutputs(projectDir: string): BuildOutputAssessment {
  const bin = path.join(projectDir, "bin");
  if (!fs.existsSync(bin)) {
    return "missing";
  }
  return containsDll(bin) ? "present" : "missing";
}

function containsDll(dir: string): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (containsDll(path.join(dir, entry.name))) {
        return true;
      }
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".dll")) {
      return true;
    }
  }
  return false;
}

/** Last gate before `dotnet test`. Only a csproj with `no-build` and no dll. */
export function shouldBlockForMissingOutputs(input: {
  noBuild: boolean;
  testTarget: string;
  assessment: BuildOutputAssessment;
}): boolean {
  return input.noBuild && isCsprojExecutionTarget(input.testTarget) && input.assessment === "missing";
}

/** Idle label when outputs are missing and the user has not just been blocked. */
export function formatOutputsRemovedLabel(locale: PilotLocale, noBuild: boolean): string {
  return t(locale, noBuild ? "tree.outputsMissingNoBuild" : "tree.outputsRemoved");
}

/** Idle watcher burst. One theory-cache invalidation per burst; no feature rescan. */
export function classifyIdleOutputChange(assessment: BuildOutputAssessment): {
  invalidateTheoryCache: true;
  removed: boolean;
} {
  return { invalidateTheoryCache: true, removed: assessment === "missing" };
}

/**
 * Recheck when a run or debug lock is released.
 * A Pilot run that finishes with outputs present does not invalidate the theory cache
 * unless the removed notice was already showing.
 */
export function classifyUnlockOutputRecheck(input: {
  assessment: BuildOutputAssessment;
  removedActiveBeforeLock: boolean;
  /** Assessment captured when the lock was taken. Undefined if there was no csproj. */
  assessmentBeforeLock: BuildOutputAssessment | undefined;
}): { invalidateTheoryCache: boolean; removed: boolean } {
  if (input.assessment === "present") {
    return {
      invalidateTheoryCache: input.removedActiveBeforeLock,
      removed: false,
    };
  }
  const becameMissing = input.assessmentBeforeLock === "present";
  if (!becameMissing && !input.removedActiveBeforeLock) {
    return { invalidateTheoryCache: false, removed: false };
  }
  return { invalidateTheoryCache: true, removed: true };
}
