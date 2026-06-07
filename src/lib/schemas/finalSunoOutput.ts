import { z } from "zod";
import { DirectionItemSchema } from "./directionProposal";
import { SongInputSchema } from "./songInput";

export const SunoModelSchema = z.enum(["V4", "V4_5", "V4_5PLUS", "V4_5ALL", "V5", "V5_5"]);

export const FinalSunoOutputSchema = z.object({
  titleCandidates: z.array(z.string()).min(1),
  selectedTitle: z.string(),
  recommendedModel: SunoModelSchema,
  customMode: z.boolean(),
  instrumental: z.boolean(),
  style: z.string(),
  lyrics: z.string(),
  negativeTags: z.string(),
  advancedSettings: z.object({
    styleWeight: z.number().min(0).max(1),
    weirdnessConstraint: z.number().min(0).max(1),
    audioWeight: z.number().min(0).max(1),
    vocalGender: z.preprocess((value) => (value === null ? undefined : value), z.enum(["m", "f"]).optional())
  }),
  sunoCopyBlocks: z.object({
    title: z.string(),
    style: z.string(),
    lyrics: z.string(),
    negativeTags: z.string(),
    advanced: z.string()
  }),
  rationale: z.object({
    bpmReason: z.string(),
    genreReason: z.string(),
    instrumentReason: z.string(),
    structureReason: z.string(),
    lyricsReason: z.string(),
    riskNotes: z.array(z.string())
  }),
  alternateDirections: z.array(
    z.object({
      name: z.string(),
      style: z.string(),
      negativeTags: z.string(),
      description: z.string()
    })
  )
});

export const FinalGenerationRequestSchema = z.object({
  input: SongInputSchema,
  selectedDirection: DirectionItemSchema.optional(),
  answers: z.record(z.string(), z.string()).optional().default({})
});

export type SunoModel = z.infer<typeof SunoModelSchema>;
export type FinalSunoOutput = z.infer<typeof FinalSunoOutputSchema>;
export type FinalGenerationRequest = z.infer<typeof FinalGenerationRequestSchema>;

export const finalSunoOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "titleCandidates",
    "selectedTitle",
    "recommendedModel",
    "customMode",
    "instrumental",
    "style",
    "lyrics",
    "negativeTags",
    "advancedSettings",
    "sunoCopyBlocks",
    "rationale",
    "alternateDirections"
  ],
  properties: {
    titleCandidates: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: { type: "string" }
    },
    selectedTitle: { type: "string" },
    recommendedModel: {
      type: "string",
      enum: ["V4", "V4_5", "V4_5PLUS", "V4_5ALL", "V5", "V5_5"]
    },
    customMode: { type: "boolean" },
    instrumental: { type: "boolean" },
    style: { type: "string" },
    lyrics: { type: "string" },
    negativeTags: { type: "string" },
    advancedSettings: {
      type: "object",
      additionalProperties: false,
      required: ["styleWeight", "weirdnessConstraint", "audioWeight", "vocalGender"],
      properties: {
        styleWeight: { type: "number", minimum: 0, maximum: 1 },
        weirdnessConstraint: { type: "number", minimum: 0, maximum: 1 },
        audioWeight: { type: "number", minimum: 0, maximum: 1 },
        vocalGender: { type: ["string", "null"], enum: ["m", "f", null] }
      }
    },
    sunoCopyBlocks: {
      type: "object",
      additionalProperties: false,
      required: ["title", "style", "lyrics", "negativeTags", "advanced"],
      properties: {
        title: { type: "string" },
        style: { type: "string" },
        lyrics: { type: "string" },
        negativeTags: { type: "string" },
        advanced: { type: "string" }
      }
    },
    rationale: {
      type: "object",
      additionalProperties: false,
      required: [
        "bpmReason",
        "genreReason",
        "instrumentReason",
        "structureReason",
        "lyricsReason",
        "riskNotes"
      ],
      properties: {
        bpmReason: { type: "string" },
        genreReason: { type: "string" },
        instrumentReason: { type: "string" },
        structureReason: { type: "string" },
        lyricsReason: { type: "string" },
        riskNotes: { type: "array", items: { type: "string" } }
      }
    },
    alternateDirections: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "style", "negativeTags", "description"],
        properties: {
          name: { type: "string" },
          style: { type: "string" },
          negativeTags: { type: "string" },
          description: { type: "string" }
        }
      }
    }
  }
} as const;
