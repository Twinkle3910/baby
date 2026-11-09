import PDFDocument from "pdfkit";
import type { Record as BabyRecord } from "@prisma/client";
import fs from "node:fs";
import { summarizeRecords } from "./summary.js";
import dayjs from "dayjs";

type Rec = BabyRecord & { carer?: { name: string } | null };

const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
  "/System/Library/Fonts/PingFang.ttc",
  "C:\\Windows\\Fonts\\msyh.ttc",
];

function resolveFont(): string | null {
  for (const f of FONT_CANDIDATES) {
    if (fs.existsSync(f)) return f;
  }
  return null;
}

export async function buildSummaryPdf(opts: {
  title: string;
  babyName: string;
  rangeLabel: string;
  records: Rec[];
}): Promise<Buffer> {
  const summary = summarizeRecords(opts.records);
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const chunks: Buffer[] = [];
  const fontPath = resolveFont();
  if (fontPath) {
    try {
      doc.registerFont("CN", fontPath);
      doc.font("CN");
    } catch {
      // fall back to default Helvetica (Latin only)
    }
  }

  return await new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(opts.title, { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#444").text(`宝宝：${opts.babyName}`);
    doc.text(`区间：${opts.rangeLabel}`);
    doc.text(`生成时间：${dayjs().format("YYYY-MM-DD HH:mm")}`);
    doc.moveDown();
    doc.fillColor("#000").fontSize(13).text("汇总");
    doc.fontSize(11).fillColor("#222");
    doc.text(`喂养次数：${summary.feedCount}`);
    doc.text(`瓶喂总奶量：${summary.bottleMl} ml`);
    doc.text(`亲喂总时长：${summary.breastMinutes} 分钟`);
    doc.text(`尿尿：${summary.wetCount} 次 · 便便：${summary.dirtyCount} 次`);
    doc.text(`睡眠约：${summary.sleepHours} 小时（${summary.sleepMinutes} 分钟）`);
    doc.moveDown();
    doc.fontSize(13).fillColor("#000").text("明细");
    doc.moveDown(0.3);

    for (const r of opts.records) {
      const when = dayjs(r.occurredAt).format("MM-DD HH:mm");
      const end = r.endAt ? ` → ${dayjs(r.endAt).format("HH:mm")}` : "";
      let detail = "";
      try {
        const p = JSON.parse(r.payload || "{}") as { [key: string]: unknown };
        detail = Object.entries(p)
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
      } catch {
        detail = r.payload;
      }
      const carer = r.carer?.name ? ` · ${r.carer.name}` : "";
      const note = r.note ? ` · ${r.note}` : "";
      doc
        .fontSize(10)
        .fillColor("#111")
        .text(`${when}${end}  [${r.type}]${carer}  ${detail}${note}`, {
          width: 500,
        });
    }

    if (opts.records.length === 0) {
      doc.fontSize(11).fillColor("#666").text("本区间暂无记录。");
    }

    doc.moveDown(1.5);
    doc
      .fontSize(9)
      .fillColor("#888")
      .text("Baby Paper Hybrid · 仅供家庭交接与就诊参考，不构成医疗建议。");
    doc.end();
  });
}
