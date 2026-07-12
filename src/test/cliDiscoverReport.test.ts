import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import {
  buildCliDiscoverReport,
  DISCOVER_ENRICH_TIMEOUT_MS,
} from "../core/gherkin/cliDiscoverReport";

const ROOT = path.join(__dirname, "../..");
const SAMPLE = path.join(ROOT, "samples/minimal-bdd");

describe("cliDiscoverReport", () => {
  it("builds base discover report without enrich flag", async () => {
    const report = await buildCliDiscoverReport(SAMPLE);
    assert.strictEqual(report.enriched, undefined);
    assert.strictEqual(report.listTestsWarnings, undefined);
    assert.ok(report.featureCount >= 1);
    assert.ok(report.tags.some((entry) => entry.tag === "smoke"));
    const scenario = report.domains.flatMap((d) => d.features).flatMap((f) => f.scenarios)[0];
    assert.strictEqual(scenario.examples, undefined);
  });

  it("enriches report when list-tests returns theory names", async () => {
    const report = await buildCliDiscoverReport(SAMPLE, {
      enrich: true,
      listTests: async () => [
        "Add two numbers(first: \"1\", second: \"2\", result: \"3\")",
        "Add two numbers(first: \"5\", second: \"7\", result: \"12\")",
      ],
    });
    assert.strictEqual(report.enriched, true);
    assert.strictEqual(report.executableTestCount, 2);
    const outline = report.domains
      .flatMap((d) => d.features)
      .flatMap((f) => f.scenarios)
      .find((s) => s.name === "Add two numbers");
    assert.ok(outline);
    assert.ok(outline.examples && outline.examples.length >= 2);
  });

  it("returns partial report with warnings when list-tests fails", async () => {
    const report = await buildCliDiscoverReport(SAMPLE, {
      enrich: true,
      listTests: async () => {
        throw new Error("dotnet test --list-tests exited 1");
      },
    });
    assert.strictEqual(report.enriched, undefined);
    assert.ok(report.listTestsWarnings?.length === 1);
    assert.match(report.listTestsWarnings![0], /exited 1/);
  });

  it("sanitizes secrets in list-tests warnings", async () => {
    const report = await buildCliDiscoverReport(SAMPLE, {
      enrich: true,
      listTests: async () => {
        throw new Error("password=super-secret failed");
      },
    });
    assert.ok(report.listTestsWarnings);
    assert.ok(!report.listTestsWarnings![0].includes("super-secret"));
    assert.ok(report.listTestsWarnings![0].includes("***REDACTED***"));
  });

  it("uses configured enrich timeout constant", () => {
    assert.strictEqual(DISCOVER_ENRICH_TIMEOUT_MS, 90_000);
  });

  it("warns on list-tests timeout", async () => {
    const report = await buildCliDiscoverReport(SAMPLE, {
      enrich: true,
      timeoutMs: 5,
      listTests: async (_req, signal) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(["late"]), 50);
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new Error("list-tests canceled"));
            },
            { once: true },
          );
        }),
    });
    assert.ok(report.listTestsWarnings?.some((w) => w.includes("timed out")));
  });
});

describe("cliDiscoverReport temp project", () => {
  it("discovers empty project dir with zero features", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-discover-"));
    try {
      const report = await buildCliDiscoverReport(root);
      assert.strictEqual(report.featureCount, 0);
      assert.strictEqual(report.scenarioCount, 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
