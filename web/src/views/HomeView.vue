<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import dayjs from "dayjs";
import { api, type RecordItem, type Summary } from "../api";
import { useSession } from "../composables/useSession";
import { formatTime, recordMeta, recordTitle } from "../lib/format";

const { state, mutable, toast } = useSession();
const date = ref(dayjs().format("YYYY-MM-DD"));
const summary = ref<Summary | null>(null);
const timeline = ref<RecordItem[]>([]);
const lastFeed = ref<RecordItem | null>(null);
const loading = ref(false);

async function load() {
  if (!state.babyId) return;
  loading.value = true;
  try {
    const data = await api.today(state.babyId, date.value);
    summary.value = data.summary;
    timeline.value = data.timeline;
    lastFeed.value = data.lastFeed;
  } catch (e) {
    toast(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function removeItem(id: string) {
  if (!confirm("删除这条记录？")) return;
  await api.deleteRecord(id);
  toast("已删除");
  await load();
}

onMounted(load);
watch(() => state.babyId, load);
watch(date, load);
</script>

<template>
  <section class="panel">
    <div class="row" style="align-items: end">
      <div class="field" style="margin: 0">
        <label>宝宝</label>
        <select v-model="mutable.babyId">
          <option v-for="b in state.babies" :key="b.id" :value="b.id">
            {{ b.name }}
          </option>
        </select>
      </div>
      <div class="field" style="margin: 0">
        <label>日期</label>
        <input v-model="date" type="date" />
      </div>
    </div>
  </section>

  <section class="panel">
    <h2>今日概览</h2>
    <div v-if="summary" class="stats">
      <div class="stat">
        <div class="label">喂养</div>
        <div class="value">{{ summary.feedCount }}</div>
      </div>
      <div class="stat">
        <div class="label">瓶喂 ml</div>
        <div class="value">{{ summary.bottleMl }}</div>
      </div>
      <div class="stat">
        <div class="label">尿 / 便</div>
        <div class="value">{{ summary.wetCount }} / {{ summary.dirtyCount }}</div>
      </div>
      <div class="stat">
        <div class="label">睡眠 h</div>
        <div class="value">{{ summary.sleepHours }}</div>
      </div>
    </div>
    <p v-if="lastFeed" class="empty" style="margin-top: 10px">
      最近喂养 {{ formatTime(lastFeed.occurredAt) }} ·
      {{ recordTitle(lastFeed) }}
    </p>
    <p v-else class="empty">今天还没有喂养记录</p>
  </section>

  <section class="panel">
    <h2>时间轴 {{ loading ? "…" : "" }}</h2>
    <div v-if="timeline.length" class="timeline">
      <div v-for="item in timeline" :key="item.id" class="item">
        <div class="time">{{ formatTime(item.occurredAt) }}</div>
        <div>
          <div class="title">{{ recordTitle(item) }}</div>
          <div class="meta">{{ recordMeta(item) }}</div>
          <button class="btn btn-ghost" style="margin-top: 6px; padding: 4px 8px; font-size: 12px" @click="removeItem(item.id)">
            删除
          </button>
        </div>
      </div>
    </div>
    <div v-else class="empty">暂无记录。可去「快记」或「拍本」。</div>
  </section>
</template>
