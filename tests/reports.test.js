import test from "node:test";
import assert from "node:assert/strict";
import {
  readReports,
  saveReport,
  deleteReport,
} from "../public/src/api/reports.js";
const storage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
};
test("private draft persists and deletes without altering another draft", () => {
  const s = storage();
  const first = saveReport(
    { note: " pothole ", placeId: "town", type: "Other" },
    s,
  );
  saveReport({ note: "Second", placeId: "frankton", type: "Other" }, s);
  assert.equal(readReports(s)[1].note, "pothole");
  deleteReport(first.id, s);
  assert.equal(readReports(s).length, 1);
  assert.equal(readReports(s)[0].note, "Second");
});
test("invalid and corrupt storage is handled", () => {
  assert.deepEqual(readReports({ getItem: () => "{broken" }), []);
  assert.deepEqual(readReports({ getItem: () => '{"not":"array"}' }), []);
  assert.throws(() => saveReport({ note: "  " }, storage()));
  assert.throws(() => saveReport({ note: "a".repeat(501) }, storage()));
});
test("blocked writes fail explicitly instead of pretending to submit", () =>
  assert.throws(() =>
    saveReport(
      { note: "Valid" },
      {
        getItem: () => null,
        setItem() {
          throw Error("Blocked");
        },
      },
    ),
  ));
