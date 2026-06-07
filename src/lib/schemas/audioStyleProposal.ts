import { z } from "zod";
import { AudioAnalysisResultSchema } from "./audioAnalysis";

export const AudioStyleProposalRequestSchema = z.object({
  analysis: AudioAnalysisResultSchema,
  sourceStyle: z.string().optional().default(""),
  freeText: z.string().optional().default("")
});

export const AudioStyleProposalSchema = z.object({
  id: z.string(),
  name: z.string(),
  intent: z.string(),
  style: z.string(),
  negativeTags: z.string(),
  rationale: z.string(),
  bestUse: z.string(),
  cautions: z.array(z.string())
});

export const AudioStyleProposalOutputSchema = z.object({
  summary: z.string(),
  proposals: z.array(AudioStyleProposalSchema).min(3).max(3),
  warnings: z.array(z.string())
});

export type AudioStyleProposalRequest = z.infer<typeof AudioStyleProposalRequestSchema>;
export type AudioStyleProposal = z.infer<typeof AudioStyleProposalSchema>;
export type AudioStyleProposalOutput = z.infer<typeof AudioStyleProposalOutputSchema>;

export const audioStyleProposalOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "proposals", "warnings"],
  properties: {
    summary: { type: "string" },
    proposals: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "intent", "style", "negativeTags", "rationale", "bestUse", "cautions"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          intent: { type: "string" },
          style: { type: "string" },
          negativeTags: { type: "string" },
          rationale: { type: "string" },
          bestUse: { type: "string" },
          cautions: { type: "array", items: { type: "string" } }
        }
      }
    },
    warnings: { type: "array", items: { type: "string" } }
  }
} as const;
