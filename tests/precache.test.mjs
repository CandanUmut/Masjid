import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("service worker precaches every app file (so offline never breaks)", () => {
  const sw = readFileSync(join(root, "sw.js"), "utf8");
  const files = [...walk(join(root, "js")), ...walk(join(root, "css"))].map((p) => "./" + relative(root, p));
  for (const f of files) assert.ok(sw.includes(`"${f}"`), `${f} missing from sw.js FILES`);
});
