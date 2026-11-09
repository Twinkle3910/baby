import { reactive, readonly } from "vue";
import { api, type Baby, type Carer } from "../api";

const state = reactive({
  ready: false,
  familyName: "",
  babies: [] as Baby[],
  carers: [] as Carer[],
  babyId: "",
  carerId: "",
  templates: [] as Array<{ id: string; title: string; path: string }>,
  toast: "" as string,
});

let toastTimer: number | undefined;

export function useSession() {
  async function bootstrap() {
    const data = await api.bootstrap();
    state.familyName = data.family.name;
    state.babies = data.babies;
    state.carers = data.carers;
    state.templates = data.templates;
    state.babyId = data.babies[0]?.id || "";
    state.carerId =
      data.carers.find((c) => c.role === "parent")?.id ||
      data.carers[0]?.id ||
      "";
    state.ready = true;
  }

  function toast(msg: string) {
    state.toast = msg;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      state.toast = "";
    }, 2200);
  }

  return {
    state: readonly(state),
    mutable: state,
    bootstrap,
    toast,
  };
}
