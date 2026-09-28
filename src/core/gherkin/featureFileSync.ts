import * as fs from "fs";
import * as path from "path";
import { groupByDomain } from "./grouping";
import { DomainGroup, FeatureInfo, OutlineExample, ScenarioInfo } from "./model";
import { parseFeature } from "./parser";
import { scenarioNeedsTheoryDiscovery } from "./theoryExamples";

/** Coalesce auto-save of the same feature before touching the tree. */
export const FEATURE_SAVE_REFRESH_DEBOUNCE_MS = 300;

export type TheoryEnrichAction = "skip" | "reapply" | "spawn" | "defer";

export function normalizeFeaturePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, "/");
}

/** True when `filePath` is a `.feature` inside `projectDir` (not a sibling or parent). */
export function isFeatureFileInProject(projectDir: string, filePath: string): boolean {
  if (!filePath.toLowerCase().endsWith(".feature")) {
    return false;
  }
  const relative = path.relative(projectDir, filePath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/** Structural identity of the file as parsed. Inferred theory rows are not part of it. */
export function featureFileKey(feature: FeatureInfo): string {
  const lines = [feature.name, feature.tags.join(",")];
  for (const scenario of feature.scenarios) {
    lines.push(scenarioFileKey(scenario));
  }
  return lines.join("\n");
}

/**
 * Identity of the scenarios that still need `list-tests`.
 * Undefined when every scenario already has an Examples table or no parameters.
 */
export function theoryDiscoveryKey(feature: FeatureInfo): string | undefined {
  const parts: string[] = [];
  for (const scenario of feature.scenarios) {
    if (!scenarioNeedsTheoryDiscovery(scenario)) {
      continue;
    }
    const params = (scenario.stepParams ?? []).join(",");
    parts.push(
      `${scenario.line}|${scenario.name}|${scenario.isOutline ? "1" : "0"}|${params}`,
    );
  }
  return parts.length > 0 ? parts.join("\n") : undefined;
}

export function theoryDiscoveryKeys(domains: DomainGroup[]): Map<string, string> {
  const keys = new Map<string, string>();
  for (const domain of domains) {
    for (const feature of domain.features) {
      const key = theoryDiscoveryKey(feature);
      if (key) {
        keys.set(normalizeFeaturePath(feature.filePath), key);
      }
    }
  }
  return keys;
}

export function indexFeatureFileKeys(domains: DomainGroup[]): Map<string, string> {
  const keys = new Map<string, string>();
  for (const domain of domains) {
    for (const feature of domain.features) {
      keys.set(normalizeFeaturePath(feature.filePath), featureFileKey(feature));
    }
  }
  return keys;
}

export interface SavedFeatureModel {
  domains: DomainGroup[];
  fileKeys: Map<string, string>;
  changed: boolean;
}

export function applySavedFeature(
  domains: DomainGroup[],
  fileKeys: ReadonlyMap<string, string>,
  feature: FeatureInfo,
): SavedFeatureModel {
  const pathKey = normalizeFeaturePath(feature.filePath);
  const nextKey = featureFileKey(feature);
  if (fileKeys.get(pathKey) === nextKey) {
    return { domains, fileKeys: asMutable(fileKeys), changed: false };
  }
  const features = flatten(domains).filter(
    (item) => normalizeFeaturePath(item.filePath) !== pathKey,
  );
  features.push(feature);
  const nextKeys = new Map(fileKeys);
  nextKeys.set(pathKey, nextKey);
  return { domains: groupByDomain(features), fileKeys: nextKeys, changed: true };
}

export function removeSavedFeature(
  domains: DomainGroup[],
  fileKeys: ReadonlyMap<string, string>,
  filePath: string,
): SavedFeatureModel {
  const pathKey = normalizeFeaturePath(filePath);
  const present = flatten(domains).some(
    (item) => normalizeFeaturePath(item.filePath) === pathKey,
  );
  if (!present && !fileKeys.has(pathKey)) {
    return { domains, fileKeys: asMutable(fileKeys), changed: false };
  }
  const features = flatten(domains).filter(
    (item) => normalizeFeaturePath(item.filePath) !== pathKey,
  );
  const nextKeys = new Map(fileKeys);
  nextKeys.delete(pathKey);
  return { domains: groupByDomain(features), fileKeys: nextKeys, changed: true };
}

export function renameSavedFeature(
  domains: DomainGroup[],
  fileKeys: ReadonlyMap<string, string>,
  oldPath: string,
  newPath: string,
): SavedFeatureModel {
  const from = normalizeFeaturePath(oldPath);
  const to = normalizeFeaturePath(newPath);
  if (from === to) {
    return { domains, fileKeys: asMutable(fileKeys), changed: false };
  }
  const existing = flatten(domains).find(
    (item) => normalizeFeaturePath(item.filePath) === from,
  );
  if (!existing) {
    return { domains, fileKeys: asMutable(fileKeys), changed: false };
  }
  const moved: FeatureInfo = { ...existing, filePath: newPath };
  const features = flatten(domains).filter((item) => {
    const key = normalizeFeaturePath(item.filePath);
    return key !== from && key !== to;
  });
  features.push(moved);
  const nextKeys = new Map(fileKeys);
  nextKeys.delete(from);
  nextKeys.set(to, featureFileKey(moved));
  return { domains: groupByDomain(features), fileKeys: nextKeys, changed: true };
}

export function resolveTheoryEnrichAction(
  feature: FeatureInfo,
  cache: { names: string[] | undefined; key: string | undefined },
  runActive: boolean,
): TheoryEnrichAction {
  const key = theoryDiscoveryKey(feature);
  if (!key) {
    return "skip";
  }
  if (cache.key === key && cache.names !== undefined) {
    return "reapply";
  }
  return runActive ? "defer" : "spawn";
}

export interface FeatureFileSyncDeps {
  getProjectDir: () => string | undefined;
  isRunActive: () => boolean;
  applySavedFeature: (feature: FeatureInfo) => boolean;
  removeFeature: (filePath: string) => boolean;
  renameFeature: (oldPath: string, newPath: string) => boolean;
  refreshManaged: () => void;
  reapplyTheory: (names: string[]) => Promise<boolean>;
  scheduleEnrich: () => void;
  readFeatureText?: (filePath: string) => string | undefined;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface FeatureFileSync {
  onSaved(filePath: string, text: string): void;
  onDeleted(paths: string[]): void;
  onRenamed(moves: Array<{ oldPath: string; newPath: string }>): void;
  flushDeferredEnrich(): void;
  invalidateTheoryCache(): void;
  noteTheoryList(names: string[], keys: ReadonlyMap<string, string>): void;
  dispose(): void;
}

export function createFeatureFileSync(deps: FeatureFileSyncDeps): FeatureFileSync {
  const theoryKeys = new Map<string, string>();
  const pending = new Map<string, { filePath: string; text: string }>();
  let listedNames: string[] | undefined;
  let enrichDeferred = false;
  let timer: unknown;

  const setTimer =
    deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    deps.clearTimer ??
    ((handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
  const readFeatureText = deps.readFeatureText ?? readFeatureFile;

  const arm = (): void => {
    if (timer !== undefined) {
      clearTimer(timer);
      timer = undefined;
    }
    timer = setTimer(() => {
      timer = undefined;
      flushPending();
    }, FEATURE_SAVE_REFRESH_DEBOUNCE_MS);
  };

  const applyText = (
    filePath: string,
    text: string,
  ): { changed: boolean; action: TheoryEnrichAction } => {
    const projectDir = deps.getProjectDir();
    if (!projectDir || !isFeatureFileInProject(projectDir, filePath)) {
      return { changed: false, action: "skip" };
    }
    const feature = parseFeature(filePath, text);
    const changed = deps.applySavedFeature(feature);
    if (!changed) {
      return { changed: false, action: "skip" };
    }
    const pathKey = normalizeFeaturePath(filePath);
    const action = resolveTheoryEnrichAction(
      feature,
      { names: listedNames, key: theoryKeys.get(pathKey) },
      deps.isRunActive(),
    );
    if (action === "skip") {
      theoryKeys.delete(pathKey);
    }
    return { changed: true, action };
  };

  const finishBatch = (
    changedAny: boolean,
    sawReapply: boolean,
    sawSpawn: boolean,
  ): void => {
    if (sawSpawn) {
      if (changedAny) {
        deps.refreshManaged();
      }
      deps.scheduleEnrich();
      return;
    }
    if (sawReapply && listedNames) {
      void deps.reapplyTheory(listedNames).then(
        () => {
          if (changedAny) {
            deps.refreshManaged();
          }
        },
        () => {
          if (changedAny) {
            deps.refreshManaged();
          }
        },
      );
      return;
    }
    if (changedAny) {
      deps.refreshManaged();
    }
  };

  const flushPending = (): void => {
    const batch = [...pending.values()];
    pending.clear();
    let changedAny = false;
    let sawReapply = false;
    let sawSpawn = false;
    for (const { filePath, text } of batch) {
      const result = applyText(filePath, text);
      if (result.changed) {
        changedAny = true;
      }
      if (result.action === "reapply") {
        sawReapply = true;
      } else if (result.action === "spawn") {
        sawSpawn = true;
      } else if (result.action === "defer") {
        enrichDeferred = true;
      }
    }
    finishBatch(changedAny, sawReapply, sawSpawn);
  };

  return {
    onSaved(filePath: string, text: string): void {
      pending.set(normalizeFeaturePath(filePath), { filePath, text });
      arm();
    },

    onDeleted(paths: string[]): void {
      let changed = false;
      for (const filePath of paths) {
        const pathKey = normalizeFeaturePath(filePath);
        pending.delete(pathKey);
        theoryKeys.delete(pathKey);
        if (deps.removeFeature(filePath)) {
          changed = true;
        }
      }
      if (changed) {
        deps.refreshManaged();
      }
    },

    onRenamed(moves: Array<{ oldPath: string; newPath: string }>): void {
      const projectDir = deps.getProjectDir();
      if (!projectDir) {
        return;
      }
      let changed = false;
      let sawReapply = false;
      let sawSpawn = false;
      for (const move of moves) {
        const featureMove =
          move.oldPath.toLowerCase().endsWith(".feature") ||
          move.newPath.toLowerCase().endsWith(".feature");
        if (!featureMove) {
          continue;
        }
        const oldKey = normalizeFeaturePath(move.oldPath);
        const newKey = normalizeFeaturePath(move.newPath);
        const queued = pending.get(oldKey);
        pending.delete(oldKey);
        const cachedKey = theoryKeys.get(oldKey);
        theoryKeys.delete(oldKey);

        const newInside = isFeatureFileInProject(projectDir, move.newPath);
        if (!newInside) {
          if (deps.removeFeature(move.oldPath)) {
            changed = true;
          }
          continue;
        }
        if (deps.renameFeature(move.oldPath, move.newPath)) {
          if (cachedKey) {
            theoryKeys.set(newKey, cachedKey);
          }
          if (queued !== undefined) {
            pending.set(newKey, { filePath: move.newPath, text: queued.text });
            arm();
          }
          changed = true;
          continue;
        }
        const text = queued?.text ?? readFeatureText(move.newPath);
        if (text === undefined) {
          continue;
        }
        const result = applyText(move.newPath, text);
        if (result.changed) {
          changed = true;
        }
        if (result.action === "reapply") {
          sawReapply = true;
        } else if (result.action === "spawn") {
          sawSpawn = true;
        } else if (result.action === "defer") {
          enrichDeferred = true;
        }
      }
      finishBatch(changed, sawReapply, sawSpawn);
    },

    flushDeferredEnrich(): void {
      if (!enrichDeferred || deps.isRunActive()) {
        return;
      }
      enrichDeferred = false;
      deps.scheduleEnrich();
    },

    invalidateTheoryCache(): void {
      theoryKeys.clear();
      listedNames = undefined;
      enrichDeferred = false;
      pending.clear();
      if (timer !== undefined) {
        clearTimer(timer);
        timer = undefined;
      }
    },

    noteTheoryList(names: string[], keys: ReadonlyMap<string, string>): void {
      listedNames = names;
      for (const [pathKey, key] of keys) {
        theoryKeys.set(pathKey, key);
      }
    },

    dispose(): void {
      if (timer !== undefined) {
        clearTimer(timer);
        timer = undefined;
      }
      pending.clear();
    },
  };
}

function scenarioFileKey(scenario: ScenarioInfo): string {
  const examples = (scenario.examples ?? []).map(exampleFileKey).join(";");
  const params = (scenario.stepParams ?? []).join(",");
  return [
    scenario.line,
    scenario.name,
    scenario.isOutline ? "1" : "0",
    scenario.tags.join(","),
    params,
    examples,
  ].join("|");
}

function exampleFileKey(example: OutlineExample): string {
  return [
    example.rowIndex,
    example.line,
    example.label,
    example.headers.join(","),
    example.values.join(","),
  ].join("~");
}

function flatten(domains: DomainGroup[]): FeatureInfo[] {
  const features: FeatureInfo[] = [];
  for (const domain of domains) {
    for (const feature of domain.features) {
      features.push(feature);
    }
  }
  return features;
}

function asMutable(fileKeys: ReadonlyMap<string, string>): Map<string, string> {
  return fileKeys instanceof Map ? fileKeys : new Map(fileKeys);
}

function readFeatureFile(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}
