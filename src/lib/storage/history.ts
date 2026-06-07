import type { FinalSunoOutput } from "@/lib/schemas/finalSunoOutput";
import type { SongInput } from "@/lib/schemas/songInput";

const STORAGE_KEY = "suno-prompt-director-history";

export type GenerationHistoryItem = {
  id: string;
  createdAt: string;
  input: SongInput;
  selectedDirectionName?: string;
  output: FinalSunoOutput;
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function loadGenerationHistory(): GenerationHistoryItem[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GenerationHistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveGenerationHistory(items: GenerationHistoryItem[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
}

export function addGenerationHistory(item: GenerationHistoryItem) {
  const current = loadGenerationHistory();
  const next = [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 30);
  saveGenerationHistory(next);
  return next;
}

export function deleteGenerationHistoryItem(id: string) {
  const next = loadGenerationHistory().filter((entry) => entry.id !== id);
  saveGenerationHistory(next);
  return next;
}
