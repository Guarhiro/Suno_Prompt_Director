import type { SongInput } from "@/lib/schemas/songInput";

export function buildDirectionPrompt(input: SongInput) {
  return `Create a concise direction proposal for a Suno music prompt.

All fields are optional; infer reasonable defaults when blank. Keep the recommendations practical and easy for a casual user to choose.

User input:
${JSON.stringify(input, null, 2)}

Return:
- A short summary in Japanese.
- 3 or 4 recommended directions.
- At most 3 useful follow-up questions.

Question guidance:
- Ask only questions that would materially improve the final Suno prompt.
- Each question should have 2 to 4 clear option buttons.
- allowFreeText can be true when a user might want a custom answer.`;
}
