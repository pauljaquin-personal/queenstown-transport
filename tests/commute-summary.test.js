import test from "node:test";
import assert from "node:assert/strict";
import { summariseModeRows, suppressSmallGroups } from "../worker/summary.js";

test("suppresses aggregate groups smaller than five", () => {
  const result = suppressSmallGroups([
    { key: "weekday-am", count: 8 },
    { key: "weekend", count: 4 },
  ]);
  assert.deepEqual(result, [{ key: "weekday-am", count: 8 }]);
});

test("mode totals combine multi-mode submissions and suppress small totals", () => {
  const result = summariseModeRows([
    { modes: '["bike","bus"]', count: 3 },
    { modes: '["bike"]', count: 4 },
    { modes: '["car"]', count: 2 },
  ]);
  assert.deepEqual(result, [{ mode: "bike", count: 7 }]);
});
