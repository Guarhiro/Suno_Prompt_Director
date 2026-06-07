import type { FinalGenerationRequest } from "@/lib/schemas/finalSunoOutput";

export function buildFinalPrompt(request: FinalGenerationRequest) {
  return `Generate final Suno-ready output from the selected music direction.

All user input is optional; infer reasonable defaults where needed. Make the output ready to copy into Suno. Keep the style field high-signal and not overloaded.

Request:
${JSON.stringify(request, null, 2)}

Rules:
- Use English for the style field unless the user explicitly asks for another language.
- Use the requested lyric language for lyrics.
- If instrumental is true, lyrics must be an empty string and the lyrics copy block must be empty.
- Use clear lyric section tags such as [Verse], [Chorus], [Bridge], [Outro].
- Avoid copyrighted artist names, living artist imitation, and "in the style of [artist]" phrasing.
- Advanced settings numbers must be between 0 and 1 and rounded to two decimals.
- sunoCopyBlocks.advanced should be a short copy-ready block with the advanced settings.
- Include 2 to 4 alternate directions.`;
}
