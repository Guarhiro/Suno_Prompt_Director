import {
  genreOptions,
  instrumentOptions,
  moodOptions,
  priorityOptions,
  structureOptions,
  vocalOptions
} from "@/data/options";
import type { AudioInputClassificationRequest } from "@/lib/schemas/audioInputClassification";

export function buildAudioInputClassificationPrompt(request: AudioInputClassificationRequest) {
  const allowed = {
    moods: moodOptions,
    genres: genreOptions,
    vocalTypes: vocalOptions,
    instruments: instrumentOptions,
    structure: structureOptions,
    priorities: priorityOptions
  };

  return `Classify the audio analysis into Suno Prompt Director input selections.

Audio analysis:
${JSON.stringify(request.analysis, null, 2)}

Allowed values:
${JSON.stringify(allowed, null, 2)}

Goal:
- Choose values that should replace the user's Direction Board selections.
- Use only values from the allowed lists for moods, genres, vocalType, instruments, structure, and priorities.
- Set bpmMin and bpmMax around the detected BPM. Use a narrow range when confidence is high and a wider range when confidence is low.
- If BPM is missing, infer a practical range from energy, dynamics, structure, and the style text.
- Set vocalGender to "m", "f", or "auto". Use "auto" unless the analysis clearly supports a gender.
- If vocal presence is uncertain, prefer vocalType "自動" and instrumental false. Use instrumental true only when the analysis strongly suggests an instrumental/BGM source.
- Preserve the audio's likely genre, mood, arrangement, and production feel without pretending low-confidence details are certain.
- Make advancedNotes a concise Japanese note that mentions the strongest detected evidence.

Output rules:
- Return one classification object.
- source must be "ai".
- summary, rationale, warnings, and advancedNotes must be Japanese.
- confidence should reflect the reliability of the overall menu classification, not just BPM.
- Keep arrays focused: 2-5 genres, 2-5 moods, 3-7 instruments, 4-8 structure items, 1-3 priorities.
- Avoid artist names, copyrighted references, and unsupported claims.`;
}
