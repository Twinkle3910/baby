<script setup lang="ts">
import { reactive, ref } from "vue";
import dayjs from "dayjs";
import { api } from "../api";
import { useSession } from "../composables/useSession";

const { state, mutable, toast } = useSession();
const type = ref<"feeding" | "diaper" | "sleep" | "growth" | "note">("feeding");

const form = reactive({
  occurredAt: dayjs().format("YYYY-MM-DDTHH:mm"),
  endAt: "",
  method: "bottle_formula" as string,
  leftMinutes: 10,
  rightMinutes: 10,
  amountMl: 90,
  foodName: "",
  wet: true,
  dirty: false,
  weightKg: 3.5,
  heightCm: 52,
  headCm: 35,
  note: "",
});

async function submit() {
  if (!state.babyId) return;
  const occurredAt = dayjs(form.occurredAt).toISOString();
  let payload: Record<string, unknown> = {};
  let endAt: string | null = null;

  if (type.value === "feeding") {
    payload = {
      method: form.method,
      leftMinutes: form.method === "breast" ? Number(form.leftMinutes) : null,
      rightMinutes: form.method === "breast" ? Number(form.rightMinutes) : null,
      amountMl:
        form.method.startsWith("bottle") || form.method === "solid"
          ? Number(form.amountMl)
          : null,
      foodName: form.method === "solid" ? form.foodName : null,
    };
  } else if (type.value === "diaper") {
    payload = { wet: form.wet, dirty: form.dirty };
  } else if (type.value === "sleep") {
    payload = { quality: "ok" };
    endAt = form.endAt ? dayjs(form.endAt).toISOString() : null;
  } else if (type.value === "growth") {
    payload = {
      weightKg: Number(form.weightKg),
      heightCm: Number(form.heightCm),
      headCm: Number(form.headCm),
    };
  } else {
    payload = { tags: [] };
  }

  await api.createRecord({
    babyId: state.babyId,
    carerId: state.carerId,
    type: type.value,
    occurredAt,
    endAt,
    payload,
    note: form.note || null,
    source: "manual",
  });
  toast("已保存");
  form.note = "";
}
</script>

<template>
  <section class="panel">
    <h2>快捷补记</h2>
    <div class="field">
      <label>记录人</label>
      <select v-model="mutable.carerId">
        <option v-for="c in state.carers" :key="c.id" :value="c.id">
          {{ c.name }}（{{ c.role }}）
        </option>
      </select>
    </div>

    <div class="chip-row" style="margin-bottom: 12px">
      <button
        v-for="t in [
          ['feeding', '喂养'],
          ['diaper', '尿布'],
          ['sleep', '睡眠'],
          ['growth', '成长'],
          ['note', '备注'],
        ]"
        :key="t[0]"
        class="chip"
        :class="{ active: type === t[0] }"
        @click="type = t[0] as any"
      >
        {{ t[1] }}
      </button>
    </div>

    <div class="field">
      <label>时间</label>
      <input v-model="form.occurredAt" type="datetime-local" />
    </div>

    <template v-if="type === 'feeding'">
      <div class="chip-row" style="margin-bottom: 10px">
        <button
          class="chip"
          :class="{ active: form.method === 'breast' }"
          @click="form.method = 'breast'"
        >
          亲喂
        </button>
        <button
          class="chip"
          :class="{ active: form.method === 'bottle_formula' }"
          @click="form.method = 'bottle_formula'"
        >
          配方奶
        </button>
        <button
          class="chip"
          :class="{ active: form.method === 'bottle_breastmilk' }"
          @click="form.method = 'bottle_breastmilk'"
        >
          母乳瓶喂
        </button>
        <button
          class="chip"
          :class="{ active: form.method === 'solid' }"
          @click="form.method = 'solid'"
        >
          辅食
        </button>
      </div>
      <div v-if="form.method === 'breast'" class="row">
        <div class="field">
          <label>左（分）</label>
          <input v-model.number="form.leftMinutes" type="number" min="0" />
        </div>
        <div class="field">
          <label>右（分）</label>
          <input v-model.number="form.rightMinutes" type="number" min="0" />
        </div>
      </div>
      <div v-else-if="form.method === 'solid'" class="row">
        <div class="field">
          <label>食物</label>
          <input v-model="form.foodName" placeholder="米粉 / 南瓜" />
        </div>
        <div class="field">
          <label>大约量</label>
          <input v-model.number="form.amountMl" type="number" />
        </div>
      </div>
      <div v-else class="field">
        <label>实际喝下 ml</label>
        <input v-model.number="form.amountMl" type="number" min="0" step="5" />
      </div>
    </template>

    <template v-else-if="type === 'diaper'">
      <div class="chip-row" style="margin-bottom: 10px">
        <button class="chip" :class="{ active: form.wet }" @click="form.wet = !form.wet">
          尿尿 {{ form.wet ? "✓" : "" }}
        </button>
        <button
          class="chip"
          :class="{ active: form.dirty }"
          @click="form.dirty = !form.dirty"
        >
          便便 {{ form.dirty ? "✓" : "" }}
        </button>
      </div>
    </template>

    <template v-else-if="type === 'sleep'">
      <div class="field">
        <label>结束时间（可空=进行中）</label>
        <input v-model="form.endAt" type="datetime-local" />
      </div>
    </template>

    <template v-else-if="type === 'growth'">
      <div class="row">
        <div class="field">
          <label>体重 kg</label>
          <input v-model.number="form.weightKg" type="number" step="0.1" />
        </div>
        <div class="field">
          <label>身高 cm</label>
          <input v-model.number="form.heightCm" type="number" step="0.1" />
        </div>
      </div>
      <div class="field">
        <label>头围 cm</label>
        <input v-model.number="form.headCm" type="number" step="0.1" />
      </div>
    </template>

    <div class="field">
      <label>备注</label>
      <textarea v-model="form.note" rows="2" placeholder="可选" />
    </div>

    <button class="btn btn-primary" style="width: 100%" @click="submit">
      保存记录
    </button>
  </section>
</template>
