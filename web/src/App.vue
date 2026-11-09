<script setup lang="ts">
import { onMounted } from "vue";
import { useSession } from "./composables/useSession";

const { state, bootstrap } = useSession();

onMounted(async () => {
  try {
    await bootstrap();
  } catch (e) {
    console.error(e);
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="brand-lockup">
      <div class="brand">宝宝纸本助手</div>
      <div class="tagline">纸上好写 · 手机好管 · 可导出交接</div>
    </header>

    <div v-if="!state.ready" class="panel">正在加载家庭数据…</div>
    <router-view v-else />

    <nav class="bottom-nav">
      <router-link to="/">今日</router-link>
      <router-link to="/add">快记</router-link>
      <router-link to="/paper">拍本</router-link>
      <router-link to="/album">相册</router-link>
      <router-link to="/export">导出</router-link>
    </nav>

    <div v-if="state.toast" class="toast">{{ state.toast }}</div>
  </div>
</template>
