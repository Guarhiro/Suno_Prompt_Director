import type { RevisionRequest } from "@/lib/schemas/reviseSunoOutput";

export function buildRevisionPrompt(request: RevisionRequest) {
  return `Create a Suno-ready revision proposal.

Request:
${JSON.stringify(request, null, 2)}

Mode rules:
- mode "new": revise the current concept/final output into a new Suno prompt direction.
- mode "cover": assume Suno Cover. Preserve the original song's melody as much as possible while transforming genre, arrangement, instrumentation, key/BPM feel, and singing style according to the user's request.
- For cover mode, do not rewrite the melody concept; focus on style conversion, arrangement, vocal direction, and lyric edits that do not break the original melody.

Output rules:
- Write summary, modeStrategy, notes, warnings, and change lists in Japanese.
- Write revisedStyle in concise Suno style-tag language. Japanese terms are allowed when they are clearer for genres/instruments.
- Use the requested lyric language when lyrics are present.
- If the user selected an instrumental request, revisedLyrics and copyBlocks.lyrics must be empty.
- Avoid copyrighted artist names, living artist imitation, and "in the style of [artist]" phrasing.
- When sourceStyle or sourceLyrics are supplied, treat them as the text to revise.
- Keep the result copy-ready for Suno.`;
}
