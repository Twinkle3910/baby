<script setup lang="ts">
import { ref } from "vue";
import dayjs from "dayjs";
import { api, type DraftRow } from "../api";
import { useSession } from "../composables/useSession";

const { state, toast } = useSession();
const sheetDate = ref(dayjs().format("YYYY-MM-DD"));
const pastedText = ref("");
const file = ref<File | null>(null);
const scanId = ref("");
const drafts = ref<DraftRow[]>([]);
const rawText = ref("");
const busy = ref(false);

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  file.value = input.files?.[0] || null;
}

function addRow() {
  drafts.value.push({
    time: dayjs().format("HH:mm"),
    leftMinutes: null,
    rightMinutes: null,
    amountMl: null,
    wet: false,
    dirty: false,
    note: "",
  });
}

function removeRow(i: number) {
  drafts.value.splice(i, 1);
}

async function scan() {
  if (!state.babyId) return;
  busy.value = true;
  try {
    const form = new FormData();
    form.set("babyId", state.babyId);
    form.set("sheetDate", sheetDate.value);
    if (pastedText.value.trim()) form.set("pastedText", pastedText.value.trim());
    if (file.value) form.set("file", file.value);
    const res = await api.scanPaper(form);
    scanId.value = res.scan.id;
    drafts.value = res.scan.drafts;
    rawText.value = res.scan.rawText || "";
    toast("已生成草稿，请核对后入库");
  } catch (e) {
    toast(e instanceof Error ? e.message : "识别失败");
  } finally {
    busy.value = false;
  }
}

async function confirm() {
  if (!scanId.value) return;
  busy.value = true;
  try {
    await api.updateScan(scanId.value, { drafts: drafts.value, sheetDate: sheetDate.value });
    const res = await api.confirmScan(scanId.value, {
      drafts: drafts.value,
      carerId: state.carerId,
    });
    toast(`已入库 ${res.createdCount} 条`);
    drafts.value = [];
    scanId.value = "";
    pastedText.value = "";
    file.value = null;
  } catch (e) {
    toast(e instanceof Error ? e.message : "确认失败");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="panel">
    <h2>拍本数字化</h2>
    <p class="empty">
      保姆只填纸表。家长拍照或粘贴转写文字 → 生成草稿 → 核对后一键入库。
      未配置云 OCR 时，会给出示例草稿，也可粘贴文本解析。
    </p>

    <div class="field">
      <label>纸表日期</label>
      <input v-model="sheetDate" type="date" />
    </div>
    <div class="field">
      <label>拍照 / 选图</label>
      <input type="file" accept="image/*" capture="environment" @change="onFile" />
    </div>
    <div class="field">
      <label>或粘贴转写文本（推荐）</label>
      <textarea
        v-model="pastedText"
        rows="4"
        placeholder="例：&#10;06:20 左12 右8 尿☑ 自己醒的&#10;09:40 90ml 便&#10;14:00-15:20 小睡"
      />
    </div>
    <button class="btn btn-accent" style="width: 100%" :disabled="busy" @click="scan">
      {{ busy ? "处理中…" : "生成草稿" }}
    </button>

    <div style="margin-top: 12px" class="chip-row">
      <a
        v-for="t in state.templates"
        :key="t.id"
        class="chip"
        :href="t.path"
        target="_blank"
        rel="noopener"
      >
        {{ t.title }}
      </a>
    </div>
  </section>

  <section v-if="drafts.length" class="panel">
    <h2>核对草稿</h2>
    <p v-if="rawText" class="empty" style="white-space: pre-wrap">{{ rawText }}</p>
    <div v-for="(row, i) in drafts" :key="i" class="item" style="grid-template-columns: 1fr; margin-bottom: 8px">
      <div class="row">
        <div class="field">
          <label>时间</label>
          <input v-model="row.time" type="time" />
        </div>
        <div class="field">
          <label>瓶喂 ml</label>
          <input v-model.number="row.amountMl" type="number" />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>左分</label>
          <input v-model.number="row.leftMinutes" type="number" />
        </div>
        <div class="field">
          <label>右分</label>
          <input v-model.number="row.rightMinutes" type="number" />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>睡起</label>
          <input v-model="row.sleepStart" type="time" />
        </div>
        <div class="field">
          <label>睡止</label>
          <input v-model="row.sleepEnd" type="time" />
        </div>
      </div>
      <div class="chip-row" style="margin-bottom: 8px">
        <button class="chip" :class="{ active: row.wet }" @click="row.wet = !row.wet">尿</button>
        <button class="chip" :class="{ active: row.dirty }" @click="row.dirty = !row.dirty">便</button>
        <button class="chip" @click="removeRow(i)">删行</button>
      </div>
      <div class="field">
        <label>备注</label>
        <input v-model="row.note" />
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-secondary" @click="addRow">加一行</button>
      <button class="btn btn-primary" :disabled="busy || !scanId" @click="confirm">
        确认入库
      </button>
    </div>
  </section>
</template>
