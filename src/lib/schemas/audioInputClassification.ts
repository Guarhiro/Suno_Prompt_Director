import { z } from "zod";
import { AudioAnalysisResultSchema } from "./audioAnalysis";

export const AudioInputClassificationRequestSchema = z.object({
  analysis: AudioAnalysisResultSchema
});

export const AudioInputPatchSchema = z.object({
  moods: z.array(z.string()).max(6),
  genres: z.array(z.string()).max(5),
  bpmMin: z.number().int().min(40).max(240),
  bpmMax: z.number().int().min(40).max(240),
  vocalType: z.string(),
  vocalGender: z.enum(["m", "f", "auto"]),
  instrumental: z.boolean(),
  instruments: z.array(z.string()).max(7),
  structure: z.array(z.string()).max(10),
  priorities: z.array(z.string()).max(4),
  customMode: z.boolean(),
  styleWeight: z.number().min(0).max(1),
  weirdnessConstraint: z.number().min(0).max(1),
  audioWeight: z.number().min(0).max(1),
  advancedNotes: z.string()
});

export const AudioInputClassificationSchema = z.object({
  source: z.enum(["local", "ai"]),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  input: AudioInputPatchSchema,
  rationale: z.array(z.string()),
  warnings: z.array(z.string())
});

export type AudioInputClassificationRequest = z.infer<typeof AudioInputClassificationRequestSchema>;
export type AudioInputPatch = z.infer<typeof AudioInputPatchSchema>;
export type AudioInputClassification = z.infer<typeof AudioInputClassificationSchema>;

const audioInputPatchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "moods",
    "genres",
    "bpmMin",
    "bpmMax",
    "vocalType",
    "vocalGender",
    "instrumental",
    "instruments",
    "structure",
    "priorities",
    "customMode",
    "styleWeight",
    "weirdnessConstraint",
    "audioWeight",
    "advancedNotes"
  ],
  properties: {
    moods: { type: "array", maxItems: 6, items: { type: "string" } },
    genres: { type: "array", maxItems: 5, items: { type: "string" } },
    bpmMin: { type: "integer", minimum: 40, maximum: 240 },
    bpmMax: { type: "integer", minimum: 40, maximum: 240 },
    vocalType: { type: "string" },
    vocalGender: { type: "string", enum: ["m", "f", "auto"] },
    instrumental: { type: "boolean" },
    instruments: { type: "array", maxItems: 7, items: { type: "string" } },
    structure: { type: "array", maxItems: 10, items: { type: "string" } },
    priorities: { type: "array", maxItems: 4, items: { type: "string" } },
    customMode: { type: "boolean" },
    styleWeight: { type: "number", minimum: 0, maximum: 1 },
    weirdnessConstraint: { type: "number", minimum: 0, maximum: 1 },
    audioWeight: { type: "number", minimum: 0, maximum: 1 },
    advancedNotes: { type: "string" }
  }
} as const;

export const audioInputClassificationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["source", "summary", "confidence", "input", "rationale", "warnings"],
  properties: {
    source: { type: "string", enum: ["ai"] },
    summary: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    input: audioInputPatchJsonSchema,
    rationale: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } }
  }
} as const;
