import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, existsSync } from "node:fs";
const source = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
function harness(fetcher) {
  const handlers = {};
  let shell;
  const cached = { cached: true };
  const context = {
    URL,
    Response,
    fetch: fetcher,
    caches: {
      open: async () => ({
        addAll: async (paths) => (shell = paths),
        put: async () => {},
      }),
      match: async () => cached,
    },
    self: {
      location: { origin: "https://qt.test" },
      addEventListener: (type, fn) => (handlers[type] = fn),
    },
  };
  vm.runInNewContext(source, context);
  return {
    handlers,
    cached,
    get shell() {
      return shell;
    },
  };
}
test("offline shell dependencies exist and external map tiles are excluded", async () => {
  const h = harness();
  let promise;
  h.handlers.install({ waitUntil: (p) => (promise = p) });
  await promise;
  for (const path of h.shell)
    assert.ok(
      existsSync(
        new URL(
          "../public" + (path === "/" ? "/index.html" : path),
          import.meta.url,
        ),
      ),
      path,
    );
  for (const url of [
    "https://tile.openstreetmap.org/12/1/2.png",
    "https://qt.test/api/v1/layers/roads",
  ]) {
    let intercepted = false;
    h.handlers.fetch({
      request: { url, method: "GET" },
      respondWith() {
        intercepted = true;
      },
    });
    assert.equal(intercepted, false);
  }
});
test("network failure falls back to cached shell", async () => {
  const h = harness(async () => {
    throw Error("offline");
  });
  let promise;
  h.handlers.fetch({
    request: { url: "https://qt.test/index.html", method: "GET" },
    respondWith: (p) => (promise = p),
  });
  assert.equal(await promise, h.cached);
});
