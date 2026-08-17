import * as assert from "assert";
import { describe, it } from "node:test";
import { buildArgs } from "../core/runner/dotnetTest";
import {
  formatEffectiveDotnetCommand,
  quoteArgForCommandLine,
} from "../core/runner/effectiveDotnetCommand";
import { MODE_PROFILES } from "../core/config/types";

describe("effectiveDotnetCommand", () => {
  it("quoteArgForCommandLine leaves simple tokens alone", () => {
    assert.strictEqual(quoteArgForCommandLine("dotnet"), "dotnet");
    assert.strictEqual(quoteArgForCommandLine("--filter"), "--filter");
    assert.strictEqual(quoteArgForCommandLine("Category=smoke"), "Category=smoke");
  });

  it("quoteArgForCommandLine wraps paths with spaces", () => {
    assert.strictEqual(
      quoteArgForCommandLine("/Users/me/My Project/tests.csproj"),
      '"/Users/me/My Project/tests.csproj"',
    );
  });

  it("formatEffectiveDotnetCommand joins path and args", () => {
    const line = formatEffectiveDotnetCommand({
      dotnetPath: "dotnet",
      args: ["test", "/proj/Bdd.csproj", "--filter", "Category=smoke"],
    });
    assert.strictEqual(line, "dotnet test /proj/Bdd.csproj --filter Category=smoke");
  });

  it("formatEffectiveDotnetCommand includes P2 flags from buildArgs", () => {
    const args = buildArgs({
      dotnetPath: "dotnet",
      projectDir: "/proj",
      testTarget: "/proj/Bdd.csproj",
      stage: "test",
      mode: MODE_PROFILES.parallel,
      resultsDir: "TestResults",
      trxFileName: "run.trx",
      filter: "Category=smoke",
      cliVerbosity: "minimal",
      blame: true,
      blameHang: true,
      blameHangTimeout: "5m",
    });
    const line = formatEffectiveDotnetCommand({ dotnetPath: "dotnet", args });
    assert.match(line, /^dotnet test /);
    assert.ok(line.includes("/proj/Bdd.csproj"));
    assert.ok(line.includes("--verbosity"));
    assert.ok(line.includes("minimal"));
    assert.ok(line.includes("--blame"));
    assert.ok(line.includes("--blame-hang"));
    assert.ok(line.includes("5m"));
    assert.ok(line.includes("--filter"));
    assert.ok(line.includes("Category=smoke"));
  });

  it("formatEffectiveDotnetCommand quotes spaced target path", () => {
    const line = formatEffectiveDotnetCommand({
      dotnetPath: "dotnet",
      args: ["test", "/proj/My Tests/Bdd.csproj"],
    });
    assert.strictEqual(line, 'dotnet test "/proj/My Tests/Bdd.csproj"');
  });
});
