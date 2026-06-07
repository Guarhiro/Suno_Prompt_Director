import type { FinalSunoOutput } from "@/lib/schemas/finalSunoOutput";
import { SUNO_LIMITS } from "./limits";

export type SunoValidationResult = {
  ok: boolean;
  issues: string[];
  output: FinalSunoOutput;
};

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function normalizeSunoOutput(output: FinalSunoOutput): FinalSunoOutput {
  const advancedSettings = {
    ...output.advancedSettings,
    styleWeight: roundToTwo(clamp01(output.advancedSettings.styleWeight)),
    weirdnessConstraint: roundToTwo(clamp01(output.advancedSettings.weirdnessConstraint)),
    audioWeight: roundToTwo(clamp01(output.advancedSettings.audioWeight))
  };

  const normalized: FinalSunoOutput = {
    ...output,
    lyrics: output.instrumental ? "" : output.lyrics,
    advancedSettings
  };

  return {
    ...normalized,
    sunoCopyBlocks: {
      ...normalized.sunoCopyBlocks,
      title: normalized.sunoCopyBlocks.title || normalized.selectedTitle,
      style: normalized.sunoCopyBlocks.style || normalized.style,
      lyrics: normalized.instrumental ? "" : normalized.sunoCopyBlocks.lyrics,
      negativeTags: normalized.sunoCopyBlocks.negativeTags || normalized.negativeTags,
      advanced:
        normalized.sunoCopyBlocks.advanced ||
        `styleWeight: ${advancedSettings.styleWeight}\nweirdnessConstraint: ${advancedSettings.weirdnessConstraint}\naudioWeight: ${advancedSettings.audioWeight}`
    }
  };
}

export function validateSunoOutput(output: FinalSunoOutput): SunoValidationResult {
  const normalized = normalizeSunoOutput(output);
  const limits = SUNO_LIMITS[normalized.recommendedModel];
  const issues: string[] = [];
  const promptLength = `${normalized.style}\n${normalized.lyrics}`.length;

  if (promptLength > limits.promptMax) {
    issues.push(`Prompt is ${promptLength} chars; ${normalized.recommendedModel} allows ${limits.promptMax}.`);
  }

  if (normalized.style.length > limits.styleMax) {
    issues.push(`Style is ${normalized.style.length} chars; ${normalized.recommendedModel} allows ${limits.styleMax}.`);
  }

  if (normalized.selectedTitle.length > limits.titleMax) {
    issues.push(`Title is ${normalized.selectedTitle.length} chars; ${normalized.recommendedModel} allows ${limits.titleMax}.`);
  }

  if (normalized.instrumental && normalized.lyrics.length > 0) {
    issues.push("Lyrics must be empty when instrumental is true.");
  }

  for (const [key, value] of Object.entries(normalized.advancedSettings)) {
    if (typeof value === "number" && roundToTwo(value) !== value) {
      issues.push(`${key} must be rounded to two decimals.`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    output: normalized
  };
}
