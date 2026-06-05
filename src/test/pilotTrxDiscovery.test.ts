import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import {
  findPilotTrxCandidates,
  isPilotTrxFileName,
  selectLatestPilotTrx,
} from "../core/results/pilotTrxDiscovery";

describe("pilotTrxDiscovery", () => {
  it("isPilotTrxFileName accepts Pilot run and debug TRX names", () => {
    assert.strictEqual(isPilotTrxFileName("bdd-pilot-1710000000000.trx"), true);
    assert.strictEqual(isPilotTrxFileName("bdd-pilot-debug-1710000000000.trx"), true);
    assert.strictEqual(isPilotTrxFileName("results.trx"), false);
    assert.strictEqual(isPilotTrxFileName("bdd-pilot-evil.trx"), false);
  });

  it("findPilotTrxCandidates lists only Pilot TRX files sorted by mtime", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-trx-"));
    const resultsDir = path.join(root, "TestResults");
    fs.mkdirSync(resultsDir);
    fs.writeFileSync(path.join(resultsDir, "other.trx"), "<trx/>");
    const older = path.join(resultsDir, "bdd-pilot-1000.trx");
    const newer = path.join(resultsDir, "bdd-pilot-debug-2000.trx");
    fs.writeFileSync(older, "<trx/>");
    fs.writeFileSync(newer, "<trx/>");
    const olderTime = Date.now() - 60_000;
    const newerTime = Date.now() - 1_000;
    fs.utimesSync(older, olderTime / 1000, olderTime / 1000);
    fs.utimesSync(newer, newerTime / 1000, newerTime / 1000);

    const candidates = findPilotTrxCandidates(root);
    assert.strictEqual(candidates.length, 2);
    const latest = selectLatestPilotTrx(candidates);
    assert.strictEqual(latest?.fileName, "bdd-pilot-debug-2000.trx");
  });

  it("selectLatestPilotTrx returns undefined when all candidates exceed maxAgeMs", () => {
    const candidates = [
      {
        absolutePath: "/tmp/bdd-pilot-1.trx",
        fileName: "bdd-pilot-1.trx",
        mtimeMs: Date.now() - 10 * 3_600_000,
      },
    ];
    assert.strictEqual(selectLatestPilotTrx(candidates, { maxAgeMs: 3_600_000 }), undefined);
  });

  it("selectLatestPilotTrx allows any age when maxAgeMs is undefined", () => {
    const candidates = [
      {
        absolutePath: "/tmp/bdd-pilot-1.trx",
        fileName: "bdd-pilot-1.trx",
        mtimeMs: Date.now() - 10 * 3_600_000,
      },
    ];
    assert.strictEqual(selectLatestPilotTrx(candidates)?.fileName, "bdd-pilot-1.trx");
  });
});
