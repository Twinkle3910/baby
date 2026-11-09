import dayjs from "dayjs";
import type { Record as BabyRecord } from "@prisma/client";

function payloadOf(record: BabyRecord): { [key: string]: unknown } {
  try {
    return JSON.parse(record.payload || "{}") as { [key: string]: unknown };
  } catch {
    return {};
  }
}

export function summarizeRecords(records: BabyRecord[]) {
  let feedCount = 0;
  let bottleMl = 0;
  let breastMinutes = 0;
  let wetCount = 0;
  let dirtyCount = 0;
  let sleepMinutes = 0;
  const growth: Array<{ at: string; weightKg?: number; heightCm?: number; headCm?: number }> = [];

  for (const r of records) {
    const p = payloadOf(r);
    if (r.type === "feeding") {
      feedCount += 1;
      if (typeof p.amountMl === "number") bottleMl += p.amountMl;
      if (typeof p.leftMinutes === "number") breastMinutes += p.leftMinutes;
      if (typeof p.rightMinutes === "number") breastMinutes += p.rightMinutes;
    }
    if (r.type === "diaper") {
      if (p.wet) wetCount += 1;
      if (p.dirty) dirtyCount += 1;
    }
    if (r.type === "sleep") {
      const start = dayjs(r.occurredAt);
      const end = r.endAt ? dayjs(r.endAt) : start;
      sleepMinutes += Math.max(0, end.diff(start, "minute"));
    }
    if (r.type === "growth") {
      growth.push({
        at: r.occurredAt.toISOString(),
        weightKg: typeof p.weightKg === "number" ? p.weightKg : undefined,
        heightCm: typeof p.heightCm === "number" ? p.heightCm : undefined,
        headCm: typeof p.headCm === "number" ? p.headCm : undefined,
      });
    }
  }

  return {
    feedCount,
    bottleMl,
    breastMinutes,
    wetCount,
    dirtyCount,
    sleepMinutes,
    sleepHours: Math.round((sleepMinutes / 60) * 10) / 10,
    growth,
    recordCount: records.length,
  };
}

export function recordsToCsv(
  records: Array<BabyRecord & { carer?: { name: string } | null }>,
) {
  const header = [
    "id",
    "type",
    "occurredAt",
    "endAt",
    "carer",
    "payload",
    "note",
    "source",
  ];
  const lines = [header.join(",")];
  for (const r of records) {
    const cols = [
      r.id,
      r.type,
      r.occurredAt.toISOString(),
      r.endAt ? r.endAt.toISOString() : "",
      r.carer?.name || "",
      JSON.stringify(JSON.parse(r.payload || "{}")),
      (r.note || "").replaceAll('"', '""'),
      r.source,
    ].map((c) => `"${String(c)}"`);
    lines.push(cols.join(","));
  }
  return lines.join("\n");
}
