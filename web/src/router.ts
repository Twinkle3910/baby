import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import QuickAddView from "./views/QuickAddView.vue";
import PaperScanView from "./views/PaperScanView.vue";
import AlbumView from "./views/AlbumView.vue";
import ExportView from "./views/ExportView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/add", name: "add", component: QuickAddView },
    { path: "/paper", name: "paper", component: PaperScanView },
    { path: "/album", name: "album", component: AlbumView },
    { path: "/export", name: "export", component: ExportView },
  ],
});
