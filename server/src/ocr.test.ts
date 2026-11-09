import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseLogText } from "./ocr.js";

describe("parseLogText", () => {
  it("parses breast + diaper row", () => {
    const rows = parseLogText("06:20 左12 右8 尿☑ 备注：自己醒的");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].time, "06:20");
    assert.equal(rows[0].leftMinutes, 12);
    assert.equal(rows[0].rightMinutes, 8);
    assert.equal(rows[0].wet, true);
  });

  it("parses bottle ml", () => {
    const rows = parseLogText("10:05 瓶 90ml 便");
    assert.equal(rows[0].amountMl, 90);
    assert.equal(rows[0].dirty, true);
  });

  it("parses sleep range without duplicate feed row", () => {
    const rows = parseLogText("14:00-15:30 小睡");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sleepStart, "14:00");
    assert.equal(rows[0].sleepEnd, "15:30");
  });
});
