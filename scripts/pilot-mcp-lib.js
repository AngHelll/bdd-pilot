// Shared MCP tool logic (testable; used by pilot-mcp-server.js).
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  getRepoRoot,
  ensureOutTest,
  requireOutTest,
} = require("./pilot-out-test");

const SCRIPT_DIR = __dirname;
const ROOT = getRepoRoot(SCRIPT_DIR);
const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

const READ_ONLY_NOTICE =
  "Read-only. Output may contain test failure data; review before sharing with external AI.";

function getCliPath() {
  const ext = process.env.BDD_PILOT_EXTENSION_PATH?.trim();
  if (ext) {
    return path.join(ext, "dist/pilot-cli.js");
  }
  return path.join(ROOT, "scripts/pilot-cli.js");
}

function loadSecurityModules() {
  ensureOutTest(SCRIPT_DIR);
  return {
    assertPathUnderRoot: requireOutTest(SCRIPT_DIR, "security/pathJail").assertPathUnderRoot,
    PathJailError: requireOutTest(SCRIPT_DIR, "security/pathJail").PathJailError,
    sanitizeToolPayload: requireOutTest(SCRIPT_DIR, "security/sanitizeToolPayload").sanitizeToolPayload,
  };
}

function getWorkspaceRoot() {
  const fromEnv = process.env.BDD_PILOT_WORKSPACE_ROOT?.trim();
  return fromEnv ? path.resolve(fromEnv) : process.cwd();
}

function toolError(message) {
  return { ok: false, isError: true, message };
}

function toolSuccess(structuredContent) {
  const { sanitizeToolPayload } = loadSecurityModules();
  return {
    ok: true,
    isError: false,
    structuredContent: sanitizeToolPayload(structuredContent),
  };
}

function assertUnderWorkspace(targetPath, workspaceRoot) {
  const { assertPathUnderRoot, PathJailError } = loadSecurityModules();
  try {
    assertPathUnderRoot(targetPath, workspaceRoot);
  } catch (err) {
    if (err instanceof PathJailError) {
      throw err;
    }
    throw err;
  }
}

function assertArtifactFile(filePath, workspaceRoot) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return toolError(`file not found: ${path.basename(resolved)}`);
  }
  try {
    assertUnderWorkspace(resolved, workspaceRoot);
  } catch {
    return toolError("path outside workspace root");
  }
  const stat = fs.statSync(resolved);
  if (stat.size > MAX_ARTIFACT_BYTES) {
    return toolError("file too large (max 5 MB)");
  }
  return null;
}

function assertProjectDir(projectDir, workspaceRoot) {
  const resolved = path.resolve(projectDir);
  try {
    assertUnderWorkspace(resolved, workspaceRoot);
  } catch {
    return toolError("path outside workspace root");
  }
  return null;
}

function runPilotCli(args) {
  const result = spawnSync(process.execPath, [getCliPath(), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseCliJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return undefined;
  }
}

function mapCliResult(result) {
  if (result.status === 0) {
    const payload = parseCliJson(result.stdout);
    if (payload === undefined) {
      return toolError("invalid JSON from pilot-cli");
    }
    return toolSuccess(payload);
  }
  const message =
    result.status === 2
      ? (result.stderr.trim().split("\n")[0] || "pilot-cli usage error")
      : result.stderr.trim() || "pilot-cli internal error";
  return toolError(message);
}

function readLastFailurePaths(projectDir) {
  ensureOutTest(SCRIPT_DIR);
  const {
    readLastFailureArtifact,
    resolveArtifactRelativePath,
  } = requireOutTest(SCRIPT_DIR, "core/diagnostics/lastFailureArtifact");
  const artifact = readLastFailureArtifact(projectDir);
  if (!artifact) {
    return toolError("no last failure artifact");
  }
  const resolvedProjectDir = path.resolve(projectDir);
  const trxPath = artifact.trxPath
    ? resolveArtifactRelativePath(resolvedProjectDir, artifact.trxPath)
    : undefined;
  const logPath = artifact.logPath
    ? resolveArtifactRelativePath(resolvedProjectDir, artifact.logPath)
    : undefined;
  if (!trxPath && !logPath) {
    return toolError("no last failure artifact");
  }
  return { ok: true, trxPath, logPath };
}

function handleAnalyzeLog({ logPath }, workspaceRoot = getWorkspaceRoot()) {
  if (!logPath) {
    return toolError("logPath is required");
  }
  const artifactError = assertArtifactFile(logPath, workspaceRoot);
  if (artifactError) {
    return artifactError;
  }
  return mapCliResult(runPilotCli(["analyze", logPath]));
}

function handleDiscoverBdd({ projectDir, enrich, testTarget }, workspaceRoot = getWorkspaceRoot()) {
  if (!projectDir) {
    return toolError("projectDir is required");
  }
  const jailError = assertProjectDir(projectDir, workspaceRoot);
  if (jailError) {
    return jailError;
  }
  if (testTarget) {
    const targetError = assertArtifactFile(testTarget, workspaceRoot);
    if (targetError) {
      return targetError;
    }
  }

  const args = ["discover", projectDir];
  if (enrich) {
    args.push("--enrich");
  }
  if (testTarget) {
    args.push("--test-target", testTarget);
  }
  return mapCliResult(runPilotCli(args));
}

function handleBuildFilter(params, workspaceRoot = getWorkspaceRoot()) {
  const { projectDir, scope, tag, featurePath, scenarioName } = params;
  if (!projectDir) {
    return toolError("projectDir is required");
  }
  const jailError = assertProjectDir(projectDir, workspaceRoot);
  if (jailError) {
    return jailError;
  }

  const args = ["build-filter", projectDir];
  switch (scope) {
    case "all":
      args.push("--all");
      break;
    case "tag":
      if (!tag) {
        return toolError("tag is required when scope is tag");
      }
      args.push("--tag", tag);
      break;
    case "feature":
      if (!featurePath) {
        return toolError("featurePath is required when scope is feature");
      }
      args.push("--feature", featurePath);
      break;
    case "scenario":
      if (!featurePath || !scenarioName) {
        return toolError("featurePath and scenarioName are required when scope is scenario");
      }
      args.push("--feature", featurePath, "--scenario", scenarioName);
      break;
    default:
      return toolError("scope must be all, tag, feature, or scenario");
  }

  return mapCliResult(runPilotCli(args));
}

function handleFailureContext(params, workspaceRoot = getWorkspaceRoot()) {
  const { projectDir, maxOutputLines = 80 } = params;
  let { trxPath, logPath, useLastFailure } = params;

  if (!projectDir) {
    return toolError("projectDir is required");
  }

  const jailError = assertProjectDir(projectDir, workspaceRoot);
  if (jailError) {
    return jailError;
  }

  const implicitLastFailure = !trxPath && !logPath;
  if (implicitLastFailure || useLastFailure) {
    const lastFailure = readLastFailurePaths(projectDir);
    if (!lastFailure.ok) {
      return lastFailure;
    }
    trxPath = trxPath ?? lastFailure.trxPath;
    logPath = logPath ?? lastFailure.logPath;
  }

  if (!trxPath && !logPath) {
    return toolError("at least one of trxPath or logPath is required");
  }

  if (trxPath) {
    const trxError = assertArtifactFile(trxPath, workspaceRoot);
    if (trxError) {
      return trxError;
    }
  }
  if (logPath) {
    const logError = assertArtifactFile(logPath, workspaceRoot);
    if (logError) {
      return logError;
    }
  }

  const args = ["failure-context", "--project-dir", projectDir, "--max-output-lines", String(maxOutputLines)];
  if (trxPath) {
    args.push("--trx", trxPath);
  }
  if (logPath) {
    args.push("--log", logPath);
  }
  return mapCliResult(runPilotCli(args));
}

function toMcpToolResult(result) {
  if (!result.ok) {
    return {
      content: [{ type: "text", text: result.message }],
      isError: true,
    };
  }
  const text = JSON.stringify(result.structuredContent);
  return {
    content: [{ type: "text", text }],
    structuredContent: result.structuredContent,
  };
}

module.exports = {
  READ_ONLY_NOTICE,
  MAX_ARTIFACT_BYTES,
  getWorkspaceRoot,
  getCliPath,
  handleAnalyzeLog,
  handleDiscoverBdd,
  handleBuildFilter,
  handleFailureContext,
  toMcpToolResult,
  runPilotCli,
};
