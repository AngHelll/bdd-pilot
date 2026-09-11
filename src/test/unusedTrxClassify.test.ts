import * as assert from "assert";
import { describe, it } from "node:test";
import {
  allocateUnusedSplitCaps,
  classifyUnusedTrxName,
  partitionUnusedTrx,
} from "../core/results/unusedTrxClassify";

describe("unusedTrxClassify", () => {
  describe("classifyUnusedTrxName", () => {
    it("marks Theory display names as gherkin_like", () => {
      assert.strictEqual(
        classifyUnusedTrxName('Validate tax benefits(income: "100", status: "ok")'),
        "gherkin_like",
      );
      assert.strictEqual(
        classifyUnusedTrxName(
          'Acme.Tests.AlphaFeature.Validate tax benefits(income: "100", status: "ok")',
        ),
        "gherkin_like",
      );
    });

    it("marks Feature. FQN segments as gherkin_like", () => {
      assert.strictEqual(
        classifyUnusedTrxName("Acme.Tests.AlphaFeature.Login"),
        "gherkin_like",
      );
      assert.strictEqual(
        classifyUnusedTrxName("Namespace.BetaFeature.Some scenario title"),
        "gherkin_like",
      );
    });

    it("marks helper / unit method names as other", () => {
      assert.strictEqual(classifyUnusedTrxName("HasProfilingPayload"), "other");
      assert.strictEqual(classifyUnusedTrxName("BuildQuestionnairePlan"), "other");
      assert.strictEqual(classifyUnusedTrxName("Acme.Helpers.IsInconclusiveStatus"), "other");
      assert.strictEqual(classifyUnusedTrxName(""), "other");
      assert.strictEqual(classifyUnusedTrxName("   "), "other");
    });
  });

  describe("partitionUnusedTrx", () => {
    it("splits rows by class", () => {
      const { gherkinLike, other } = partitionUnusedTrx([
        { testName: "Acme.AlphaFeature.Login", outcome: "passed" },
        { testName: "HasProfilingPayload", outcome: "passed" },
        {
          testName: 'Title(param: "1")',
          outcome: "failed",
        },
      ]);
      assert.strictEqual(gherkinLike.length, 2);
      assert.strictEqual(other.length, 1);
      assert.strictEqual(other[0]!.testName, "HasProfilingPayload");
    });
  });

  describe("allocateUnusedSplitCaps", () => {
    it("gives full cap to a single non-empty bucket", () => {
      assert.deepStrictEqual(allocateUnusedSplitCaps(0, 30, 25), {
        gherkinCap: 0,
        otherCap: 25,
      });
      assert.deepStrictEqual(allocateUnusedSplitCaps(30, 0, 25), {
        gherkinCap: 25,
        otherCap: 0,
      });
    });

    it("reserves one each then fills other first", () => {
      assert.deepStrictEqual(allocateUnusedSplitCaps(10, 10, 25), {
        gherkinCap: 10,
        otherCap: 10,
      });
      assert.deepStrictEqual(allocateUnusedSplitCaps(5, 20, 10), {
        gherkinCap: 1,
        otherCap: 9,
      });
    });
  });
});
