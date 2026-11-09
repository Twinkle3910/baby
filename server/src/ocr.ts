import type { DraftRow } from "./types.js";
import { config } from "./config.js";

/**
 * Parse handwritten / printed daily-log style text into draft rows.
 * Cloud OCR can be plugged in via OCR_PROVIDER=http + OCR_API_ENDPOINT.
 * Without credentials we use a heuristic parser that also accepts pasted text,
 * plus a demo sample when the image has no extractable text.
 */
export function parseLogText(rawText: string, sheetDate?: string): DraftRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: DraftRow[] = [];

  for (const line of lines) {
    // Sleep ranges first so "13:00-14:10 小睡" does not also become a sparse feed row.
    const sleep = line.match(
      /(\d{1,2})[:：.](\d{2})\s*[-~～到至]\s*(\d{1,2})[:：.](\d{2}).*(睡|nap|sleep)?/i,
    );
    const looksLikeSleep =
      !!sleep &&
      (/(睡|nap|sleep)/i.test(line) ||
        (!/左|右|瓶|ml|尿|便/i.test(line) && /[-~～到至]/.test(line)));
    if (looksLikeSleep && sleep) {
      rows.push({
        time: `${sleep[1].padStart(2, "0")}:${sleep[2]}`,
        sleepStart: `${sleep[1].padStart(2, "0")}:${sleep[2]}`,
        sleepEnd: `${sleep[3].padStart(2, "0")}:${sleep[4]}`,
        confidence: 0.65,
      });
      continue;
    }

    const timeMatch = line.match(/(\d{1,2})[:：点.](\d{2})/);
    if (!timeMatch) continue;

    const hh = timeMatch[1].padStart(2, "0");
    const mm = timeMatch[2];
    const time = `${hh}:${mm}`;

    const left =
      matchNumber(line, /左\s*[:=：]?\s*(\d{1,2})/) ??
      matchNumber(line, /L\s*[:=]?\s*(\d{1,2})/i);
    const right =
      matchNumber(line, /右\s*[:=：]?\s*(\d{1,2})/) ??
      matchNumber(line, /R\s*[:=]?\s*(\d{1,2})/i);
    const amount =
      matchNumber(line, /(\d{2,3})\s*ml/i) ??
      matchNumber(line, /瓶\s*[:=：]?\s*(\d{2,3})/);

    const wet = /尿|wet|☑.*尿|尿.*[✓✔☑xX]/.test(line);
    const dirty = /便|dirty|便便|大便|☑.*便|便.*[✓✔☑xX]/.test(line);

    let note: string | null = null;
    const noteMatch = line.match(/备注[:：]?\s*(.+)$/);
    if (noteMatch) note = noteMatch[1].trim();
    else {
      const cleaned = line
        .replace(timeMatch[0], "")
        .replace(/左\s*[:=：]?\s*\d{1,2}/g, "")
        .replace(/右\s*[:=：]?\s*\d{1,2}/g, "")
        .replace(/\d{2,3}\s*ml/gi, "")
        .replace(/[尿便☑✓✔□\[\]xX]/g, "")
        .replace(/[|｜]/g, " ")
        .trim();
      if (cleaned.length > 1) note = cleaned;
    }

    const hasFeed = left != null || right != null || amount != null;
    const hasDiaper = wet || dirty;
    if (!hasFeed && !hasDiaper && !note) continue;

    rows.push({
      time,
      leftMinutes: left,
      rightMinutes: right,
      amountMl: amount,
      wet,
      dirty,
      note,
      confidence: 0.7,
    });
  }

  if (rows.length === 0 && sheetDate) {
    // Keep empty — caller may inject demo draft for UX when OCR fails
  }

  return rows;
}

function matchNumber(text: string, re: RegExp): number | null {
  const m = text.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export async function extractTextFromImage(
  _buffer: Buffer,
  filename: string,
): Promise<{ text: string; provider: string }> {
  if (config.ocrProvider === "http" && config.ocrApiEndpoint) {
    // Placeholder for cloud OCR HTTP API; returns empty on failure.
    try {
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(_buffer)]),
        filename,
      );
      const res = await fetch(config.ocrApiEndpoint, {
        method: "POST",
        headers: config.ocrApiKey
          ? { Authorization: `Bearer ${config.ocrApiKey}` }
          : undefined,
        body: form,
      });
      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        return { text: data.text || "", provider: "http" };
      }
    } catch {
      // fall through to mock
    }
  }

  // Local mock: no real vision OCR without API keys.
  // Parents can still paste text, or we return a sample draft based on filename hints.
  return { text: "", provider: "mock" };
}

export function demoDraftRows(): DraftRow[] {
  return [
    {
      time: "06:20",
      leftMinutes: 12,
      rightMinutes: 8,
      wet: true,
      dirty: false,
      note: "自己醒的（示例草稿，请核对）",
      confidence: 0.4,
    },
    {
      time: "09:40",
      amountMl: 90,
      wet: false,
      dirty: true,
      note: "配方奶（示例草稿）",
      confidence: 0.4,
    },
    {
      time: "14:00",
      sleepStart: "14:00",
      sleepEnd: "15:20",
      note: "小睡（示例草稿）",
      confidence: 0.35,
    },
  ];
}
