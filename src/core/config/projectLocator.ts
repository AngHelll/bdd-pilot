import * as fs from "fs";
import * as path from "path";
import { ResolvedProject } from "./projectResolution";

const IGNORED_DIRS = new Set([
  "node_modules",
  "bin",
  "obj",
  ".git",
  ".vs",
  "dist",
  "out",
]);

/**
 * Finds the directory that contains the .NET test project (the folder holding
 * the .csproj that also owns the .feature files). Resolution order:
 *   1. Explicit configured path (absolute or relative to a workspace root).
 *   2. Auto-detection: the nearest ancestor directory of any .feature file
 *      that also contains a .csproj.
 *
 * @deprecated Prefer {@link resolveProject} from `projectResolution.ts` for
 * multi-project workspaces.
 */
export function resolveProjectDir(
  workspaceRoots: string[],
  configuredPath: string,
): string | undefined {
  const configured = resolveConfiguredPath(workspaceRoots, configuredPath);
  if (configured) {
    return configured.projectDir;
  }

  for (const root of workspaceRoots) {
    const found = autoDetect(root);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function resolveConfiguredPath(
  workspaceRoots: string[],
  configuredPath: string,
): ResolvedProject | undefined {
  const trimmed = configuredPath.trim();
  if (!trimmed) {
    return undefined;
  }

  const absolute = resolveAbsolutePath(workspaceRoots, trimmed);
  if (!absolute) {
    return undefined;
  }

  const lower = absolute.toLowerCase();
  if (lower.endsWith(".csproj")) {
    return makeProject(path.dirname(absolute), absolute, "csproj");
  }
  if (lower.endsWith(".sln")) {
    return makeProject(path.dirname(absolute), absolute, "sln");
  }

  if (!dirExists(absolute)) {
    return undefined;
  }

  const csprojs = listProjectsInDir(absolute);
  const slns = listFilesWithExt(absolute, ".sln");
  if (csprojs.length === 1) {
    return makeProject(absolute, csprojs[0], "csproj");
  }
  if (csprojs.length === 0 && slns.length === 1) {
    return makeProject(absolute, slns[0], "sln");
  }
  if (csprojs.length === 0 && slns.length === 0) {
    return makeProject(absolute, absolute, "directory");
  }
  return undefined;
}

/** Candidates inferred from `.feature` files → nearest `.csproj`. */
export function discoverProjectCandidates(workspaceRoots: string[]): ResolvedProject[] {
  const counts = new Map<string, { project: ResolvedProject; features: number }>();

  for (const root of workspaceRoots) {
    const featureFiles = findFiles(root, ".feature", 500);
    for (const featureFile of featureFiles) {
      const projectDir = findCsprojAncestor(path.dirname(featureFile), root);
      if (!projectDir) {
        continue;
      }
      const csproj = findPrimaryCsproj(projectDir);
      if (!csproj) {
        continue;
      }
      const existing = counts.get(csproj);
      if (existing) {
        existing.features += 1;
      } else {
        counts.set(csproj, {
          project: makeProject(projectDir, csproj, "csproj"),
          features: 1,
        });
      }
    }
  }

  return Array.from(counts.values())
    .map(({ project, features }) => ({
      ...project,
      label: formatCandidateLabel(project.label, features),
    }))
    .sort((a, b) => a.testTarget.localeCompare(b.testTarget));
}

export function listProjectsInDir(dir: string): string[] {
  return listFilesWithExt(dir, ".csproj").map((name) => path.join(dir, name));
}

function autoDetect(root: string): string | undefined {
  const candidates = discoverProjectCandidates([root]);
  if (candidates.length === 1) {
    return candidates[0].projectDir;
  }
  return undefined;
}

function findCsprojAncestor(startDir: string, stopRoot: string): string | undefined {
  let current = startDir;
  const stop = path.resolve(stopRoot);
  let reachedTop = false;
  while (!reachedTop) {
    if (findPrimaryCsproj(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current || current === stop) {
      reachedTop = true;
    } else {
      current = parent;
    }
  }
  return undefined;
}

function findPrimaryCsproj(dir: string): string | undefined {
  const csprojs = listProjectsInDir(dir);
  return csprojs.length > 0 ? csprojs[0] : undefined;
}

function makeProject(
  projectDir: string,
  testTarget: string,
  kind: ResolvedProject["kind"],
): ResolvedProject {
  return {
    projectDir,
    testTarget,
    kind,
    label: path.basename(testTarget),
  };
}

function formatCandidateLabel(base: string, featureCount: number): string {
  return `${base} (${featureCount} feature${featureCount === 1 ? "" : "s"})`;
}

function resolveAbsolutePath(workspaceRoots: string[], configuredPath: string): string | undefined {
  if (path.isAbsolute(configuredPath)) {
    return pathExists(configuredPath) ? configuredPath : undefined;
  }
  for (const root of workspaceRoots) {
    const candidate = path.resolve(root, configuredPath);
    if (pathExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function findFiles(root: string, ext: string, limit: number): string[] {
  const results: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0 && results.length < limit) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          stack.push(full);
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

function listFilesWithExt(dir: string, ext: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(ext))
      .sort();
  } catch {
    return [];
  }
}

function pathExists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function dirExists(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
