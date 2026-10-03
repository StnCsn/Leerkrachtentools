// Test-only preload. The active CLI exposes no mock/time/proof-directory flags.
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const config = JSON.parse(readFileSync(new URL("./audit-test.json", import.meta.url), "utf8"));
Date.now = () => Date.parse(config.now);
globalThis.fetch = async (url, options) => {
  if (url === "https://api.osv.dev/v1/querybatch") {
    const { queries } = JSON.parse(options.body);
    if (config.invalidAudit) return { ok: true, json: async () => ({ results: [] }) };
    return { ok: true, json: async () => ({ results: queries.map(query => ({ vulns: query.package.name === "braces" ? [{ id: "GHSA-vfj7-8cjw-p6xm" }, ...(config.extra ? [{ id: "GHSA-extra-blocking" }] : [])] : [] })) }) };
  }
  if (url === "https://api.osv.dev/v1/vulns/GHSA-vfj7-8cjw-p6xm") return { ok: true, json: async () => config.advisory };
  if (url === "https://registry.npmjs.org/braces/latest") return { ok: true, json: async () => config.release };
  throw new Error("Unexpected network request in synthetic audit");
};
const realExec = childProcess.execFileSync;
childProcess.execFileSync = (command, args, options) => {
  if (command !== "npm" || args[0] !== "ci") return realExec(command, args, options);
  if (JSON.stringify(args) !== JSON.stringify(["ci", "--omit=dev", "--no-audit", "--no-fund"]) || options.timeout !== 180000) throw new Error("Unsafe production-install invocation");
  if (readFileSync(path.join(options.cwd, "package-lock.json"), "utf8") !== readFileSync(path.join(config.root, "package-lock.json"), "utf8")) throw new Error("Different production lock");
  writeFileSync(path.join(config.base, "production-path"), options.cwd);
  if (config.installFailure) throw new Error("Synthetic install failure");
  mkdirSync(path.join(options.cwd, "node_modules/next"), { recursive: true });
  writeFileSync(path.join(options.cwd, "node_modules/next/package.json"), JSON.stringify({ name: "next", version: "16.3.6" }));
  if (config.productionBraces) {
    mkdirSync(path.join(options.cwd, "node_modules/alias"), { recursive: true });
    writeFileSync(path.join(options.cwd, "node_modules/alias/package.json"), JSON.stringify({ name: "braces", version: "3.0.3" }));
  }
  return Buffer.from("Synthetic omitted-dev install");
};
syncBuiltinESMExports();
