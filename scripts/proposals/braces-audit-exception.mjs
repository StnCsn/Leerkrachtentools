// REVIEW ONLY. Not imported by the live audit; no CLI or activation switch.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";

const policy = JSON.parse(readFileSync(new URL("./braces-exception-policy.json", import.meta.url), "utf8"));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const readJson = filename => JSON.parse(readFileSync(filename, "utf8"));
const check = (condition, message) => { if (!condition) throw new Error(message); };
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function normalized(value, root) {
  if (Array.isArray(value)) return value.map(item => normalized(item, root)).sort((a, b) => canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0);
  if (value && typeof value === "object") {
    // npm 10/11 disagree on this computed flag for the same actual tree.
    // Lock-record flags and every edge type remain independently pinned.
    if ("devOptional" in value) check(typeof value.devOptional === "boolean", "Invalid computed npm flag");
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "devOptional").map(([key, item]) => [key, key === "location" && item === root ? "." : normalized(item, root)]));
  }
  return value;
}

// Scan actual files, including aliases, nested packages and incomplete installs.
// Follow Next's internal directory aliases once; never leave the inspected tree.
function inspectTree(root, { checkCode = false } = {}) {
  check(lstatSync(root).isDirectory(), `Missing directory: ${root}`);
  const base = realpathSync(root);
  const braces = new Set();
  const files = [];
  const queue = [{ directory: root, depth: 0 }];
  const visited = new Set();
  let entries = 0;
  while (queue.length) {
    const { directory, depth } = queue.pop();
    check(depth <= 64, "Tree depth limit exceeded");
    const realDirectory = realpathSync(directory);
    if (visited.has(realDirectory)) continue;
    visited.add(realDirectory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      check(++entries <= 200_000, "Tree entry limit exceeded");
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const target = realpathSync(filename);
        check(target.startsWith(base + path.sep), "Unexpected tree symlink");
        if (lstatSync(target).isDirectory()) {
          if (entry.name === "braces") braces.add(filename);
          queue.push({ directory: target, depth: depth + 1 });
          continue;
        }
        check(lstatSync(target).isFile(), "Unexpected tree symlink");
      }
      if (entry.isDirectory()) {
        if (entry.name === "braces") braces.add(filename);
        queue.push({ directory: filename, depth: depth + 1 });
      } else {
        files.push(path.relative(root, filename).split(path.sep).join("/"));
        if (entry.name === "package.json" && readJson(filename).name === "braces") braces.add(directory);
        if (checkCode && /\.(?:[cm]?js|json)$/.test(entry.name)) {
          check(lstatSync(filename).size <= 32 * 1024 * 1024, "Uninspectable output file");
          const content = readFileSync(filename, "utf8");
          check(!/node_modules[\\/]braces(?:[\\/"']|$)|require\(["']braces["']\)|from\s*["']braces["']/.test(content), "Braces reference in production output");
        }
      }
    }
  }
  return { braces: [...braces].sort(), files: files.sort() };
}

function verifyInstalled(root) {
  const installed = path.join(root, "node_modules/braces");
  const found = inspectTree(path.join(root, "node_modules")).braces;
  check(canonical(found) === canonical([installed]), "Unexpected or missing installed braces instance");
  check(lstatSync(installed).isDirectory(), "Braces directory is not a regular directory");
  const pkg = readJson(path.join(installed, "package.json"));
  check(pkg.name === policy.package && pkg.version === policy.version, "Unexpected braces version");
  check(sha256(readFileSync(path.join(root, "patches/braces-3.0.3-depth.json"))) === policy.patchManifestSha256, "Changed patch manifest");
  const inventory = inspectTree(installed).files;
  check(canonical(inventory) === canonical(Object.keys(policy.installedFilesSha256).sort()), "Unexpected or missing braces file");
  for (const [filename, expected] of Object.entries(policy.installedFilesSha256)) {
    const actual = path.join(installed, filename);
    check(lstatSync(actual).isFile(), `Non-regular installed file: ${filename}`);
    check(sha256(readFileSync(actual)) === expected, `Changed installed backport: ${filename}`);
  }
  const lock = readJson(path.join(root, "package-lock.json"));
  const lockBraces = Object.keys(lock.packages).filter(location => location.endsWith("/braces"));
  check(canonical(lockBraces) === canonical(["node_modules/braces"]), "Changed braces lock locations");
  for (const [location, expected] of Object.entries(policy.chainPackages)) {
    const metadata = lock.packages[location];
    check(metadata?.version === expected.version && metadata.dev === true, `Changed dev/build lock chain: ${location}`);
    check(sha256(canonical(metadata)) === expected.lockRecordSha256, `Changed chain lock record: ${location}`);
    const filename = path.join(root, location, "package.json");
    check(lstatSync(filename).isFile() && sha256(readFileSync(filename)) === expected.packageJsonSha256, `Changed installed chain package: ${location}`);
  }
  // npm explain loads the current installed tree, not a saved CI artifact.
  const explain = JSON.parse(execFileSync("npm", ["explain", "braces", "--json"], { cwd: root, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 }));
  check(sha256(canonical(normalized(explain, root))) === policy.chainsExplainSha256, "Changed installed dependency chains");
}

function verifyAbsent(root, productionRoot, standaloneRoot) {
  check(realpathSync(productionRoot) !== realpathSync(root), "Production proof must use a separate clean install");
  for (const filename of ["package.json", "package-lock.json"]) {
    check(sha256(readFileSync(path.join(root, filename))) === sha256(readFileSync(path.join(productionRoot, filename))), "Production inputs differ");
  }
  check(readJson(path.join(productionRoot, "node_modules/next/package.json")).name === "next", "Missing production install");
  check(inspectTree(path.join(productionRoot, "node_modules"), { checkCode: true }).braces.length === 0, "Braces in production install");
  check(sha256(readFileSync(path.join(root, "package.json"))) === sha256(readFileSync(path.join(standaloneRoot, "package.json"))), "Standalone inputs differ");
  const buildId = readFileSync(path.join(root, ".next/BUILD_ID"), "utf8").trim();
  check(buildId.length > 0 && buildId === readFileSync(path.join(standaloneRoot, ".next/BUILD_ID"), "utf8").trim(), "Missing or stale standalone build");
  check(lstatSync(path.join(standaloneRoot, "server.js")).isFile(), "Missing standalone server");
  check(inspectTree(standaloneRoot, { checkCode: true }).braces.length === 0, "Braces in standalone output");
}

async function verifyUpstream(fetchImpl) {
  const [advisory, release] = await Promise.all([
    `https://api.osv.dev/v1/vulns/${policy.advisory}`,
    "https://registry.npmjs.org/braces/latest",
  ].map(async url => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    check(response.ok, "Upstream metadata unavailable");
    return response.json();
  }));
  check(isRecord(advisory) && advisory.id === policy.advisory && !advisory.withdrawn && Array.isArray(advisory.affected), "Invalid or changed upstream advisory");
  const reviewRequired = "Changed upstream affected records: targeted review required";
  check(advisory.affected.every(item => isRecord(item) && isRecord(item.package) && typeof item.package.ecosystem === "string" && item.package.ecosystem.length > 0 && typeof item.package.name === "string" && item.package.name.length > 0), reviewRequired);
  const affected = advisory.affected.filter(item => item.package?.ecosystem === "npm" && item.package.name === "braces");
  check(affected.length > 0 && affected.every(item => Array.isArray(item.ranges) && item.ranges.length > 0), reviewRequired);
  const events = affected.flatMap(item => item.ranges.flatMap(range => {
    check(isRecord(range) && ["SEMVER", "ECOSYSTEM", "GIT"].includes(range.type) && Array.isArray(range.events) && range.events.length > 0, reviewRequired);
    check(range.events.every(event => isRecord(event) && Object.keys(event).length === 1 && Object.entries(event).every(([key, version]) => ["introduced", "fixed", "last_affected", "limit"].includes(key) && typeof version === "string" && version.length > 0)), reviewRequired);
    return range.events;
  }));
  check(!events.some(event => event.fixed), "Official fix announced: investigate and replace backport");
  // Pin every relevant record/field/range/event, not just one matching boundary.
  // Only object-key order is normalized; array contents and order remain exact.
  check(canonical(affected) === canonical(policy.upstreamAffected), reviewRequired);
  check(release.name === "braces" && release.version === "3.0.3", "New upstream release: targeted review required");
}

export async function assessBracesExceptionProposal({ root, productionRoot, standaloneRoot, vulnerabilities, clock = Date.now, fetchImpl = fetch }) {
  check(policy.status === "proposal-not-active", "Unexpected proposal status");
  const requireUnexpired = () => {
    const now = clock();
    check(Number.isFinite(now) && now < Date.parse(policy.expiresAt), `Proposal expired at ${policy.expiresAt}; no automatic renewal`);
  };
  requireUnexpired();
  check(Array.isArray(vulnerabilities) && vulnerabilities.every(item => item && typeof item.package === "string" && typeof item.version === "string" && typeof item.id === "string"), "Invalid audit findings");
  const target = item => item.package === policy.package && item.version === policy.version && item.id === policy.advisory;
  check(vulnerabilities.some(target), "Exact advisory absent: retire or re-review proposal");
  root = path.resolve(root);
  verifyInstalled(root);
  verifyAbsent(root, path.resolve(productionRoot), path.resolve(standaloneRoot));
  await verifyUpstream(fetchImpl);
  requireUnexpired(); // Metadata requests may cross the deadline.
  const blocking = vulnerabilities.filter(item => !target(item));
  return {
    reviewOnly: true,
    wouldPassAfterSeparateApproval: blocking.length === 0,
    temporarilyMitigated: vulnerabilities.filter(target),
    blocking,
    warning: `TIJDELIJK GEMITIGEERD (voorstel, NIET ACTIEF): braces@3.0.3 ${policy.advisory}; lokale backport, geen officiële herstelrelease; vervalt ${policy.expiresAt}`,
  };
}
