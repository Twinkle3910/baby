<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import dayjs from "dayjs";
import { api, type MediaItem } from "../api";
import { useSession } from "../composables/useSession";

const { state, toast } = useSession();
const month = ref(dayjs().format("YYYY-MM"));
const media = ref<MediaItem[]>([]);
const caption = ref("");
const file = ref<File | null>(null);

async function load() {
  if (!state.babyId) return;
  const res = await api.listMedia(state.babyId, month.value);
  media.value = res.media;
}

function onFile(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] || null;
}

async function upload() {
  if (!state.babyId || !file.value) {
    toast("请先选择照片");
    return;
  }
  const form = new FormData();
  form.set("babyId", state.babyId);
  form.set("carerId", state.carerId);
  form.set("caption", caption.value);
  form.set("takenAt", dayjs().toISOString());
  form.set("file", file.value);
  await api.uploadMedia(form);
  toast("照片已上传");
  caption.value = "";
  file.value = null;
  await load();
}

onMounted(load);
watch(() => state.babyId, load);
watch(month, load);
</script>

<template>
  <section class="panel">
    <h2>成长相册</h2>
    <p class="empty">把日常照片挂到月份里，后续可做周/月摘要。视频锦集留到二期。</p>
    <div class="field">
      <label>月份</label>
      <input v-model="month" type="month" />
    </div>
    <div class="field">
      <label>上传照片</label>
      <input type="file" accept="image/*" @change="onFile" />
    </div>
    <div class="field">
      <label>说明</label>
      <input v-model="caption" placeholder="第一次笑 / 满月" />
    </div>
    <button class="btn btn-primary" style="width: 100%" @click="upload">上传</button>
  </section>

  <section class="panel">
    <h2>{{ month }}</h2>
    <div v-if="media.length" class="photo-grid">
      <figure v-for="m in media" :key="m.id" style="margin: 0">
        <img :src="api.mediaUrl(m.filename)" :alt="m.caption || 'baby photo'" />
        <figcaption class="empty" style="font-size: 11px; margin-top: 4px">
          {{ m.caption || dayjs(m.takenAt).format("MM-DD HH:mm") }}
        </figcaption>
      </figure>
    </div>
    <div v-else class="empty">这个月还没有照片</div>
  </section>
</template>
