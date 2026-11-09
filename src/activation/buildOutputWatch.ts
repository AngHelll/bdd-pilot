import * as vscode from "vscode";
import {
  assessBuildOutputs,
  classifyIdleOutputChange,
  classifyUnlockOutputRecheck,
  isCsprojExecutionTarget,
  OUTPUT_WATCH_DEBOUNCE_MS,
} from "../core/runner/buildOutputReadiness";

export interface BuildOutputProject {
  projectDir: string;
  testTarget: string;
}

export interface BuildOutputWatchDeps {
  getProject: () => BuildOutputProject | undefined;
  /** Run or debug still owns the outputs. Distinct from `suspend`. */
  isLocked: () => boolean;
  invalidateTheoryCache: () => void;
  setRemoved: (removed: boolean) => void;
  /** Clears only the `outputs-missing` not-started notice. */
  clearOutputsMissingNotice: () => void;
  refreshSummary: () => void;
  /** `run.noBuild` changed. The caller clears `outputs-missing` when the setting is now off. */
  onNoBuildChanged: () => void;
}

export interface BuildOutputWatch {
  /** Ignore watcher paints until `resume`. Snapshots the removed notice on the first hold. */
  suspend(): void;
  /** Re-evaluate once. Swallows watcher tails from the run that just finished. */
  resume(): void;
  /** Clears the visible removed phrase once `dotnet` is actually starting. */
  noteExecutionEntered(): void;
  /** Re-evaluate when a debug session ends and this watch is not suspended. */
  recheck(): void;
  /** Retarget `bin/` and `obj/` when the execution project changes. */
  sync(): void;
  dispose(): void;
}

/**
 * Watches only `{projectDir}/bin` and `{projectDir}/obj` of the csproj Pilot executes.
 * Decisions stay in `assessBuildOutputs`. This module only subscribes and debounces.
 */
export function createBuildOutputWatch(deps: BuildOutputWatchDeps): BuildOutputWatch {
  let suspendCount = 0;
  let removedActive = false;
  let removedBeforeLock = false;
  let assessmentBeforeLock: ReturnType<typeof assessBuildOutputs> | undefined;
  let armedKey: string | undefined;
  let graceUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchers: vscode.FileSystemWatcher[] = [];

  const held = (): boolean => suspendCount > 0 || deps.isLocked();

  const clearTimer = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const disposeWatchers = (): void => {
    clearTimer();
    for (const watcher of watchers) {
      watcher.dispose();
    }
    watchers.length = 0;
  };

  const publish = (removed: boolean, clearMissing: boolean): void => {
    const changed = removedActive !== removed;
    removedActive = removed;
    if (clearMissing) {
      deps.clearOutputsMissingNotice();
    }
    if (changed || clearMissing) {
      deps.setRemoved(removed);
      deps.refreshSummary();
    }
  };

  const projectIfCsproj = (): BuildOutputProject | undefined => {
    const project = deps.getProject();
    if (!project || !isCsprojExecutionTarget(project.testTarget)) {
      return undefined;
    }
    return project;
  };

  const applyIdle = (): void => {
    const project = projectIfCsproj();
    if (!project) {
      return;
    }
    const effect = classifyIdleOutputChange(assessBuildOutputs(project.projectDir));
    deps.invalidateTheoryCache();
    publish(effect.removed, !effect.removed);
  };

  const applyUnlock = (): void => {
    const project = projectIfCsproj();
    if (!project) {
      publish(false, true);
      removedBeforeLock = false;
      assessmentBeforeLock = undefined;
      return;
    }
    const assessment = assessBuildOutputs(project.projectDir);
    const effect = classifyUnlockOutputRecheck({
      assessment,
      removedActiveBeforeLock: removedBeforeLock,
      assessmentBeforeLock,
    });
    removedBeforeLock = false;
    assessmentBeforeLock = undefined;
    if (effect.invalidateTheoryCache) {
      deps.invalidateTheoryCache();
    }
    publish(effect.removed, assessment === "present");
  };

  const schedule = (): void => {
    if (held() || Date.now() < graceUntil) {
      return;
    }
    clearTimer();
    timer = setTimeout(() => {
      timer = undefined;
      if (held() || Date.now() < graceUntil) {
        return;
      }
      applyIdle();
    }, OUTPUT_WATCH_DEBOUNCE_MS);
  };

  const arm = (projectDir: string): void => {
    for (const glob of ["bin/**", "obj/**"]) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(projectDir, glob),
      );
      watcher.onDidCreate(schedule);
      watcher.onDidChange(schedule);
      watcher.onDidDelete(schedule);
      watchers.push(watcher);
    }
  };

  const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("bddPilot.projectPath")) {
      sync();
    }
    if (event.affectsConfiguration("bddPilot.run.noBuild")) {
      deps.onNoBuildChanged();
    }
  });

  function sync(): void {
    const project = projectIfCsproj();
    const key = project?.projectDir;
    if (key === armedKey) {
      return;
    }
    disposeWatchers();
    const previous = armedKey;
    armedKey = key;
    if (previous !== undefined) {
      removedBeforeLock = false;
      publish(false, true);
    }
    if (project) {
      arm(project.projectDir);
    }
  }

  return {
    suspend(): void {
      if (suspendCount === 0) {
        removedBeforeLock = removedActive;
        const project = projectIfCsproj();
        assessmentBeforeLock = project ? assessBuildOutputs(project.projectDir) : undefined;
      }
      suspendCount += 1;
      clearTimer();
    },
    resume(): void {
      if (suspendCount === 0) {
        return;
      }
      suspendCount -= 1;
      if (suspendCount > 0) {
        return;
      }
      clearTimer();
      graceUntil = Date.now() + OUTPUT_WATCH_DEBOUNCE_MS;
      if (deps.isLocked()) {
        return;
      }
      applyUnlock();
    },
    recheck(): void {
      if (suspendCount > 0 || deps.isLocked()) {
        return;
      }
      clearTimer();
      applyUnlock();
    },
    /** Drops the visible removed phrase once `dotnet` is actually starting. The unlock snapshot stays. */
    noteExecutionEntered(): void {
      if (!removedActive) {
        return;
      }
      removedActive = false;
      deps.setRemoved(false);
      deps.refreshSummary();
    },
    sync,
    dispose(): void {
      configListener.dispose();
      disposeWatchers();
      armedKey = undefined;
    },
  };
}
