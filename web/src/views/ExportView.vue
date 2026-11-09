<script setup lang="ts">
import { ref } from "vue";
import dayjs from "dayjs";
import { api } from "../api";
import { useSession } from "../composables/useSession";

const { state } = useSession();
const date = ref(dayjs().format("YYYY-MM-DD"));
const from = ref(dayjs().subtract(6, "day").format("YYYY-MM-DD"));
const to = ref(dayjs().format("YYYY-MM-DD"));

function open(url: string) {
  window.open(url, "_blank");
}
</script>

<template>
  <section class="panel">
    <h2>导出与打印</h2>
    <p class="empty">就诊、交接或自己存档时，导出日/周 PDF 或 CSV。</p>

    <div class="field">
      <label>日 / 周汇总基准日</label>
      <input v-model="date" type="date" />
    </div>
    <div class="actions">
      <button
        class="btn btn-primary"
        @click="open(api.exportPdfUrl(state.babyId, 'day', date))"
      >
        导出日 PDF
      </button>
      <button
        class="btn btn-secondary"
        @click="open(api.exportPdfUrl(state.babyId, 'week', date))"
      >
        导出周 PDF
      </button>
    </div>
  </section>

  <section class="panel">
    <h2>CSV 明细</h2>
    <div class="row">
      <div class="field">
        <label>从</label>
        <input v-model="from" type="date" />
      </div>
      <div class="field">
        <label>到</label>
        <input v-model="to" type="date" />
      </div>
    </div>
    <button
      class="btn btn-accent"
      style="width: 100%"
      @click="open(api.exportCsvUrl(state.babyId, from, to))"
    >
      下载 CSV
    </button>
  </section>

  <section class="panel">
    <h2>纸表模板</h2>
    <div class="chip-row">
      <a
        v-for="t in state.templates"
        :key="t.id"
        class="chip"
        :href="t.path"
        target="_blank"
      >
        {{ t.title }}
      </a>
    </div>
  </section>
</template>
