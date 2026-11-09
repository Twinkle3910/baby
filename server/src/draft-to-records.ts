import dayjs from "dayjs";
import type { DraftRow } from "./types.js";

export function draftRowsToRecordInputs(
  rows: DraftRow[],
  sheetDate: string,
  babyId: string,
  carerId?: string | null,
) {
  const base = dayjs(sheetDate).format("YYYY-MM-DD");
  const inputs: Array<{
    babyId: string;
    carerId?: string | null;
    type: string;
    occurredAt: Date;
    endAt?: Date | null;
    payload: string;
    note?: string | null;
    source: string;
  }> = [];

  for (const row of rows) {
    const occurredAt = dayjs(`${base}T${row.time}:00`).toDate();

    if (row.sleepStart && row.sleepEnd) {
      inputs.push({
        babyId,
        carerId,
        type: "sleep",
        occurredAt: dayjs(`${base}T${row.sleepStart}:00`).toDate(),
        endAt: dayjs(`${base}T${row.sleepEnd}:00`).toDate(),
        payload: JSON.stringify({ quality: "ok" }),
        note: row.note || null,
        source: "paper_ocr",
      });
      continue;
    }

    const hasBreast = row.leftMinutes != null || row.rightMinutes != null;
    const hasBottle = row.amountMl != null;
    if (hasBreast || hasBottle) {
      inputs.push({
        babyId,
        carerId,
        type: "feeding",
        occurredAt,
        payload: JSON.stringify({
          method: hasBottle ? "bottle_formula" : "breast",
          leftMinutes: row.leftMinutes ?? null,
          rightMinutes: row.rightMinutes ?? null,
          amountMl: row.amountMl ?? null,
        }),
        note: row.note || null,
        source: "paper_ocr",
      });
    }

    if (row.wet || row.dirty) {
      inputs.push({
        babyId,
        carerId,
        type: "diaper",
        occurredAt,
        payload: JSON.stringify({
          wet: !!row.wet,
          dirty: !!row.dirty,
        }),
        note: null,
        source: "paper_ocr",
      });
    }

    if (!hasBreast && !hasBottle && !row.wet && !row.dirty && row.note) {
      inputs.push({
        babyId,
        carerId,
        type: "note",
        occurredAt,
        payload: JSON.stringify({ tags: ["paper"] }),
        note: row.note,
        source: "paper_ocr",
      });
    }
  }

  return inputs;
}
