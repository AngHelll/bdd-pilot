import * as path from "path";
import * as vscode from "vscode";
import {
  buildMcpServerEnv,
  getMcpBundleRelativePath,
  MCP_PROVIDER_ID,
} from "../core/mcp/mcpServerEnv";

export { MCP_PROVIDER_ID, buildMcpServerEnv };

type McpStdioCtor = new (
  label: string,
  command: string,
  args: string[],
  env?: Record<string, string | undefined>,
  version?: string,
) => vscode.McpServerDefinition;

function getMcpStdioCtor(): McpStdioCtor | undefined {
  return (vscode as unknown as { McpStdioServerDefinition?: McpStdioCtor }).McpStdioServerDefinition;
}

function pickWorkspaceFolder(
  server: vscode.McpServerDefinition,
  folders: readonly vscode.WorkspaceFolder[],
): vscode.WorkspaceFolder | undefined {
  if (folders.length === 0) {
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  const match = folders.find((folder) => server.label === `BDD Pilot (${folder.name})`);
  return match ?? folders[0];
}

export function registerMcpServerProvider(context: vscode.ExtensionContext): void {
  const lm = vscode.lm as typeof vscode.lm & {
    registerMcpServerDefinitionProvider?: (
      id: string,
      provider: vscode.McpServerDefinitionProvider,
    ) => vscode.Disposable;
  };
  if (typeof lm?.registerMcpServerDefinitionProvider !== "function") {
    return;
  }

  const McpStdio = getMcpStdioCtor();
  if (!McpStdio) {
    return;
  }

  const didChange = new vscode.EventEmitter<void>();
  const bundlePath = path.join(context.extensionPath, getMcpBundleRelativePath());
  const version = context.extension.packageJSON.version as string;

  const provider: vscode.McpServerDefinitionProvider = {
    onDidChangeMcpServerDefinitions: didChange.event,
    provideMcpServerDefinitions() {
      const folders = vscode.workspace.workspaceFolders ?? [];
      return folders.map((folder) => {
        const label = folders.length > 1 ? `BDD Pilot (${folder.name})` : "BDD Pilot";
        return new McpStdio(label, process.execPath, [bundlePath], {}, version);
      });
    },
    resolveMcpServerDefinition(server) {
      const folder = pickWorkspaceFolder(server, vscode.workspace.workspaceFolders ?? []);
      if (!folder) {
        return undefined;
      }
      const env = buildMcpServerEnv(context.extensionPath, folder.uri.fsPath);
      if ("command" in server && "args" in server) {
        return new McpStdio(server.label, server.command, server.args, env, version);
      }
      return server;
    },
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => didChange.fire()),
    lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, provider),
  );
}
