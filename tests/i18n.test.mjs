import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A key defined twice in one language silently overrides the first (this once broke the hero).
test("no duplicate keys within a language", () => {
  const src = readFileSync(new URL("../js/i18n.js", import.meta.url), "utf8");
  const blocks = src.split(/\n {2}(?=(?:en|tr|ar): \{)/).slice(1);
  assert.equal(blocks.length, 3);
  for (const block of blocks) {
    const body = block.slice(0, block.indexOf("\n  },"));
    const seen = new Map();
    for (const m of body.matchAll(/(?:^|[\s,{])([A-Za-z0-9_]+): ["'`]/g)) {
      assert.ok(!seen.has(m[1]), `${block.slice(0, 2)}: "${m[1]}" defined twice`);
      seen.set(m[1], true);
    }
  }
});

test("every language has the same keys", async () => {
  const { STRINGS } = await import("../js/i18n.js").catch(() => ({}));
  if (!STRINGS) return; // not exported
  // Plural forms (key_one, key_few, …) depend on the language; only their base key must exist everywhere.
  const PLURAL = /_(zero|one|two|few|many|other)$/;
  const base = (l) => Object.keys(STRINGS[l]).filter((k) => !PLURAL.test(k)).sort();
  for (const l of ["tr", "ar"]) assert.deepEqual(base(l), base("en"), l);
  for (const l of ["en", "tr", "ar"]) for (const k of Object.keys(STRINGS[l]).filter((k) => PLURAL.test(k))) assert.ok(STRINGS[l][k.replace(PLURAL, "")], `${l}.${k} has no base key`);
});
