import { z } from "zod";
import { DirectionItemSchema } from "./directionProposal";
import { FinalSunoOutputSchema } from "./finalSunoOutput";
import { SongInputSchema } from "./songInput";

export const ReviseModeSchema = z.enum(["new", "cover"]);

export const RevisionRequestSchema = z.object({
  mode: ReviseModeSchema,
  optionIds: z.array(z.string()).optional().default([]),
  optionLabels: z.array(z.string()).optional().default([]),
  freeText: z.string().optional().default(""),
  sourceTitle: z.string().optional().default(""),
  sourceStyle: z.string().optional().default(""),
  sourceLyrics: z.string().optional().default(""),
  input: SongInputSchema,
  selectedDirection: DirectionItemSchema.optional(),
  finalOutput: FinalSunoOutputSchema.optional()
});

export const RevisedSunoOutputSchema = z.object({
  summary: z.string(),
  modeStrategy: z.string(),
  revisedTitle: z.string(),
  revisedStyle: z.string(),
  revisedLyrics: z.string(),
  styleChanges: z.array(z.string()),
  lyricChanges: z.array(z.string()),
  arrangementNotes: z.array(z.string()),
  warnings: z.array(z.string()),
  copyBlocks: z.object({
    title: z.string(),
    style: z.string(),
    lyrics: z.string(),
    notes: z.string()
  })
});

export type RevisionRequest = z.infer<typeof RevisionRequestSchema>;
export type RevisedSunoOutput = z.infer<typeof RevisedSunoOutputSchema>;

export const revisedSunoOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "modeStrategy",
    "revisedTitle",
    "revisedStyle",
    "revisedLyrics",
    "styleChanges",
    "lyricChanges",
    "arrangementNotes",
    "warnings",
    "copyBlocks"
  ],
  properties: {
    summary: { type: "string" },
    modeStrategy: { type: "string" },
    revisedTitle: { type: "string" },
    revisedStyle: { type: "string" },
    revisedLyrics: { type: "string" },
    styleChanges: { type: "array", items: { type: "string" } },
    lyricChanges: { type: "array", items: { type: "string" } },
    arrangementNotes: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    copyBlocks: {
      type: "object",
      additionalProperties: false,
      required: ["title", "style", "lyrics", "notes"],
      properties: {
        title: { type: "string" },
        style: { type: "string" },
        lyrics: { type: "string" },
        notes: { type: "string" }
      }
    }
  }
} as const;
