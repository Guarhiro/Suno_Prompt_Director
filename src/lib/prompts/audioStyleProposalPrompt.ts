import type { AudioStyleProposalRequest } from "@/lib/schemas/audioStyleProposal";

export function buildAudioStyleProposalPrompt(request: AudioStyleProposalRequest) {
  return `Create three style reconstruction proposals from the audio analysis.

Request:
${JSON.stringify(request, null, 2)}

Goal:
- Turn imperfect audio analysis into practical, copy-ready Suno style prompts.
- Preserve the detected BPM/key/arrangement feel when confidence is useful.
- When confidence is low, write robust style language instead of pretending the analysis is certain.
- If sourceStyle is supplied, improve or reinterpret it using the analysis instead of ignoring it.
- If freeText is supplied, treat it as the user's desired direction.

Output rules:
- Return exactly 3 proposals.
- Write summary, intent, rationale, bestUse, cautions, and warnings in Japanese.
- Write style in rich Suno style-field language, mostly English, with Japanese terms only when clearer.
- Each style should be copy-ready as a single Suno style field.
- Each style can be moderately long when the extra words describe arrangement, instrumentation, vocal feel, section contrast, or production texture.
- Keep each style high-signal and avoid overloaded genre lists or filler phrases.
- Include BPM/key only when they help recreate the audio; mention uncertainty indirectly when confidence is low.
- Avoid copyrighted artist names, living artist imitation, and "in the style of [artist]" phrasing.
- id must be stable kebab-case, such as "faithful-rebuild", "suno-friendly-pop", "arrangement-focus".`;
}
