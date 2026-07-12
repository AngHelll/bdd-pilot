import * as assert from "assert";
import * as path from "path";
import { describe, it } from "node:test";
import {
  buildMcpServerEnv,
  getMcpBundleRelativePath,
  MCP_PROVIDER_ID,
} from "../core/mcp/mcpServerEnv";

describe("mcpServerEnv", () => {
  it("builds packaged MCP env paths", () => {
    const env = buildMcpServerEnv("/ext/bdd-pilot", "/ws/minimal-bdd");
    assert.strictEqual(env.BDD_PILOT_WORKSPACE_ROOT, "/ws/minimal-bdd");
    assert.strictEqual(env.BDD_PILOT_EXTENSION_PATH, "/ext/bdd-pilot");
    assert.strictEqual(env.BDD_PILOT_OUT_TEST, path.join("/ext/bdd-pilot", "dist/headless"));
  });

  it("uses stable provider id and bundle path", () => {
    assert.strictEqual(MCP_PROVIDER_ID, "bdd-pilot");
    assert.strictEqual(getMcpBundleRelativePath(), path.join("dist", "pilot-mcp.cjs"));
  });
});
