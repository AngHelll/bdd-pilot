#!/usr/bin/env node
// MCP stdio server — thin wrapper over pilot-cli (read-only tools).
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const z = require("zod/v4");
const pkg = require("../package.json");
const {
  READ_ONLY_NOTICE,
  handleAnalyzeLog,
  handleDiscoverBdd,
  handleBuildFilter,
  handleFailureContext,
  toMcpToolResult,
  getWorkspaceRoot,
} = require("./pilot-mcp-lib");

const server = new McpServer({
  name: "bdd-pilot",
  version: pkg.version,
});

const pathHint = "Absolute or workspace-relative path.";

server.registerTool(
  "pilot_analyze_log",
  {
    description: `Analyze a dotnet/Reqnroll test log for BDD Pilot diagnostics. ${READ_ONLY_NOTICE}`,
    inputSchema: {
      logPath: z.string().describe(`Path to log file. ${pathHint}`),
    },
  },
  async ({ logPath }) => toMcpToolResult(handleAnalyzeLog({ logPath }, getWorkspaceRoot())),
);

server.registerTool(
  "pilot_discover_bdd",
  {
    description: `Discover BDD features, scenarios, and tags under a project directory. ${READ_ONLY_NOTICE}`,
    inputSchema: {
      projectDir: z.string().describe(`BDD project root directory. ${pathHint}`),
    },
  },
  async ({ projectDir }) => toMcpToolResult(handleDiscoverBdd({ projectDir }, getWorkspaceRoot())),
);

server.registerTool(
  "pilot_build_filter",
  {
    description: `Build a Reqnroll/xUnit dotnet test --filter for a tag, feature, scenario, or all tests. ${READ_ONLY_NOTICE}`,
    inputSchema: {
      projectDir: z.string().describe(`BDD project root directory. ${pathHint}`),
      scope: z.enum(["all", "tag", "feature", "scenario"]).describe("Run scope kind"),
      tag: z.string().optional().describe("Tag name when scope=tag (@ optional)"),
      featurePath: z
        .string()
        .optional()
        .describe("Relative .feature path when scope=feature or scenario"),
      scenarioName: z.string().optional().describe("Scenario name when scope=scenario"),
    },
  },
  async (params) => toMcpToolResult(handleBuildFilter(params, getWorkspaceRoot())),
);

server.registerTool(
  "pilot_failure_context",
  {
    description: `Build sanitized markdown failure context from TRX and/or log artifacts (Copy for AI parity). Omit trxPath/logPath to use the last failed run artifact written by the extension. ${READ_ONLY_NOTICE}`,
    inputSchema: {
      projectDir: z.string().describe(`BDD project root directory. ${pathHint}`),
      trxPath: z.string().optional().describe(`TRX file path. ${pathHint}`),
      logPath: z.string().optional().describe(`Log file path. ${pathHint}`),
      useLastFailure: z
        .boolean()
        .optional()
        .describe("When true (or when trxPath/logPath omitted), read TestResults/bdd-pilot-last-failure.json"),
      maxOutputLines: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Max tail lines in markdown output (default 80)"),
    },
  },
  async (params) => toMcpToolResult(handleFailureContext(params, getWorkspaceRoot())),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`pilot-mcp-server error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}

module.exports = { server, main };
