import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyBracesPatch } from "./apply-braces-security-patch.mjs";

const patch = JSON.parse(readFileSync("patches/braces-3.0.3-depth.json", "utf8"));
const hash = content => createHash("sha256").update(content).digest("hex");

function fixture(run) {
  const directory = mkdtempSync(path.join(tmpdir(), "braces-patch-test-"));
  try {
    writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: "braces", version: "3.0.3" }));
    for (const file of patch.files) {
      let content = readFileSync(path.join("node_modules/braces", file.path), "utf8");
      if (hash(content) === file.patchedSha256) {
        for (const edit of [...file.edits].reverse()) content = content.replace(edit.after, () => edit.before);
      }
      expect(hash(content)).toBe(file.originalSha256);
      const filename = path.join(directory, file.path);
      mkdirSync(path.dirname(filename), { recursive: true });
      writeFileSync(filename, content);
    }
    run(directory);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

it("reproduces the pinned backport from original bytes and is idempotent", () => fixture(directory => {
  for (let pass = 0; pass < 2; pass++) {
    applyBracesPatch(directory);
    for (const file of patch.files) expect(hash(readFileSync(path.join(directory, file.path)))).toBe(file.patchedSha256);
  }
}));

it("rejects unexpected source before writing any other file", () => fixture(directory => {
  const last = path.join(directory, patch.files.at(-1).path);
  writeFileSync(last, readFileSync(last, "utf8") + "\n// unexpected upstream change\n");
  expect(() => applyBracesPatch(directory)).toThrow("Unexpected braces source");
  const first = patch.files[0];
  expect(hash(readFileSync(path.join(directory, first.path)))).toBe(first.originalSha256);
}));

it("requires manual review for an unsupported package version", () => fixture(directory => {
  writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: "braces", version: "3.0.4" }));
  expect(() => applyBracesPatch(directory)).toThrow("Unexpected braces version");
}));
