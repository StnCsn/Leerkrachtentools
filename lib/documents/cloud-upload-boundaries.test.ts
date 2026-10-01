import { afterAll, beforeAll, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";
import { extractDocumentText } from "./extractText";
import { runDocumentJob } from "./parserWorker";

const folder = mkdtempSync(path.join(tmpdir(), "lt-upload-boundary-"));
let server: Server, origin: string, externalRequests = 0;
beforeAll(async () => {
  server = createServer((_request, response) => { externalRequests++; response.end("LOCAL_RESOURCE_MUST_NOT_BE_READ"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); rmSync(folder, { recursive: true, force: true }); });
it("extracts ordinary DOCX text without following external relationships or local-file references", async () => {
  const secret = path.join(folder, "sentinel.txt"); writeFileSync(secret, "LOCAL_FILE_MUST_NOT_BE_READ");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:hyperlink r:id="network"><w:r><w:t>De leerlingen vergelijken 3 &lt; 4.</w:t></w:r></w:hyperlink></w:p><w:p><w:fldSimple w:instr="INCLUDETEXT sentinel.txt"><w:r><w:t>Gewone lesinhoud.</w:t></w:r></w:fldSimple></w:p></w:body></w:document>');
  zip.file("word/_rels/document.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="network" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${origin}/external" TargetMode="External"/><Relationship Id="file" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="file://${secret}" TargetMode="External"/></Relationships>`);
  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  const text = await extractDocumentText(bytes, "lesson.docx");
  expect(text).toContain("3 < 4"); expect(text).not.toContain("MUST_NOT_BE_READ"); expect(externalRequests).toBe(0);
  expect(readFileSync(secret, "utf8")).toBe("LOCAL_FILE_MUST_NOT_BE_READ"); expect(readdirSync(folder)).toEqual(["sentinel.txt"]);
});
it.each(["txt", "md", "csv"])("preserves ordinary %s content, including comparison symbols and teacher markup", async extension => {
  const content = "Instap: 3 < 4, 5 > 2.\nLk: Waarom? Lln: Omdat vier meer is.\n**Rekenen**,\"blokjes\"";
  expect(await extractDocumentText(Buffer.from(content), `lesson.${extension}`)).toBe(content);
});
it("rejects a tiny PNG with oversized dimensions before allocation, then processes a normal avatar", async () => {
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } }).png().toBuffer();
  const altered = Buffer.from(png); altered.writeUInt32BE(100_000, 16); altered.writeUInt32BE(100_000, 20);
  await expect(runDocumentJob({ operation: "avatar", bytes: altered.toString("base64") })).rejects.toThrow();
  const result = await runDocumentJob({ operation: "avatar", bytes: png.toString("base64") });
  const metadata = await sharp(Buffer.from(result.bytes!, "base64")).metadata(); expect(metadata.format).toBe("webp"); expect(metadata.width).toBe(16);
});
it("cancels before parsing and recovers without leaving application upload slots held", async () => {
  const controller = new AbortController(); controller.abort();
  await expect(extractDocumentText(Buffer.from("synthetic"), "lesson.txt", controller.signal)).rejects.toThrow();
  expect(await extractDocumentText(Buffer.from("recovered"), "lesson.txt")).toBe("recovered");
});
