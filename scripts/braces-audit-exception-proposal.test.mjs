import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { assessBracesExceptionProposal } from "./proposals/braces-audit-exception.mjs";

const policy = JSON.parse(readFileSync(new URL("./proposals/braces-exception-policy.json", import.meta.url), "utf8"));
const patch = JSON.parse(readFileSync("patches/braces-3.0.3-depth.json", "utf8"));
const advisory = JSON.parse(readFileSync("docs/audit-evidence/2026-10-03/braces-advisory.json", "utf8"));
const target = { package: "braces", version: "3.0.3", id: "GHSA-vfj7-8cjw-p6xm", summary: "Known recursion vulnerability" };
const directories = [];
const writeJson = (filename, value) => writeFileSync(filename, JSON.stringify(value));
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function fixture() {
  const base = mkdtempSync(path.join(tmpdir(), "lt-braces-proposal-"));
  directories.push(base);
  const root = path.join(base, "project");
  const productionRoot = path.join(base, "production");
  const standaloneRoot = path.join(root, ".next/standalone");
  for (const directory of [root, productionRoot, standaloneRoot]) {
    mkdirSync(directory, { recursive: true });
    cpSync("package.json", path.join(directory, "package.json"));
  }
  for (const directory of [root, productionRoot]) cpSync("package-lock.json", path.join(directory, "package-lock.json"));
  mkdirSync(path.join(root, "patches"));
  cpSync("patches/braces-3.0.3-depth.json", path.join(root, "patches/braces-3.0.3-depth.json"));
  for (const location of Object.keys(policy.chainPackages)) {
    mkdirSync(path.join(root, location), { recursive: true });
    cpSync(path.join(location, "package.json"), path.join(root, location, "package.json"));
  }
  cpSync("node_modules/braces", path.join(root, "node_modules/braces"), { recursive: true });
  mkdirSync(path.join(productionRoot, "node_modules/next"), { recursive: true });
  writeJson(path.join(productionRoot, "node_modules/next/package.json"), { name: "next", version: "16.3.6" });
  mkdirSync(path.join(standaloneRoot, ".next"));
  for (const file of [path.join(root, ".next/BUILD_ID"), path.join(standaloneRoot, ".next/BUILD_ID")]) writeFileSync(file, "synthetic-build-id");
  writeFileSync(path.join(standaloneRoot, "server.js"), "// Synthetic standalone fixture");
  return {
    root, productionRoot, standaloneRoot, vulnerabilities: [target], clock: () => Date.parse("2026-10-16T23:59:59.999Z"),
    fetchImpl: async url => ({ ok: true, json: async () => structuredClone(url.includes("api.osv.dev") ? advisory : { name: "braces", version: "3.0.3" }) }),
  };
}

describe("INACTIVE braces exception proposal", () => {
  it("checks real installed files/chains and reports a visible warning only as a review proposal", async () => {
    const result = await assessBracesExceptionProposal(fixture());
    expect(result).toMatchObject({ reviewOnly: true, wouldPassAfterSeparateApproval: true, blocking: [], temporarilyMitigated: [target] });
    expect(result.warning).toContain("NIET ACTIEF");
    expect(result.warning).toContain("TIJDELIJK GEMITIGEERD");
    expect(result.warning).toContain("2026-10-17T00:00:00.000Z");
    expect(result.warning).not.toContain("Geen bekende kwetsbaarheden");
  });

  it("rejects the original unpatched release even though the patch manifest is unchanged", async () => {
    const options = fixture();
    for (const file of patch.files) {
      const filename = path.join(options.root, "node_modules/braces", file.path);
      let content = readFileSync(filename, "utf8");
      for (const edit of [...file.edits].reverse()) content = content.replace(edit.after, () => edit.before);
      writeFileSync(filename, content);
    }
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Changed installed backport");
  });

  it.each(["lib/parse.js", "lib/stringify.js", "lib/utils.js", "index.js"])("rejects modified installed bytes: %s", async filename => {
    const options = fixture();
    const installed = path.join(options.root, "node_modules/braces", filename);
    writeFileSync(installed, readFileSync(installed, "utf8") + "\n// changed\n");
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Changed installed backport");
  });

  it("rejects a missing patch file", async () => {
    const options = fixture();
    rmSync(path.join(options.root, "node_modules/braces/lib/compile.js"));
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("missing braces file");
  });

  it("does not trust edits to the patch manifest", async () => {
    const options = fixture();
    const altered = structuredClone(patch);
    altered.files[0].patchedSha256 = "0".repeat(64);
    writeJson(path.join(options.root, "patches/braces-3.0.3-depth.json"), altered);
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Changed patch manifest");
  });

  it("rejects a different installed version", async () => {
    const options = fixture();
    const filename = path.join(options.root, "node_modules/braces/package.json");
    writeJson(filename, { ...JSON.parse(readFileSync(filename, "utf8")), version: "3.0.4" });
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Unexpected braces version");
  });

  it("rejects symlinked patched files", async () => {
    const options = fixture();
    const filename = path.join(options.root, "node_modules/braces/lib/parse.js");
    const copy = path.join(options.root, "copied-parse.js");
    cpSync(filename, copy); rmSync(filename); symlinkSync(copy, filename);
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Unexpected tree symlink");
  });

  it("rejects another installed braces instance", async () => {
    const options = fixture();
    cpSync("node_modules/braces", path.join(options.root, "node_modules/shadcn/node_modules/braces"), { recursive: true });
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Unexpected or missing installed braces");
  });

  it("detects a new actual dependent chain without relying on a saved explain artifact", async () => {
    const options = fixture();
    const filename = path.join(options.root, "package.json");
    const project = JSON.parse(readFileSync(filename, "utf8"));
    project.devDependencies.micromatch = "4.0.8";
    writeJson(filename, project);
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Changed installed dependency chains");
  });

  it("rejects changed installed consumer metadata", async () => {
    const options = fixture();
    const filename = path.join(options.root, "node_modules/fast-glob/package.json");
    writeFileSync(filename, readFileSync(filename, "utf8") + "\n");
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Changed installed chain package");
  });

  it("rejects a chain reclassified as production in the lockfile", async () => {
    const options = fixture();
    const filename = path.join(options.root, "package-lock.json");
    const lock = JSON.parse(readFileSync(filename, "utf8"));
    delete lock.packages["node_modules/braces"].dev;
    writeJson(filename, lock);
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Changed dev/build lock chain");
  });

  it.each(["productionRoot", "standaloneRoot"])("rejects braces in %s, including an alias directory", async field => {
    const options = fixture();
    const directory = path.join(options[field], "node_modules/alias-package");
    mkdirSync(directory, { recursive: true });
    writeJson(path.join(directory, "package.json"), { name: "braces", version: "3.0.3" });
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow(field === "productionRoot" ? "Braces in production install" : "Braces in standalone output");
  });

  it("rejects braces references embedded in standalone code", async () => {
    const options = fixture();
    writeFileSync(path.join(options.standaloneRoot, "server.js"), 'require("braces");');
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Braces reference in production output");
  });

  it("rejects stale standalone output", async () => {
    const options = fixture();
    writeFileSync(path.join(options.standaloneRoot, ".next/BUILD_ID"), "old-build");
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Missing or stale standalone build");
  });

  it("inspects Next's internal standalone directory aliases without escaping the output", async () => {
    const options = fixture();
    mkdirSync(path.join(options.standaloneRoot, "node_modules/internal"), { recursive: true });
    symlinkSync("../node_modules/internal", path.join(options.standaloneRoot, ".next/alias"));
    expect((await assessBracesExceptionProposal(options)).reviewOnly).toBe(true);
  });

  it("rejects a standalone directory alias outside the inspected output", async () => {
    const options = fixture();
    symlinkSync(options.root, path.join(options.standaloneRoot, ".next/outside"));
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Unexpected tree symlink");
  });

  it.each([
    { package: "braces", version: "3.0.3", id: "GHSA-other" },
    { package: "braces", version: "3.0.2", id: target.id },
    { package: "brace-expansion", version: "3.0.3", id: target.id },
  ])("keeps every other advisory/package/version combination blocking: %j", async extra => {
    const options = fixture();
    options.vulnerabilities.push(extra);
    const result = await assessBracesExceptionProposal(options);
    expect(result.wouldPassAfterSeparateApproval).toBe(false);
    expect(result.blocking).toEqual([extra]);
    expect(result.temporarilyMitigated).toEqual([target]);
  });

  it.each(["2026-10-17T00:00:00.000Z", "2026-10-18T00:00:00.000Z"])("expires without renewal at %s", async date => {
    const options = fixture(); options.clock = () => Date.parse(date);
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Proposal expired");
  });

  it("rejects a deadline crossed while upstream verification is in flight", async () => {
    const options = fixture();
    let now = Date.parse("2026-10-16T23:59:59.999Z");
    options.clock = () => now;
    const fetchImpl = options.fetchImpl;
    options.fetchImpl = async (...args) => {
      const result = await fetchImpl(...args);
      now = Date.parse("2026-10-17T00:00:00.000Z");
      return result;
    };
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow("Proposal expired");
  });

  it.each(["release", "fixed-advisory", "offline"])("requires targeted upstream review for %s", async change => {
    const options = fixture();
    options.fetchImpl = async url => {
      if (change === "offline") throw new Error("Synthetic metadata outage");
      const data = url.includes("api.osv.dev") ? structuredClone(advisory) : { name: "braces", version: change === "release" ? "3.0.4" : "3.0.3" };
      if (change === "fixed-advisory" && data.affected) data.affected[0].ranges[0].events = [{ introduced: "0" }, { fixed: "3.0.4" }];
      return { ok: true, json: async () => data };
    };
    await expect(assessBracesExceptionProposal(options)).rejects.toThrow(change === "release" ? "New upstream release" : change === "fixed-advisory" ? "Official fix announced" : "Synthetic metadata outage");
  });
});
