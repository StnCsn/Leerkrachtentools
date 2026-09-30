import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, firefox, webkit } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Real IndexedDB with synthetic data in a disposable browser profile. No server,
// external requests, personal storage or provider credentials are used.
const bundle = await build({
  stdin: { contents: `import * as scope from './lib/storage/userStorageScope';
    import * as documents from './lib/documents/documentStorage';
    import * as cache from './lib/rag/clientQueryCache';
    window.storageProbe = { ...scope, ...documents, ...cache };`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", tsconfig: "tsconfig.json",
});
const engine = process.env.PREVIEW_BROWSER ?? "chromium";
assert(["chromium", "firefox", "webkit"].includes(engine));
// WebKit ephemeral contexts cannot persist IndexedDB Blobs. A disposable
// persistent profile exercises the same storage as a normal browser session.
const profile = mkdtempSync(path.join(tmpdir(), "lt-storage-browser-"));
const context = await ({ chromium, firefox, webkit })[engine].launchPersistentContext(profile, { headless: true, serviceWorkers: "block", ...(engine === "chromium" && process.env.SECURITY_BROWSER_CHANNEL ? { channel: process.env.SECURITY_BROWSER_CHANNEL } : {}) });
try {
  await context.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Synthetic session storage test</title>" }));
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:18999/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const s = window.storageProbe;
    s.setActiveUserId("A");
    await s.saveLessonDocument("committed", new Blob(["private A"]));
    const normal = await (await s.getLessonDocument("committed")).text();
    const lateRead = s.getLessonDocument("committed").then(() => false, () => true);
    s.setActiveUserId("B");
    const rejectedRead = await lateRead;
    const lateWrite = s.saveLessonDocument("late", new Blob(["private B"])).then(() => false, () => true);
    s.setActiveUserId(null);
    s.setActiveUserId("B");
    const rejectedWrite = await lateWrite;
    const missing = await s.getLessonDocument("late");
    const otherAccount = await s.getLessonDocument("committed");
    const old = s.captureStorageSession();
    s.setActiveUserId(null); s.setActiveUserId("B");
    const ten = Array.from({length:10},(_,i)=>({code:String(i)}));
    s.writeRagQueryCache("rag-curriculum", "LAGER", "ALL", "legacy query", { data: { goal: ten[0], results: ten, alternatives: ten }, provider: "synthetic", fallbackErrors: [] });
    // Inject an old oversized entry after writing, so read-side protection is
    // exercised independently of the current writer.
    const cacheKey = "leerkrachtentools-rag-query-cache:B";
    const store = JSON.parse(sessionStorage.getItem(cacheKey));
    for(const entry of Object.values(store.entries)) { entry.data.results=ten; entry.data.alternatives=ten; }
    sessionStorage.setItem(cacheKey,JSON.stringify(store));
    const legacy = s.readRagQueryCache("rag-curriculum", "LAGER", "ALL", "legacy query");
    const legacyResults=legacy.data.results.length, legacyAlternatives=legacy.data.alternatives.length;
    s.clearRagQueryCache();
    localStorage.setItem("leerkrachtentools-shared-device", "true");
    s.writeRagQueryCache("rag-curriculum", "LAGER", "ALL", "private query", { data: { goal: "private cache" }, provider: "synthetic", fallbackErrors: [] });
    const ownCache = s.readRagQueryCache("rag-curriculum", "LAGER", "ALL", "private query").data.goal;
    s.setActiveUserId("C");
    const otherCache = s.readRagQueryCache("rag-curriculum", "LAGER", "ALL", "private query");
    return { normal, rejectedRead, rejectedWrite, missing, otherAccount, oldAborted: old.signal.aborted, ownCache, otherCache, persistedCacheEntries: sessionStorage.length, legacyResults, legacyAlternatives };
  });
  assert.deepEqual(result, { normal: "private A", rejectedRead: true, rejectedWrite: true, missing: null, otherAccount: null, oldAborted: true, ownCache: "private cache", otherCache: null, persistedCacheEntries: 0, legacyResults: 5, legacyAlternatives: 4 });
  console.log("Client session isolation passed: committed IndexedDB writes, account separation and rejection of late reads/writes across logout and re-login.");
  console.log("Shared-device query cache passed: account-scoped results in memory, no sessionStorage persistence.");
  console.log(`Legacy ten-result browser cache passed (${engine}): at most five matches and four alternatives.`);
} finally { await context.close(); rmSync(profile, { recursive: true, force: true }); }
