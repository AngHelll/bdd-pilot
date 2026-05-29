import * as assert from "assert";
import { describe, it } from "node:test";
import { parseEnvFile } from "../core/config/envFile";
import { buildEnv } from "../core/runner/dotnetTest";

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

describe("buildEnv with extraEnv", () => {
  it("merges extra env but STAGE always wins", () => {
    const env = buildEnv({ PATH: "/bin" }, "test", { CLIENT_ID: "abc", STAGE: "prod" });
    assert.strictEqual(env.CLIENT_ID, "abc");
    assert.strictEqual(env.STAGE, "test");
    assert.strictEqual(env.PATH, "/bin");
  });
});
