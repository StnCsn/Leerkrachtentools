import { afterEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const folders = [];
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
function fixture() {
  const folder = mkdtempSync(path.join(tmpdir(), "lt-backup-race-")); folders.push(folder);
  const source = path.join(folder, "source.db"), destination = path.join(folder, "snapshot.db");
  const db = new Database(source);
  db.exec("CREATE TABLE evidence(value TEXT); INSERT INTO evidence VALUES ('synthetic restore evidence')"); db.close();
  return { folder, source, destination };
}
function backup(source, destination, preload) {
  return execFileSync(process.execPath, [...(preload ? ["--import", preload] : []), "scripts/backup-database.mjs", source, destination], { stdio: "pipe", timeout: 5000 });
}
it("publishes an intact private snapshot and refuses an existing destination", () => {
  const { source, destination } = fixture(); backup(source, destination);
  const db = new Database(destination, { readonly: true });
  try { expect(db.pragma("integrity_check", { simple: true })).toBe("ok"); expect(db.prepare("SELECT value FROM evidence").get()).toEqual({ value: "synthetic restore evidence" }); }
  finally { db.close(); }
  if (process.platform !== "win32") expect(statSync(destination).mode & 0o777).toBe(0o600);
  const bytes = readFileSync(destination); expect(() => backup(source, destination)).toThrow(); expect(readFileSync(destination)).toEqual(bytes);
});
it("cannot replace a destination created after its initial existence check", () => {
  const { folder, source, destination } = fixture();
  const preload = path.join(folder, "competing-writer.mjs");
  // Deterministically schedule another writer at publication, after validation.
  writeFileSync(preload, `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
    for(const name of ['renameSync','linkSync']) { const original=fs[name]; fs[name]=(from,to)=>{
      if(to===process.argv[3] && !fs.existsSync(to)) fs.writeFileSync(to,'KEEP_EXISTING_BACKUP',{flag:'wx',mode:0o600});
      return original(from,to);
    }; } syncBuiltinESMExports();`);
  expect(() => backup(source, destination, preload)).toThrow();
  expect(readFileSync(destination, "utf8") === "KEEP_EXISTING_BACKUP").toBe(true);
  expect(readdirSync(folder).filter(name => name.endsWith(".partial"))).toEqual([]);
});
