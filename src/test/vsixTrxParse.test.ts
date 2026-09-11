import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { buildFailureSnapshotFromArtifacts } from "../core/diagnostics/failureSnapshotFromArtifacts";
import { parseTrx } from "../core/results/trxParser";

const requireFromTest = createRequire(__filename);
const ROOT = path.join(__dirname, "../..");
const FIXTURE = path.join(ROOT, "src/test/fixtures/trx/minimal-failed.trx");
const { bundleHeadlessTrxParser } = requireFromTest("../../scripts/bundle-headless-trx.js");

describe("minimal-failed TRX fixture", () => {
  it("parses at least one failed UnitTestResult", () => {
    const summary = parseTrx(fs.readFileSync(FIXTURE, "utf8"));
    assert.ok(summary.failed >= 1);
    const failed = summary.results.find((row) => row.outcome === "failed");
    assert.ok(failed?.errorMessage);
  });

  it("builds a failure snapshot from the fixture", () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-fixture-proj-"));
    const trxPath = path.join(projectDir, "minimal-failed.trx");
    fs.copyFileSync(FIXTURE, trxPath);
    const snapshot = buildFailureSnapshotFromArtifacts({ projectDir, trxPath });
    assert.ok(snapshot.summary.failed >= 1);
  });
});

describe("headless trxParser bundle", () => {
  it("inlines fast-xml-parser and parses the fixture without that package on NODE_PATH", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-trx-bundle-"));
    const outfile = path.join(dir, "trxParser.js");
    await bundleHeadlessTrxParser(outfile);
    const source = fs.readFileSync(outfile, "utf8");
    assert.ok(!/require\(['"]fast-xml-parser['"]\)/.test(source));

    const bundled = requireFromTest(outfile) as { parseTrx: (xml: string) => { failed: number } };
    const summary = bundled.parseTrx(fs.readFileSync(FIXTURE, "utf8"));
    assert.ok(summary.failed >= 1);
  });
});
