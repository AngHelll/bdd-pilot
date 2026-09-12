import * as assert from "assert";
import { describe, it } from "node:test";
import {
  DISCOVER_LIST_TIMEOUT_MS,
  classifyDiscoverTime,
  formatDiscoverTimeLine,
  shouldProbeDiscoverList,
} from "../core/runner/discoverTime";
import { buildListTestsArgs } from "../core/runner/listTests";

describe("classifyDiscoverTime", () => {
  it("classifies listed=0 with Gherkin leaves as zero", () => {
    const result = classifyDiscoverTime({ listed: 0, gherkin: 3 });
    assert.deepStrictEqual(result, {
      kind: "zero",
      listed: 0,
      gherkin: 3,
      hint: "filter_or_target",
    });
  });

  it("classifies gherkin=0 as empty_scope (D2)", () => {
    const result = classifyDiscoverTime({ gherkin: 0 });
    assert.deepStrictEqual(result, {
      kind: "empty_scope",
      listed: undefined,
      gherkin: 0,
      hint: "empty_gherkin_scope",
    });
  });

  it("classifies 1 listed vs many Gherkin leaves", () => {
    const result = classifyDiscoverTime({ listed: 1, gherkin: 3 });
    assert.deepStrictEqual(result, {
      kind: "one_vs_many",
      listed: 1,
      gherkin: 3,
      hint: "review_filter_or_outline",
    });
  });

  it("classifies many listed vs 1 Gherkin leaf", () => {
    const result = classifyDiscoverTime({ listed: 2, gherkin: 1 });
    assert.deepStrictEqual(result, {
      kind: "many_vs_one",
      listed: 2,
      gherkin: 1,
      hint: "review_filter_or_outline",
    });
  });

  it("is aligned when counts match or both are missing", () => {
    assert.strictEqual(classifyDiscoverTime({ listed: 3, gherkin: 3 }).kind, "aligned");
    assert.strictEqual(classifyDiscoverTime({}).kind, "aligned");
  });

  it("is unknown when list-tests timed out or failed", () => {
    const result = classifyDiscoverTime({ gherkin: 3 });
    assert.strictEqual(result.kind, "unknown");
    assert.strictEqual(result.hint, undefined);
  });
});

describe("formatDiscoverTimeLine", () => {
  it("formats zero and 1-vs-N lines in English keys", () => {
    assert.strictEqual(
      formatDiscoverTimeLine(classifyDiscoverTime({ listed: 0, gherkin: 3 })),
      "Discover: listed=0 gherkin=3 · hint=filter_or_target",
    );
    assert.strictEqual(
      formatDiscoverTimeLine(classifyDiscoverTime({ listed: 1, gherkin: 3 })),
      "Discover: listed=1 gherkin=3 · hint=review_filter_or_outline",
    );
  });

  it("formats D2 empty scope with listed=-", () => {
    assert.strictEqual(
      formatDiscoverTimeLine(classifyDiscoverTime({ gherkin: 0 })),
      "Discover: listed=- gherkin=0 · hint=empty_gherkin_scope",
    );
  });

  it("is silent when aligned or unknown", () => {
    assert.strictEqual(formatDiscoverTimeLine(classifyDiscoverTime({ listed: 3, gherkin: 3 })), undefined);
    assert.strictEqual(formatDiscoverTimeLine(classifyDiscoverTime({ gherkin: 3 })), undefined);
  });
});

describe("shouldProbeDiscoverList", () => {
  const scoped = [{ kind: "feature" }];

  it("probes scoped runs with a built filter", () => {
    assert.strictEqual(
      shouldProbeDiscoverList({
        targets: scoped,
        filter: "FullyQualifiedName~AlphaFeature",
      }),
      true,
    );
  });

  it("skips Run All, empty filter, rawFilter, and debug", () => {
    assert.strictEqual(
      shouldProbeDiscoverList({
        targets: [{ kind: "all" }],
        filter: "FullyQualifiedName~AlphaFeature",
      }),
      false,
    );
    assert.strictEqual(shouldProbeDiscoverList({ targets: scoped, filter: "" }), false);
    assert.strictEqual(
      shouldProbeDiscoverList({
        targets: scoped,
        filter: "FullyQualifiedName~AlphaFeature",
        rawFilter: true,
      }),
      false,
    );
    assert.strictEqual(
      shouldProbeDiscoverList({
        targets: scoped,
        filter: "FullyQualifiedName~AlphaFeature",
        debug: true,
      }),
      false,
    );
  });
});

describe("buildListTestsArgs", () => {
  const base = { dotnetPath: "dotnet", projectDir: "/tmp" };

  it("adds the same --filter as the upcoming run", () => {
    const args = buildListTestsArgs({
      ...base,
      testTarget: "Alpha.Tests.csproj",
      filter: "FullyQualifiedName~AlphaFeature",
    });
    assert.deepStrictEqual(args, [
      "test",
      "Alpha.Tests.csproj",
      "--list-tests",
      "--nologo",
      "--filter",
      "FullyQualifiedName~AlphaFeature",
    ]);
  });

  it("omits --filter when empty (Theory enrich stays unfiltered)", () => {
    const args = buildListTestsArgs({ ...base, filter: "  " });
    assert.deepStrictEqual(args, ["test", "--list-tests", "--nologo"]);
    assert.ok(!args.includes("--filter"));
  });
});

describe("DISCOVER_LIST_TIMEOUT_MS", () => {
  it("budgets list-tests at 15s", () => {
    assert.strictEqual(DISCOVER_LIST_TIMEOUT_MS, 15_000);
  });
});
