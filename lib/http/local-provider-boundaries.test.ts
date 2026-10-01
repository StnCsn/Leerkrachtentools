import { afterAll, beforeAll, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import { credentialFetch } from "./credentialFetch";

let server: Server, origin: string;
const requests: string[] = [];
beforeAll(async () => {
  const compressed = gzipSync(Buffer.alloc(2 * 1024 * 1024, 65));
  server = createServer((request, response) => {
    requests.push(request.url!);
    if (request.url === "/compressed") { response.writeHead(200, { "content-encoding": "gzip" }); response.end(compressed); }
    else if (request.url === "/redirect") { response.writeHead(307, { location: `${origin}/credential-target` }); response.end(); }
    else if (request.url === "/slow") { response.writeHead(200, { "content-type": "application/json" }); response.write("{"); }
    else { response.writeHead(200); response.end('{"ok":true}'); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
it("bounds actual decoded gzip bytes even without Content-Length", async () => {
  await expect(credentialFetch(`${origin}/compressed`)).rejects.toThrow("te groot");
  expect(await (await credentialFetch(`${origin}/normal`)).json()).toEqual({ ok: true });
});
it("does not forward synthetic credentials through a real redirect", async () => {
  await expect(credentialFetch(`${origin}/redirect`, { headers: { authorization: "Bearer synthetic-local-only" } })).rejects.toThrow();
  expect(requests).not.toContain("/credential-target");
});
it("aborts an actual unfinished provider body and recovers for a following request", async () => {
  const controller = new AbortController();
  const pending = credentialFetch(`${origin}/slow`, { signal: controller.signal });
  const rejection = expect(pending).rejects.toThrow();
  for (let i = 0; i < 100 && !requests.includes("/slow"); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(requests).toContain("/slow"); controller.abort(); await rejection;
  expect(await (await credentialFetch(`${origin}/normal`)).json()).toEqual({ ok: true });
});
