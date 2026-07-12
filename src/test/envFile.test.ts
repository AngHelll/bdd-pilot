import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import { loadStageEnv, parseEnvFile, resolveStageEnvFileStatus } from "../core/config/envFile";
import { buildEnv } from "../core/runner/dotnetTest";

function writeEnvTree(
  root: string,
  files: Record<string, string>,
): { projectDir: string; configDir: string } {
  const projectDir = path.join(root, "App.Tests");
  const configDir = path.join(root, "config");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(configDir, name), content, "utf8");
  }
  return { projectDir, configDir };
}

describe("parseEnvFile", () => {
  it("parses KEY=value and export KEY=value", () => {
    const vars = parseEnvFile(["export A=1", "B=two", "# comment", "", "C = three"].join("\n"));
    assert.strictEqual(vars.A, "1");
    assert.strictEqual(vars.B, "two");
    assert.strictEqual(vars.C, "three");
  });

  it("strips surrounding quotes and inline comments", () => {
    const vars = parseEnvFile(['A="quoted value"', "B='single'", "C=bare # trailing"].join("\n"));
    assert.strictEqual(vars.A, "quoted value");
    assert.strictEqual(vars.B, "single");
    assert.strictEqual(vars.C, "bare");
  });

  it("ignores malformed lines", () => {
    const vars = parseEnvFile(["NOEQUALS", "=novalue", "OK=1"].join("\n"));
    assert.deepStrictEqual(Object.keys(vars), ["OK"]);
  });
});

describe("loadStageEnv", () => {
  it("loads stage, stage.local, and global local in order with later overrides", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-env-"));
    const { projectDir } = writeEnvTree(root, {
      ".env.test": "API_BASE_URL=https://shared\nSHARED=1",
      ".env.test.local": "API_BASE_URL=https://override-local",
      ".env.local": "HEADLESS_MODE=true\nSHARED=2",
    });

    const loaded = loadStageEnv(projectDir, "test");
    assert.deepStrictEqual(loaded.loadedFiles.map((f) => path.basename(f)), [
      ".env.test",
      ".env.test.local",
      ".env.local",
    ]);
    assert.strictEqual(loaded.vars.API_BASE_URL, "https://override-local");
    assert.strictEqual(loaded.vars.HEADLESS_MODE, "true");
    assert.strictEqual(loaded.vars.SHARED, "2");
  });

  it("skips missing files without error", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-env-"));
    const { projectDir } = writeEnvTree(root, {
      ".env.stg": "STAGE_MARKER=stg",
    });

    const loaded = loadStageEnv(projectDir, "stg");
    assert.deepStrictEqual(loaded.loadedFiles.map((f) => path.basename(f)), [".env.stg"]);
    assert.strictEqual(loaded.vars.STAGE_MARKER, "stg");
  });
});

describe("resolveStageEnvFileStatus", () => {
  it("returns basenames in load order without reading values", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-env-status-"));
    const { projectDir } = writeEnvTree(root, {
      ".env.test": "SECRET=do-not-read",
      ".env.test.local": "OTHER=1",
    });

    const status = resolveStageEnvFileStatus(projectDir, "test");
    assert.deepStrictEqual(status.existingBasenames, [".env.test", ".env.test.local"]);
  });

  it("returns empty list when config dir is missing", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-env-status-"));
    const projectDir = path.join(root, "App.Tests");
    fs.mkdirSync(projectDir, { recursive: true });

    const status = resolveStageEnvFileStatus(projectDir, "test");
    assert.deepStrictEqual(status.existingBasenames, []);
  });
});

describe("buildEnv with extraEnv", () => {
  it("merges extra env but STAGE always wins", () => {
    const env = buildEnv({ PATH: "/bin" }, "test", { CLIENT_ID: "abc", STAGE: "prod" });
    assert.strictEqual(env.CLIENT_ID, "abc");
    assert.strictEqual(env.STAGE, "test");
    assert.strictEqual(env.PATH, "/bin");
  });
});
