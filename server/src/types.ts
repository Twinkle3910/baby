export type RecordType = "feeding" | "diaper" | "sleep" | "growth" | "note";

export type FeedingPayload = {
  method: "breast" | "bottle_formula" | "bottle_breastmilk" | "solid";
  leftMinutes?: number | null;
  rightMinutes?: number | null;
  amountMl?: number | null;
  foodName?: string | null;
};

export type DiaperPayload = {
  wet: boolean;
  dirty: boolean;
  color?: string | null;
};

export type SleepPayload = {
  quality?: "good" | "ok" | "poor" | null;
};

export type GrowthPayload = {
  weightKg?: number | null;
  heightCm?: number | null;
  headCm?: number | null;
};

export type NotePayload = {
  tags?: string[];
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
