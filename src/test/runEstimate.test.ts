import * as assert from "assert";
import { describe, it } from "node:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { DomainGroup, OutlineExample, ScenarioInfo } from "../core/gherkin/model";
import {
  ACTIVATE_ENRICH_IDLE_MS,
  FEATURE_ENRICH_DEBOUNCE_MS,
  activateEnrichDelayMs,
} from "../core/runner/activateEnrich";
import { estimateTestCount } from "../core/runner/runEstimate";

describe("activateEnrich", () => {
  it("schedules idle delay only when Theory discovery is needed", () => {
    assert.strictEqual(activateEnrichDelayMs(false), undefined);
    assert.strictEqual(activateEnrichDelayMs(true), ACTIVATE_ENRICH_IDLE_MS);
    assert.ok(ACTIVATE_ENRICH_IDLE_MS >= 500 && ACTIVATE_ENRICH_IDLE_MS <= 1500);
    assert.strictEqual(FEATURE_ENRICH_DEBOUNCE_MS, 2000);
  });
});

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

  it("reuses provided domains without walking the filesystem", () => {
    const domains: DomainGroup[] = [
      {
        name: "Sample",
        features: [
          {
            name: "Alpha",
            filePath: "/tmp/Alpha.feature",
            tags: [],
            scenarios: [
              { name: "One", line: 2, tags: [], isOutline: false },
              {
                name: "Many",
                line: 4,
                tags: [],
                isOutline: true,
                examples: [
                  { rowIndex: 0, line: 8, headers: ["x"], values: ["a"], label: "x=a" },
                  { rowIndex: 1, line: 9, headers: ["x"], values: ["b"], label: "x=b" },
                ],
              },
            ],
          },
        ],
      },
    ];

    const missingDir = path.join(os.tmpdir(), "bdd-pilot-est-missing-no-such-dir");
    const total = estimateTestCount([{ kind: "all" }], missingDir, domains);
    assert.strictEqual(total, 3);

    const tagTotal = estimateTestCount([{ kind: "tag", tag: "smoke" }], missingDir, [
      {
        name: "Sample",
        features: [
          {
            name: "Tagged",
            filePath: "/tmp/Tagged.feature",
            tags: [],
            scenarios: [{ name: "Smoke", line: 2, tags: ["smoke"], isOutline: false }],
          },
        ],
      },
    ]);
    assert.strictEqual(tagTotal, 1);
  });

  it("counts a feature header stub the same as the discovered feature", () => {
    const rows: OutlineExample[] = [
      { rowIndex: 0, line: 8, headers: ["x"], values: ["a"], label: "x=a" },
      { rowIndex: 1, line: 9, headers: ["x"], values: ["b"], label: "x=b" },
    ];
    const outline: ScenarioInfo = {
      name: "Many",
      line: 4,
      tags: [],
      isOutline: true,
      examples: rows,
    };
    const feature = {
      name: "Alpha",
      filePath: "/tmp/Alpha.feature",
      tags: ["smoke"],
      scenarios: [
        { name: "One", line: 2, tags: [], isOutline: false },
        outline,
      ],
    };
    const domains: DomainGroup[] = [{ name: "Sample", features: [feature] }];
    const missingDir = path.join(os.tmpdir(), "bdd-pilot-est-header-stub");
    const header = estimateTestCount(
      [{ kind: "feature", feature: { ...feature, scenarios: [] } }],
      missingDir,
      domains,
    );
    const fromTree = estimateTestCount([{ kind: "feature", feature }], missingDir, domains);
    assert.strictEqual(header, 3);
    assert.strictEqual(header, fromTree);
  });

  it("counts every outline row when the scenario stub omits examples", () => {
    const outline: ScenarioInfo = {
      name: "Many",
      line: 4,
      tags: [],
      isOutline: true,
      examples: [
        { rowIndex: 0, line: 8, headers: ["x"], values: ["a"], label: "x=a" },
        { rowIndex: 1, line: 9, headers: ["x"], values: ["b"], label: "x=b" },
      ],
    };
    const feature = {
      name: "Alpha",
      filePath: "/tmp/Alpha.feature",
      tags: [],
      scenarios: [outline],
    };
    const domains: DomainGroup[] = [{ name: "Sample", features: [feature] }];
    const total = estimateTestCount(
      [
        {
          kind: "scenario",
          feature: { ...feature, scenarios: [] },
          scenario: { ...outline, examples: undefined },
        },
      ],
      path.join(os.tmpdir(), "bdd-pilot-est-outline-stub"),
      domains,
    );
    assert.strictEqual(total, 2);
  });

  it("counts a discovered feature with no scenarios as zero", () => {
    const feature = {
      name: "Empty",
      filePath: "/tmp/Empty.feature",
      tags: [],
      scenarios: [],
    };
    const total = estimateTestCount(
      [{ kind: "feature", feature }],
      path.join(os.tmpdir(), "bdd-pilot-est-empty-feature"),
      [{ name: "Sample", features: [feature] }],
    );
    assert.strictEqual(total, 0);
  });
});
