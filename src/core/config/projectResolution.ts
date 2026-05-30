import * as fs from "fs";
import * as path from "path";
import {
  discoverProjectCandidates,
  findFiles,
  listProjectsInDir,
  resolveConfiguredPath,
} from "./projectLocator";

export type ProjectTargetKind = "csproj" | "sln" | "directory";

/** Active .NET test target for discovery, env loading, and `dotnet test`. */
export interface ResolvedProject {
  /** Working directory for `dotnet test`, TRX output, and `config/.env`. */
  projectDir: string;
  /** Absolute path to `.csproj`, `.sln`, or directory passed to `dotnet test`. */
  testTarget: string;
  kind: ProjectTargetKind;
  /** Short label for status bar / picker. */
  label: string;
}

export interface StoredProjectSelection {
  testTarget: string;
  projectDir: string;
  kind: ProjectTargetKind;
  label: string;
}

/**
 * Resolves the active test project. Priority:
 * 1. `bddPilot.projectPath` (file or directory)
 * 2. Workspace-stored selection
 * 3. Single auto-detected candidate
 * 4. `undefined` when multiple candidates — user must pick
 */
export function resolveProject(
  workspaceRoots: string[],
  configuredPath: string,
  storedSelection?: StoredProjectSelection,
): ResolvedProject | undefined {
  const fromSetting = resolveConfiguredPath(workspaceRoots, configuredPath);
  if (fromSetting) {
    return fromSetting;
  }

  if (storedSelection && pathExists(storedSelection.testTarget)) {
    return storedSelection;
  }

  const candidates = discoverProjectCandidates(workspaceRoots);
  if (candidates.length === 1) {
    return candidates[0];
  }

  return undefined;
}

export function toStoredSelection(project: ResolvedProject): StoredProjectSelection {
  return {
    testTarget: project.testTarget,
    projectDir: project.projectDir,
    kind: project.kind,
    label: project.label,
  };
}

/** Root directory for `.feature` discovery (project dir or workspace for solutions). */
export function discoveryRoot(project: ResolvedProject, workspaceRoots: string[]): string {
  if (project.kind === "sln") {
    for (const root of workspaceRoots) {
      if (isPathInside(project.testTarget, root)) {
        return root;
      }
    }
  }
  return project.projectDir;
}

function pathExists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function isPathInside(filePath: string, root: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(filePath));
  return rel !== ".." && !rel.startsWith(`..${path.sep}`);
}

/** Lists `.sln` files in workspace roots (for manual picker). */
export function discoverSolutionCandidates(workspaceRoots: string[]): ResolvedProject[] {
  const seen = new Set<string>();
  const results: ResolvedProject[] = [];
  for (const root of workspaceRoots) {
    for (const sln of findFiles(root, ".sln", 50)) {
      if (seen.has(sln)) {
        continue;
      }
      seen.add(sln);
      results.push({
        projectDir: path.dirname(sln),
        testTarget: sln,
        kind: "sln",
        label: path.basename(sln),
      });
    }
  }
  return results.sort((a, b) => a.label.localeCompare(b.label));
}

/** Merges feature-linked csproj candidates with optional solution entries. */
export function listSelectableProjects(workspaceRoots: string[]): ResolvedProject[] {
  const byTarget = new Map<string, ResolvedProject>();
  for (const c of discoverProjectCandidates(workspaceRoots)) {
    byTarget.set(c.testTarget, c);
  }
  for (const s of discoverSolutionCandidates(workspaceRoots)) {
    if (!byTarget.has(s.testTarget)) {
      byTarget.set(s.testTarget, s);
    }
  }
  return Array.from(byTarget.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/** When a directory has multiple csproj and no explicit file, list them for picking. */
export function expandDirectoryAmbiguity(
  workspaceRoots: string[],
  configuredPath: string,
): ResolvedProject[] | undefined {
  const trimmed = configuredPath.trim();
  if (!trimmed) {
    return undefined;
  }
  let absolute: string | undefined;
  if (path.isAbsolute(trimmed) && dirExists(trimmed)) {
    absolute = trimmed;
  } else {
    for (const root of workspaceRoots) {
      const candidate = path.resolve(root, trimmed);
      if (dirExists(candidate)) {
        absolute = candidate;
        break;
      }
    }
  }
  if (!absolute) {
    return undefined;
  }
  const projects = listProjectsInDir(absolute);
  if (projects.length <= 1) {
    return undefined;
  }
  return projects.map((testTarget) => ({
    projectDir: absolute!,
    testTarget,
    kind: "csproj" as const,
    label: path.basename(testTarget),
  }));
}

function dirExists(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
