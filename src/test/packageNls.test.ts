import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(__dirname, "../..");
const CONFIGURATION_NLS_PREFIX = "bddPilot.configuration.";

function loadJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function collectNlsReferences(value: unknown, refs: Set<string>): void {
  if (typeof value === "string") {
    const matches = value.matchAll(/%(bddPilot\.configuration\.[^%]+)%/g);
    for (const match of matches) {
      refs.add(match[1]);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectNlsReferences(item, refs);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectNlsReferences(nested, refs);
    }
  }
}

function configurationNlsKeys(nls: Record<string, string>): Set<string> {
  return new Set(
    Object.keys(nls).filter((key) => key.startsWith(CONFIGURATION_NLS_PREFIX)),
  );
}

describe("packageNls", () => {
  it("configuration nls keys match between EN and ES", () => {
    const en = loadJson<Record<string, string>>("package.nls.json");
    const es = loadJson<Record<string, string>>("package.nls.es.json");
    const enKeys = configurationNlsKeys(en);
    const esKeys = configurationNlsKeys(es);
    assert.deepStrictEqual([...esKeys].sort(), [...enKeys].sort());
  });

  it("package.json configuration references resolve in EN and ES nls", () => {
    const pkg = loadJson<{ contributes?: { configuration?: { properties?: unknown } } }>("package.json");
    const en = loadJson<Record<string, string>>("package.nls.json");
    const es = loadJson<Record<string, string>>("package.nls.es.json");
    const refs = new Set<string>();
    collectNlsReferences(pkg.contributes?.configuration?.properties, refs);

    for (const key of refs) {
      assert.ok(en[key], `missing EN nls key: ${key}`);
      assert.ok(es[key], `missing ES nls key: ${key}`);
    }
  });
});
