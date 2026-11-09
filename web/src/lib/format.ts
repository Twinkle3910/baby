import dayjs from "dayjs";
import type { RecordItem } from "../api";

export function formatTime(iso: string) {
  return dayjs(iso).format("HH:mm");
}

export function formatDate(iso: string) {
  return dayjs(iso).format("YYYY-MM-DD");
}

export function recordTitle(r: RecordItem) {
  const p = r.payload || {};
  switch (r.type) {
    case "feeding": {
      if (p.method === "breast") {
        return `亲喂 左${p.leftMinutes ?? "-"}′ 右${p.rightMinutes ?? "-"}′`;
      }
      if (p.method === "solid") return `辅食 ${p.foodName || ""}`.trim();
      return `瓶喂 ${p.amountMl ?? "-"} ml`;
    }
    case "diaper":
      return `尿布 ${p.wet ? "尿" : ""}${p.dirty ? "便" : ""}${!p.wet && !p.dirty ? "更换" : ""}`;
    case "sleep":
      return r.endAt ? "睡眠" : "睡眠中";
    case "growth":
      return `成长 体重${p.weightKg ?? "-"}kg`;
    case "note":
      return "备注";
    default:
      return r.type;
  }
}

export function recordMeta(r: RecordItem) {
  const bits: string[] = [];
  if (r.carer?.name) bits.push(r.carer.name);
  if (r.endAt && r.type === "sleep") {
    bits.push(`${formatTime(r.occurredAt)}–${formatTime(r.endAt)}`);
  }
  if (r.source === "paper_ocr") bits.push("来自拍本");
  if (r.note) bits.push(r.note);
  return bits.join(" · ");
}
