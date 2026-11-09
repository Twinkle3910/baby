import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import fs from "node:fs/promises";
import path from "node:path";
import dayjs from "dayjs";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { config } from "./config.js";
import {
  demoDraftRows,
  extractTextFromImage,
  parseLogText,
} from "./ocr.js";
import { draftRowsToRecordInputs } from "./draft-to-records.js";
import { recordsToCsv, summarizeRecords } from "./summary.js";
import { buildSummaryPdf } from "./pdf.js";
import type { DraftRow } from "./types.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.corsOrigin,
    allowHeaders: ["Content-Type", "Authorization", "X-Family-Pin"],
  }),
);

app.use(
  "*",
  bodyLimit({
    maxSize: 15 * 1024 * 1024,
    onError: (c) => c.json({ error: "文件过大（上限 15MB）" }, 413),
  }),
);

async function ensureUploadDir() {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

function parsePayload(raw: unknown) {
  if (typeof raw === "string") return raw;
  return JSON.stringify(raw ?? {});
}

app.get("/api/health", (c) => c.json({ ok: true, service: "baby-paper-hybrid" }));

app.get("/api/bootstrap", async (c) => {
  const family = await prisma.family.findFirst({
    include: { babies: true, carers: true },
  });
  if (!family) return c.json({ error: "未初始化，请先运行 db:seed" }, 500);
  return c.json({
    family: { id: family.id, name: family.name },
    babies: family.babies,
    carers: family.carers,
    templates: [
      { id: "a4", title: "A4 日表", path: "/templates/daily-log-a4.html" },
      { id: "b5", title: "B5 随身日表", path: "/templates/daily-log-b5.html" },
      { id: "guide", title: "保姆说明", path: "/templates/nanny-guide.html" },
    ],
  });
});

app.get("/templates/:file", async (c) => {
  const file = c.req.param("file");
  if (!/^[\w.-]+\.html$/.test(file)) return c.text("Not found", 404);
  const full = path.join(config.templatesDir, file);
  try {
    const html = await fs.readFile(full, "utf8");
    return c.html(html);
  } catch {
    return c.text("Not found", 404);
  }
});

const recordSchema = z.object({
  babyId: z.string(),
  carerId: z.string().optional().nullable(),
  type: z.enum(["feeding", "diaper", "sleep", "growth", "note"]),
  occurredAt: z.string(),
  endAt: z.string().optional().nullable(),
  payload: z.unknown().optional(),
  note: z.string().optional().nullable(),
  source: z.string().optional(),
});

app.get("/api/records", async (c) => {
  const babyId = c.req.query("babyId");
  const date = c.req.query("date");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const type = c.req.query("type");
  if (!babyId) return c.json({ error: "babyId required" }, 400);

  let start: Date | undefined;
  let end: Date | undefined;
  if (date) {
    start = dayjs(date).startOf("day").toDate();
    end = dayjs(date).endOf("day").toDate();
  } else {
    if (from) start = dayjs(from).startOf("day").toDate();
    if (to) end = dayjs(to).endOf("day").toDate();
  }

  const records = await prisma.record.findMany({
    where: {
      babyId,
      ...(type ? { type } : {}),
      ...(start || end
        ? {
            occurredAt: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
    },
    include: { carer: true, media: true },
    orderBy: { occurredAt: "asc" },
  });

  return c.json({
    records: records.map((r) => ({
      ...r,
      payload: JSON.parse(r.payload || "{}"),
    })),
    summary: summarizeRecords(records),
  });
});

app.post("/api/records", async (c) => {
  const body = recordSchema.parse(await c.req.json());
  const created = await prisma.record.create({
    data: {
      babyId: body.babyId,
      carerId: body.carerId || null,
      type: body.type,
      occurredAt: new Date(body.occurredAt),
      endAt: body.endAt ? new Date(body.endAt) : null,
      payload: parsePayload(body.payload),
      note: body.note || null,
      source: body.source || "manual",
    },
    include: { carer: true },
  });
  return c.json({
    record: { ...created, payload: JSON.parse(created.payload || "{}") },
  });
});

app.patch("/api/records/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const updated = await prisma.record.update({
    where: { id },
    data: {
      ...(body.type ? { type: body.type } : {}),
      ...(body.occurredAt ? { occurredAt: new Date(body.occurredAt) } : {}),
      ...(body.endAt !== undefined
        ? { endAt: body.endAt ? new Date(body.endAt) : null }
        : {}),
      ...(body.payload !== undefined
        ? { payload: parsePayload(body.payload) }
        : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.carerId !== undefined ? { carerId: body.carerId } : {}),
    },
    include: { carer: true },
  });
  return c.json({
    record: { ...updated, payload: JSON.parse(updated.payload || "{}") },
  });
});

app.delete("/api/records/:id", async (c) => {
  const id = c.req.param("id");
  await prisma.record.delete({ where: { id } });
  return c.json({ ok: true });
});

app.get("/api/dashboard/today", async (c) => {
  const babyId = c.req.query("babyId");
  if (!babyId) return c.json({ error: "babyId required" }, 400);
  const date = c.req.query("date") || dayjs().format("YYYY-MM-DD");
  const start = dayjs(date).startOf("day").toDate();
  const end = dayjs(date).endOf("day").toDate();
  const records = await prisma.record.findMany({
    where: { babyId, occurredAt: { gte: start, lte: end } },
    include: { carer: true, media: true },
    orderBy: { occurredAt: "desc" },
  });
  const lastFeed = records.find((r) => r.type === "feeding");
  const activeSleep = records.find((r) => r.type === "sleep" && !r.endAt);
  return c.json({
    date,
    summary: summarizeRecords(records),
    lastFeed: lastFeed
      ? { ...lastFeed, payload: JSON.parse(lastFeed.payload || "{}") }
      : null,
    activeSleep: activeSleep
      ? { ...activeSleep, payload: JSON.parse(activeSleep.payload || "{}") }
      : null,
    timeline: records.map((r) => ({
      ...r,
      payload: JSON.parse(r.payload || "{}"),
    })),
  });
});

app.post("/api/paper/scan", async (c) => {
  await ensureUploadDir();
  const form = await c.req.parseBody();
  const babyId = String(form.babyId || "");
  const sheetDate = String(form.sheetDate || dayjs().format("YYYY-MM-DD"));
  const pastedText = String(form.pastedText || "");
  const file = form.file;

  if (!babyId) return c.json({ error: "babyId required" }, 400);

  let filename = `scan-${Date.now()}.txt`;
  let mimeType = "text/plain";
  let buffer: Buffer | null = null;

  if (file && typeof file === "object" && "arrayBuffer" in file) {
    const f = file as File;
    buffer = Buffer.from(await f.arrayBuffer());
    const ext = path.extname(f.name || "") || ".jpg";
    filename = `scan-${Date.now()}${ext}`;
    mimeType = f.type || "application/octet-stream";
    await fs.writeFile(path.join(config.uploadDir, filename), buffer);
  }

  let rawText = pastedText;
  let provider = "paste";
  if (!rawText && buffer) {
    const extracted = await extractTextFromImage(buffer, filename);
    rawText = extracted.text;
    provider = extracted.provider;
  }

  let drafts: DraftRow[] = rawText ? parseLogText(rawText, sheetDate) : [];
  if (drafts.length === 0) {
    drafts = demoDraftRows();
    rawText =
      rawText ||
      "[mock] 未识别到清晰表格文字，已生成示例草稿供核对。也可在下方粘贴手写转写文本。";
    provider = `${provider}+demo`;
  }

  const scan = await prisma.paperScan.create({
    data: {
      babyId,
      filename,
      mimeType,
      sheetDate: dayjs(sheetDate).toDate(),
      status: "draft",
      draftJson: JSON.stringify(drafts),
      rawText: `[provider=${provider}]\n${rawText}`,
    },
  });

  return c.json({
    scan: {
      ...scan,
      drafts,
    },
  });
});

app.get("/api/paper/scans", async (c) => {
  const babyId = c.req.query("babyId");
  if (!babyId) return c.json({ error: "babyId required" }, 400);
  const scans = await prisma.paperScan.findMany({
    where: { babyId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return c.json({
    scans: scans.map((s) => ({
      ...s,
      drafts: JSON.parse(s.draftJson || "[]"),
    })),
  });
});

app.get("/api/paper/scans/:id", async (c) => {
  const scan = await prisma.paperScan.findUnique({
    where: { id: c.req.param("id") },
  });
  if (!scan) return c.json({ error: "not found" }, 404);
  return c.json({
    scan: { ...scan, drafts: JSON.parse(scan.draftJson || "[]") },
  });
});

app.patch("/api/paper/scans/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const drafts = body.drafts as DraftRow[];
  const updated = await prisma.paperScan.update({
    where: { id },
    data: {
      draftJson: JSON.stringify(drafts || []),
      ...(body.sheetDate ? { sheetDate: dayjs(body.sheetDate).toDate() } : {}),
      ...(body.rawText ? { rawText: body.rawText } : {}),
    },
  });
  return c.json({
    scan: { ...updated, drafts: JSON.parse(updated.draftJson || "[]") },
  });
});

app.post("/api/paper/scans/:id/confirm", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const scan = await prisma.paperScan.findUnique({ where: { id } });
  if (!scan) return c.json({ error: "not found" }, 404);
  if (scan.status === "confirmed") {
    return c.json({ error: "already confirmed" }, 400);
  }

  const drafts = (body.drafts as DraftRow[] | undefined) ||
    (JSON.parse(scan.draftJson || "[]") as DraftRow[]);
  const sheetDate = dayjs(scan.sheetDate || scan.createdAt).format("YYYY-MM-DD");
  const carerId = body.carerId || null;
  const inputs = draftRowsToRecordInputs(drafts, sheetDate, scan.babyId, carerId);

  const created = await prisma.$transaction(async (tx) => {
    const records = [];
    for (const input of inputs) {
      records.push(await tx.record.create({ data: input }));
    }
    await tx.paperScan.update({
      where: { id },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
        draftJson: JSON.stringify(drafts),
      },
    });
    return records;
  });

  return c.json({
    ok: true,
    createdCount: created.length,
    records: created.map((r) => ({
      ...r,
      payload: JSON.parse(r.payload || "{}"),
    })),
  });
});

app.post("/api/media", async (c) => {
  await ensureUploadDir();
  const form = await c.req.parseBody();
  const babyId = String(form.babyId || "");
  const recordId = form.recordId ? String(form.recordId) : null;
  const carerId = form.carerId ? String(form.carerId) : null;
  const caption = form.caption ? String(form.caption) : null;
  const takenAt = form.takenAt
    ? new Date(String(form.takenAt))
    : new Date();
  const file = form.file;
  if (!babyId || !file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return c.json({ error: "babyId and file required" }, 400);
  }
  const f = file as File;
  const buffer = Buffer.from(await f.arrayBuffer());
  const ext = path.extname(f.name || "") || ".jpg";
  const filename = `media-${Date.now()}${ext}`;
  await fs.writeFile(path.join(config.uploadDir, filename), buffer);
  const media = await prisma.media.create({
    data: {
      babyId,
      recordId,
      carerId,
      filename,
      mimeType: f.type || "application/octet-stream",
      takenAt,
      caption,
    },
  });
  return c.json({ media });
});

app.get("/api/media", async (c) => {
  const babyId = c.req.query("babyId");
  const month = c.req.query("month"); // YYYY-MM
  if (!babyId) return c.json({ error: "babyId required" }, 400);
  let start: Date | undefined;
  let end: Date | undefined;
  if (month) {
    start = dayjs(`${month}-01`).startOf("month").toDate();
    end = dayjs(`${month}-01`).endOf("month").toDate();
  }
  const media = await prisma.media.findMany({
    where: {
      babyId,
      ...(start && end ? { takenAt: { gte: start, lte: end } } : {}),
    },
    orderBy: { takenAt: "desc" },
  });
  return c.json({ media });
});

app.get("/api/media/file/:filename", async (c) => {
  const filename = c.req.param("filename");
  if (!/^[\w.-]+$/.test(filename)) return c.text("Not found", 404);
  const full = path.join(config.uploadDir, filename);
  try {
    const buf = await fs.readFile(full);
    const media = await prisma.media.findFirst({ where: { filename } });
    const scan = media
      ? null
      : await prisma.paperScan.findFirst({ where: { filename } });
    const mime =
      media?.mimeType || scan?.mimeType || "application/octet-stream";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return c.text("Not found", 404);
  }
});

app.delete("/api/media/:id", async (c) => {
  const id = c.req.param("id");
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return c.json({ error: "not found" }, 404);
  await prisma.media.delete({ where: { id } });
  try {
    await fs.unlink(path.join(config.uploadDir, media.filename));
  } catch {
    // ignore missing file
  }
  return c.json({ ok: true });
});

app.get("/api/export/csv", async (c) => {
  const babyId = c.req.query("babyId");
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!babyId) return c.json({ error: "babyId required" }, 400);
  const records = await prisma.record.findMany({
    where: {
      babyId,
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: dayjs(from).startOf("day").toDate() } : {}),
              ...(to ? { lte: dayjs(to).endOf("day").toDate() } : {}),
            },
          }
        : {}),
    },
    include: { carer: true },
    orderBy: { occurredAt: "asc" },
  });
  const csv = recordsToCsv(records);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="baby-records.csv"`,
    },
  });
});

app.get("/api/export/pdf", async (c) => {
  const babyId = c.req.query("babyId");
  const mode = c.req.query("mode") || "day"; // day | week
  const date = c.req.query("date") || dayjs().format("YYYY-MM-DD");
  if (!babyId) return c.json({ error: "babyId required" }, 400);
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby) return c.json({ error: "baby not found" }, 404);

  let start = dayjs(date).startOf("day");
  let end = dayjs(date).endOf("day");
  let title = "宝宝日汇总";
  let rangeLabel = start.format("YYYY-MM-DD");
  if (mode === "week") {
    start = dayjs(date).startOf("week");
    end = dayjs(date).endOf("week");
    title = "宝宝周汇总";
    rangeLabel = `${start.format("YYYY-MM-DD")} ~ ${end.format("YYYY-MM-DD")}`;
  }

  const records = await prisma.record.findMany({
    where: {
      babyId,
      occurredAt: { gte: start.toDate(), lte: end.toDate() },
    },
    include: { carer: true },
    orderBy: { occurredAt: "asc" },
  });

  const pdf = await buildSummaryPdf({
    title,
    babyName: baby.name,
    rangeLabel,
    records,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="baby-${mode}-summary.pdf"`,
    },
  });
});

app.onError((err, c) => {
  console.error(err);
  if (err instanceof z.ZodError) {
    return c.json({ error: "validation failed", details: err.flatten() }, 400);
  }
  return c.json({ error: err.message || "server error" }, 500);
});

const webDist = path.join(config.root, "web/dist");
try {
  await fs.access(webDist);
  app.use(
    "/*",
    serveStatic({
      root: webDist,
      rewriteRequestPath: (p) => (p === "/" ? "/index.html" : p),
    }),
  );
  app.get("*", async (c) => {
    if (c.req.path.startsWith("/api") || c.req.path.startsWith("/templates")) {
      return c.text("Not found", 404);
    }
    const html = await fs.readFile(path.join(webDist, "index.html"), "utf8");
    return c.html(html);
  });
} catch {
  // Dev mode: Vite serves the SPA separately.
}

await ensureUploadDir();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
