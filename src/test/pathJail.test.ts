import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import { assertPathUnderRoot, isPathUnderRoot, PathJailError } from "../security/pathJail";

describe("pathJail", () => {
  it("accepts paths under the workspace root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-jail-"));
    const nested = path.join(root, "samples", "minimal-bdd");
    fs.mkdirSync(nested, { recursive: true });
    assert.strictEqual(isPathUnderRoot(nested, root), true);
    assert.doesNotThrow(() => assertPathUnderRoot(nested, root));
  });

  it("rejects paths outside the workspace root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-jail-"));
    const outside = os.tmpdir();
    assert.throws(() => assertPathUnderRoot(outside, root), PathJailError);
  });

  it("rejects resolved symlink escape", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-jail-root-"));
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-jail-out-"));
    const outsideFile = path.join(outsideDir, "secret.txt");
    fs.writeFileSync(outsideFile, "outside", "utf8");
    const linkPath = path.join(root, "escape-link");
    try {
      fs.symlinkSync(outsideFile, linkPath);
      assert.throws(() => assertPathUnderRoot(linkPath, root), PathJailError);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
