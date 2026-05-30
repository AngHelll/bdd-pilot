import * as assert from "assert";
import { describe, it } from "node:test";
import { estimateTestCount } from "../core/runner/runEstimate";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("runEstimate", () => {
  it("counts scenarios and outline rows", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-est-"));
    const featureDir = path.join(dir, "Features", "Sample");
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(
      path.join(featureDir, "Sample.feature"),
      [
        "Feature: Sample",
        "  Scenario: One",
        "    Then ok",
        "  Scenario Outline: Many",
        "    Then <x>",
        "    Examples:",
        "      | x |",
        "      | a |",
        "      | b |",
      ].join("\n"),
    );

    const csproj = path.join(dir, "Sample.csproj");
    fs.writeFileSync(csproj, "<Project Sdk='Microsoft.NET.Sdk'></Project>");

    const total = estimateTestCount([{ kind: "all" }], dir);
    assert.strictEqual(total, 3);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
