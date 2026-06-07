import type { SunoModel } from "@/lib/schemas/finalSunoOutput";

export type SunoLimit = {
  promptMax: number;
  styleMax: number;
  titleMax: number;
};

export const SUNO_LIMITS: Record<SunoModel, SunoLimit> = {
  V4: {
    promptMax: 3000,
    styleMax: 200,
    titleMax: 80
  },
  V4_5: {
    promptMax: 5000,
    styleMax: 1000,
    titleMax: 100
  },
  V4_5PLUS: {
    promptMax: 5000,
    styleMax: 1000,
    titleMax: 100
  },
  V4_5ALL: {
    promptMax: 5000,
    styleMax: 1000,
    titleMax: 80
  },
  V5: {
    promptMax: 5000,
    styleMax: 1000,
    titleMax: 100
  },
  V5_5: {
    promptMax: 5000,
    styleMax: 1000,
    titleMax: 100
  }
};
