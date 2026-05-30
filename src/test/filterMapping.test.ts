import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildOutlineRowFilter,
  escapeVstestFilterValue,
  toReqnrollParamName,
} from "../core/runner/filterMapping";

describe("filterMapping", () => {
  it("maps snake_case headers to Reqnroll param names", () => {
    assert.strictEqual(toReqnrollParamName("parameter"), "parameter");
    assert.strictEqual(toReqnrollParamName("expected_message"), "expected_Message");
  });

  it("builds DisplayName filter for outline rows", () => {
    const filter = buildOutlineRowFilter({
      rowIndex: 0,
      line: 38,
      headers: ["parameter", "value", "expected_message"],
      values: ["contract_id", "invalid-guid", "Guid contractId"],
      label: "parameter=contract_id, value=invalid-guid",
    });
    assert.strictEqual(
      filter,
      'DisplayName~parameter: %22contract_id%22, value: %22invalid-guid%22, expected_Message: %22Guid contractId%22',
    );
  });

  it("escapes filter-breaking characters in values", () => {
    assert.strictEqual(escapeVstestFilterValue("a|b"), "a%7Cb");
  });
});
