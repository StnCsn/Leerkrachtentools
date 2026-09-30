import { expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { createOrganization, generateApiKey, revokeApiKey, rotateApiKey } from "@/lib/api-keys";
import { withApiAuth } from "@/lib/api-guard";
import { getDatabase } from "@/lib/db/sqlite";
import { exportOrganizationData, closeOrganization } from "@/lib/privacy/dataControls";

it("isolates identical idempotency keys across organizations and preserves quota after rotation and closure", async () => {
  const a = createOrganization({ name: "A", email: "a@example.test", tier: "enterprise", quota: 1 });
  const b = createOrganization({ name: "B", email: "b@example.test", tier: "enterprise", quota: 1 });
  const ka = generateApiKey(a.id, "A", ["curriculum:match"]), kb = generateApiKey(b.id, "B", ["curriculum:match"]);
  let executions = 0;
  const route = withApiAuth(async (_request, context) => { executions++; return Response.json({ orgId: context.orgId, tenantContent: context.orgId === a.id ? "SYNTHETIC_A" : "SYNTHETIC_B" }); }, { requiredScope: "curriculum:match" });
  const request = (token: string) => new Request(`http://localhost/api/v1/test?orgId=${b.id}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": "identical" }, body: JSON.stringify({ orgId: b.id, keyId: kb.id }) });
  for (const [key, org] of [[ka, a], [kb, b]] as const) {
    const first = await route(request(key.token)), replay = await route(request(key.token));
    expect(first.status).toBe(200); expect(replay.headers.get("x-idempotent-replay")).toBe("1");
    expect(await replay.text()).toBe(await first.text());
    expect(JSON.stringify(exportOrganizationData(getDatabase(), org.id))).not.toContain(org.id === a.id ? "SYNTHETIC_B" : "SYNTHETIC_A");
    expect(JSON.stringify(exportOrganizationData(getDatabase(), org.id))).not.toContain(key.token);
  }
  expect(executions).toBe(2);
  revokeApiKey(kb.id); expect((await route(request(kb.token))).status).toBe(401);
  const rotated = rotateApiKey(ka.id); expect((await route(request(ka.token))).status).toBe(401);
  expect((await route(request(rotated.token))).status).toBe(429);
  closeOrganization(getDatabase(), a.id, true); expect((await route(request(rotated.token))).status).toBe(401);
  expect(getDatabase().prepare("SELECT consumed FROM api_org_quota WHERE org_id=?").get(a.id)).toEqual({ consumed: 1 });
  expect(() => generateApiKey(a.id, "again", ["curriculum:match"])).toThrow(); expect(executions).toBe(2);
});
it("fails closed on a real SQLite write lock with safe logs and accepts work after unlock", async () => {
  const org = createOrganization({ name: "locked DB", email: "locked@example.test", tier: "enterprise", quota: 10 });
  const key = generateApiKey(org.id, "lock", ["curriculum:match"]), db = getDatabase();
  let executions = 0;
  const route = withApiAuth(async () => { executions++; return Response.json({ ok: true }); }, { requiredScope: "curriculum:match" });
  const request = () => new Request("http://localhost/api/v1/test", { method: "POST", headers: { authorization: `Bearer ${key.token}`, "content-type": "application/json" }, body: '{"prompt":"SYNTHETIC_PRIVATE_INPUT"}' });
  const locker = new Database(process.env.DATABASE_PATH!); const logs = vi.spyOn(console, "error").mockImplementation(() => {});
  db.pragma("busy_timeout=30"); locker.exec("BEGIN IMMEDIATE");
  try {
    const response = await route(request()); expect(response.status).toBe(500); expect(executions).toBe(0);
    const diagnostic = JSON.stringify(logs.mock.calls); expect(diagnostic).toContain("SQLITE_BUSY");
    expect(diagnostic).not.toContain("SYNTHETIC_PRIVATE_INPUT"); expect(diagnostic).not.toContain(key.token);
  } finally { locker.exec("ROLLBACK"); locker.close(); db.pragma("busy_timeout=5000"); logs.mockRestore(); }
  expect((await route(request())).status).toBe(200); expect(executions).toBe(1);
  expect(db.prepare("SELECT consumed FROM api_org_quota WHERE org_id=?").get(org.id)).toEqual({ consumed: 1 });
});
it.each(["revoke", "expire", "rotate", "close", "scope"])("rechecks %s while a request body is still arriving, before replay or new work", async change => {
  const org = createOrganization({ name: "slow body", email: "slow@example.test", tier: "enterprise", quota: 10 });
  const key = generateApiKey(org.id, "slow", ["curriculum:match"]);
  let executions = 0;
  const route = withApiAuth(async () => { executions++; return Response.json({ value: "SYNTHETIC_PRIVATE_REPLAY" }); }, { requiredScope: "curriculum:match" });
  const headers = { authorization: `Bearer ${key.token}`, "content-type": "application/json", "idempotency-key": "slow-replay" };
  expect((await route(new Request("http://localhost/api/v1/test", { method: "POST", headers, body: "{}" }))).status).toBe(200);
  let incoming!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { incoming = controller; } });
  const pending = route(new Request("http://localhost/api/v1/test", { method: "POST", headers, body, duplex: "half" } as RequestInit));
  if (change === "revoke") revokeApiKey(key.id);
  if (change === "expire") getDatabase().prepare("UPDATE api_keys SET expires_at=? WHERE id=?").run(Date.now() - 1, key.id);
  if (change === "rotate") rotateApiKey(key.id);
  if (change === "close") closeOrganization(getDatabase(), org.id, true);
  if (change === "scope") getDatabase().prepare("UPDATE api_keys SET scopes='[]' WHERE id=?").run(key.id);
  incoming.enqueue(new TextEncoder().encode("{}")); incoming.close();
  const response = await pending; expect(response.status).toBe(change === "scope" ? 403 : 401);
  expect(response.headers.get("x-idempotent-replay")).toBeNull(); expect(await response.text()).not.toContain("SYNTHETIC_PRIVATE_REPLAY");
  expect(executions).toBe(1); expect(getDatabase().prepare("SELECT consumed FROM api_org_quota WHERE org_id=?").get(org.id)).toEqual({ consumed: 1 });
});
