import test from "node:test";
import assert from "node:assert/strict";
import { validateCommute } from "../worker/commutes.js";

test("accepts a coarse anonymous commute", () => {
  const result = validateCommute({ origin:"fernhill", destination:"frankton", modes:["bike","bus"], timeBand:"weekday-am", changeReason:"safer-cycle-route" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.modes, ["bike","bus"]);
});
test("rejects identical origin and destination", () => {
  assert.equal(validateCommute({ origin:"frankton", destination:"frankton", modes:["car"], timeBand:"weekday-am" }).ok, false);
});
test("rejects unknown values", () => {
  assert.equal(validateCommute({ origin:"home-address", destination:"frankton", modes:["teleport"], timeBand:"08:03" }).ok, false);
});
