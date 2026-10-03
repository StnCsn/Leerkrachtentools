import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const patch = JSON.parse(readFileSync(path.join(root, "patches/braces-3.0.3-depth.json"), "utf8"));
const hash = content => createHash("sha256").update(content).digest("hex");

export function applyBracesPatch(directory) {
  const installed = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
  if (installed.name !== patch.package || installed.version !== patch.version) {
    throw new Error("Unexpected braces version: review or retire the local security backport.");
  }
  // Validate every file before writing any of them. Already patched files
  // are accepted, but unknown bytes stop installation rather than losing a fix.
  const changes = patch.files.map(file => {
    const filename = path.join(directory, file.path);
    let content = readFileSync(filename, "utf8");
    if (hash(content) === file.patchedSha256) return null;
    if (hash(content) !== file.originalSha256) throw new Error(`Unexpected braces source: ${file.path}`);
    for (const edit of file.edits) {
      if (content.split(edit.before).length !== 2) throw new Error(`Ambiguous braces patch: ${file.path}`);
      content = content.replace(edit.before, () => edit.after);
    }
    if (hash(content) !== file.patchedSha256) throw new Error(`Invalid braces patch result: ${file.path}`);
    return { filename, content };
  });
  for (const change of changes) if (change) writeFileSync(change.filename, change.content);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const omittedDev = process.env.NODE_ENV === "production" || (process.env.npm_config_omit ?? "").split(/[\s,]+/).includes("dev");
  for (const [location, metadata] of Object.entries(lock.packages)) {
    if (!location.endsWith("/braces")) continue;
    const directory = path.join(root, location);
    if (!existsSync(directory) && metadata.dev && omittedDev) {
      console.log(`braces backport: ${location} omitted with development dependencies.`);
      continue;
    }
    applyBracesPatch(directory);
    console.log(`braces@3.0.3: verified local depth backport applied at ${location} (not an official fixed release).`);
  }
}
