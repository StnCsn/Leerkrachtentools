import { expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { getDatabase } from "@/lib/db/sqlite";
import { createOrganization, generateApiKey, revokeApiKey, rotateApiKey } from "@/lib/api-keys";
import { completeOrgApiCall, reserveOrgApiCall } from "@/lib/api/orgQuota";

it.each(["reserve", "complete", "issue", "revoke", "rotate"])("acquires the writer lock before %s reads its accounting or key state", action => {
  const org = createOrganization({ name: "writer race", email: "race@example.test", tier: "enterprise", quota: 10 });
  const key = generateApiKey(org.id, "initial", ["curriculum:match"]), db = getDatabase();
  const reserve = { orgId: org.id, keyId: key.id, monthlyLimit: 10, method: "POST", endpoint: "/test", requestDigest: "synthetic" };
  const job = reserveOrgApiCall(reserve); if (!job.ok || job.replay) throw new Error("fixture failed");
  const other = new Database(process.env.DATABASE_PATH!); other.pragma("busy_timeout=0");
  const originalPrepare = db.prepare.bind(db); let attempted = false, blocked = false;
  const target = action === "complete" ? "SELECT id, period FROM api_request_leases" : action === "revoke" ? "SELECT org_id FROM api_keys" : action === "rotate" ? "SELECT * FROM api_keys" : "SELECT 1 FROM api_organizations";
  const spy = vi.spyOn(db, "prepare").mockImplementation(sql => {
    const statement = originalPrepare(sql);
    if (sql.includes(target) && !attempted) {
      const originalGet = statement.get.bind(statement);
      statement.get = ((...args: unknown[]) => {
        const result = originalGet(...args); attempted = true;
        try { other.prepare("UPDATE api_organizations SET name=name || 'x' WHERE id=?").run(org.id); }
        catch (error) { if ((error as { code?: string }).code !== "SQLITE_BUSY") throw error; blocked = true; }
        return result;
      }) as typeof statement.get;
    }
    return statement;
  });
  try {
    expect(() => {
      if (action === "reserve") reserveOrgApiCall(reserve);
      if (action === "complete") completeOrgApiCall({ ...reserve, ...job, statusCode: 200 });
      if (action === "issue") generateApiKey(org.id, "new", ["curriculum:match"]);
      if (action === "revoke") revokeApiKey(key.id);
      if (action === "rotate") rotateApiKey(key.id);
    }).not.toThrow();
    expect(attempted).toBe(true); expect(blocked).toBe(true);
  } finally { spy.mockRestore(); other.close(); db.prepare("DELETE FROM api_request_leases WHERE org_id=?").run(org.id); }
});
