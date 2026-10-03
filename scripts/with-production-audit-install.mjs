import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Proof must come from a fresh omitted-dev install of this exact lockfile.
// No caller-selected proof directory or script-skipping installation is allowed.
export async function withProductionAuditInstall(root, inspect) {
  const productionRoot = mkdtempSync(path.join(tmpdir(), "lt-braces-audit-production-"));
  try {
    for (const file of ["package.json", "package-lock.json", "scripts/apply-braces-security-patch.mjs", "patches/braces-3.0.3-depth.json"]) {
      const destination = path.join(productionRoot, file);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(path.join(root, file), destination);
    }
    execFileSync("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], {
      cwd: productionRoot, timeout: 180_000, maxBuffer: 2 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return await inspect(productionRoot);
  } finally {
    rmSync(productionRoot, { recursive: true, force: true });
  }
}
