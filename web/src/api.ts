export type Baby = {
  id: string;
  name: string;
  birthday: string;
  gender: string;
  notes?: string | null;
};

export type Carer = {
  id: string;
  name: string;
  role: string;
};

export type RecordItem = {
  id: string;
  type: string;
  occurredAt: string;
  endAt?: string | null;
  payload: Record<string, unknown>;
  note?: string | null;
  source: string;
  carer?: Carer | null;
  media?: MediaItem[];
};

export type MediaItem = {
  id: string;
  filename: string;
  mimeType: string;
  takenAt: string;
  caption?: string | null;
  recordId?: string | null;
};

export type Summary = {
  feedCount: number;
  bottleMl: number;
  breastMinutes: number;
  wetCount: number;
  dirtyCount: number;
  sleepMinutes: number;
  sleepHours: number;
  recordCount: number;
};

export type DraftRow = {
  time: string;
  leftMinutes?: number | null;
  rightMinutes?: number | null;
  amountMl?: number | null;
  wet?: boolean;
  dirty?: boolean;
  note?: string | null;
  sleepStart?: string | null;
  sleepEnd?: string | null;
  confidence?: number;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return undefined as T;
}

export const api = {
  bootstrap() {
    return request<{
      family: { id: string; name: string };
      babies: Baby[];
      carers: Carer[];
      templates: Array<{ id: string; title: string; path: string }>;
    }>("/api/bootstrap");
  },
  today(babyId: string, date?: string) {
    const q = new URLSearchParams({ babyId });
    if (date) q.set("date", date);
    return request<{
      date: string;
      summary: Summary;
      timeline: RecordItem[];
      lastFeed: RecordItem | null;
      activeSleep: RecordItem | null;
    }>(`/api/dashboard/today?${q}`);
  },
  records(babyId: string, params: Record<string, string> = {}) {
    const q = new URLSearchParams({ babyId, ...params });
    return request<{ records: RecordItem[]; summary: Summary }>(
      `/api/records?${q}`,
    );
  },
  createRecord(body: unknown) {
    return request<{ record: RecordItem }>("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  deleteRecord(id: string) {
    return request<{ ok: boolean }>(`/api/records/${id}`, { method: "DELETE" });
  },
  async scanPaper(form: FormData) {
    return request<{
      scan: {
        id: string;
        sheetDate?: string;
        status: string;
        rawText?: string;
        drafts: DraftRow[];
        filename: string;
      };
    }>("/api/paper/scan", { method: "POST", body: form });
  },
  updateScan(id: string, body: unknown) {
    return request(`/api/paper/scans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  confirmScan(id: string, body: unknown) {
    return request<{ ok: boolean; createdCount: number }>(
      `/api/paper/scans/${id}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  },
  listScans(babyId: string) {
    return request<{
      scans: Array<{
        id: string;
        status: string;
        createdAt: string;
        sheetDate?: string;
        drafts: DraftRow[];
      }>;
    }>(`/api/paper/scans?babyId=${babyId}`);
  },
  async uploadMedia(form: FormData) {
    return request<{ media: MediaItem }>("/api/media", {
      method: "POST",
      body: form,
    });
  },
  listMedia(babyId: string, month?: string) {
    const q = new URLSearchParams({ babyId });
    if (month) q.set("month", month);
    return request<{ media: MediaItem[] }>(`/api/media?${q}`);
  },
  mediaUrl(filename: string) {
    return `/api/media/file/${filename}`;
  },
  exportCsvUrl(babyId: string, from?: string, to?: string) {
    const q = new URLSearchParams({ babyId });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return `/api/export/csv?${q}`;
  },
  exportPdfUrl(babyId: string, mode: "day" | "week", date: string) {
    const q = new URLSearchParams({ babyId, mode, date });
    return `/api/export/pdf?${q}`;
  },
};
