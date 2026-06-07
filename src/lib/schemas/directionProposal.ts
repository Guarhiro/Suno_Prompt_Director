import { z } from "zod";

export const DirectionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  genreBlend: z.array(z.string()),
  bpmRange: z.string(),
  keyMood: z.string(),
  recommendedInstruments: z.array(z.string()),
  vocalDirection: z.string(),
  structure: z.array(z.string()),
  strengths: z.array(z.string()),
  risks: z.array(z.string())
});

export const DirectionQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  reason: z.string(),
  options: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string()
    })
  ),
  allowFreeText: z.boolean()
});

export const DirectionProposalSchema = z.object({
  summary: z.string(),
  recommendedDirections: z.array(DirectionItemSchema).min(1),
  questions: z.array(DirectionQuestionSchema).max(3)
});

export type DirectionItem = z.infer<typeof DirectionItemSchema>;
export type DirectionQuestion = z.infer<typeof DirectionQuestionSchema>;
export type DirectionProposal = z.infer<typeof DirectionProposalSchema>;

const directionItemJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "description",
    "genreBlend",
    "bpmRange",
    "keyMood",
    "recommendedInstruments",
    "vocalDirection",
    "structure",
    "strengths",
    "risks"
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    genreBlend: { type: "array", items: { type: "string" } },
    bpmRange: { type: "string" },
    keyMood: { type: "string" },
    recommendedInstruments: { type: "array", items: { type: "string" } },
    vocalDirection: { type: "string" },
    structure: { type: "array", items: { type: "string" } },
    strengths: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } }
  }
} as const;

export const directionProposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "recommendedDirections", "questions"],
  properties: {
    summary: { type: "string" },
    recommendedDirections: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: directionItemJsonSchema
    },
    questions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "reason", "options", "allowFreeText"],
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          reason: { type: "string" },
          options: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label", "description"],
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                description: { type: "string" }
              }
            }
          },
          allowFreeText: { type: "boolean" }
        }
      }
    }
  }
} as const;
