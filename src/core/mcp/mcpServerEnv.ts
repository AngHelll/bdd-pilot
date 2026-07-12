import * as path from "path";

export const MCP_PROVIDER_ID = "bdd-pilot";

export function buildMcpServerEnv(
  extensionPath: string,
  workspaceRoot: string,
): Record<string, string> {
  return {
    BDD_PILOT_WORKSPACE_ROOT: workspaceRoot,
    BDD_PILOT_OUT_TEST: path.join(extensionPath, "dist/headless"),
    BDD_PILOT_EXTENSION_PATH: extensionPath,
  };
}

export function getMcpBundleRelativePath(): string {
  return path.join("dist", "pilot-mcp.cjs");
}
