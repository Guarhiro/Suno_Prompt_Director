import { z } from "zod";

export const SongInputSchema = z.object({
  useCase: z.string().optional().default(""),
  moods: z.array(z.string()).optional().default([]),
  genres: z.array(z.string()).optional().default([]),
  bpmMin: z.number().min(40).max(240).optional().default(90),
  bpmMax: z.number().min(40).max(240).optional().default(120),
  vocalType: z.string().optional().default(""),
  vocalGender: z.enum(["m", "f"]).optional(),
  instruments: z.array(z.string()).optional().default([]),
  structure: z.array(z.string()).optional().default([]),
  priorities: z.array(z.string()).optional().default([]),
  avoid: z.array(z.string()).optional().default([]),
  lyricLanguage: z.string().optional().default("日本語"),
  lyricTheme: z.string().optional().default(""),
  lyricLength: z.string().optional().default("標準"),
  instrumental: z.boolean().optional().default(false),
  customMode: z.boolean().optional().default(true),
  styleWeight: z.number().min(0).max(1).optional().default(0.64),
  weirdnessConstraint: z.number().min(0).max(1).optional().default(0.32),
  audioWeight: z.number().min(0).max(1).optional().default(0.48),
  advancedNotes: z.string().optional().default(""),
  freeText: z.string().optional().default("")
});

export type SongInput = z.infer<typeof SongInputSchema>;

export const songInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    useCase: { type: "string" },
    moods: { type: "array", items: { type: "string" } },
    genres: { type: "array", items: { type: "string" } },
    bpmMin: { type: "number", minimum: 40, maximum: 240 },
    bpmMax: { type: "number", minimum: 40, maximum: 240 },
    vocalType: { type: "string" },
    vocalGender: { type: "string", enum: ["m", "f"] },
    instruments: { type: "array", items: { type: "string" } },
    structure: { type: "array", items: { type: "string" } },
    priorities: { type: "array", items: { type: "string" } },
    avoid: { type: "array", items: { type: "string" } },
    lyricLanguage: { type: "string" },
    lyricTheme: { type: "string" },
    lyricLength: { type: "string" },
    instrumental: { type: "boolean" },
    customMode: { type: "boolean" },
    styleWeight: { type: "number", minimum: 0, maximum: 1 },
    weirdnessConstraint: { type: "number", minimum: 0, maximum: 1 },
    audioWeight: { type: "number", minimum: 0, maximum: 1 },
    advancedNotes: { type: "string" },
    freeText: { type: "string" }
  }
} as const;
