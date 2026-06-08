"use client";

import * as React from "react";
import {
  AlertCircle,
  AudioWaveform,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  Clock3,
  Download,
  FileText,
  FileAudio,
  History,
  KeyRound,
  ListMusic,
  Loader2,
  Mic2,
  Music2,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X
} from "lucide-react";
import {
  avoidOptions,
  defaultOpenRouterModel,
  genreOptionGroups,
  instrumentOptionGroups,
  moodOptions,
  openRouterModelOptions,
  type OptionGroup,
  priorityOptions,
  songPresetOptions,
  structureOptions,
  structurePresets,
  useCaseOptions,
  vocalOptions
} from "@/data/options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipButton } from "@/components/ui/chip-button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, inputClassName } from "@/components/ui/field";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SliderControl } from "@/components/ui/slider-control";
import {
  classifyAudioInputLocally,
  normalizeAudioInputClassification
} from "@/lib/audio/classifyAudioInput";
import {
  analyzeAudioFile,
  analyzeAudioFileAdvancedOnServer,
  analyzeAudioFileOnServer,
  type AudioAnalysisResult
} from "@/lib/audio/analyzeAudio";
import type { AudioInputClassification } from "@/lib/schemas/audioInputClassification";
import type { DirectionItem, DirectionProposal } from "@/lib/schemas/directionProposal";
import type { AudioStyleProposalOutput, AudioStyleProposal } from "@/lib/schemas/audioStyleProposal";
import type { FinalSunoOutput } from "@/lib/schemas/finalSunoOutput";
import type { RevisedSunoOutput } from "@/lib/schemas/reviseSunoOutput";
import type { SongInput } from "@/lib/schemas/songInput";
import {
  addGenerationHistory,
  deleteGenerationHistoryItem,
  loadGenerationHistory,
  type GenerationHistoryItem
} from "@/lib/storage/history";
import { SUNO_LIMITS } from "@/lib/suno/limits";
import { cn } from "@/lib/utils";

const defaultPresetInput = songPresetOptions[0].input;

const defaultInput: SongInput = {
  ...defaultPresetInput,
  moods: [...defaultPresetInput.moods],
  genres: [...defaultPresetInput.genres],
  instruments: [...defaultPresetInput.instruments],
  structure: [...defaultPresetInput.structure],
  priorities: [...defaultPresetInput.priorities],
  avoid: [...defaultPresetInput.avoid],
  customMode: true,
  styleWeight: 0.64,
  weirdnessConstraint: 0.32,
  audioWeight: 0.48,
  advancedNotes: ""
};

const tabs = [
  { id: "direction", label: "Direction" },
  { id: "final", label: "Final" },
  { id: "export", label: "Export" },
  { id: "revise", label: "Revise" },
  { id: "alternates", label: "Alternates" },
  { id: "history", label: "History" }
] as const;

type TabId = (typeof tabs)[number]["id"];
type ArrayField = "moods" | "genres" | "instruments" | "structure" | "priorities" | "avoid";
type RevisionMode = "new" | "cover";
type RevisionForm = {
  mode: RevisionMode;
  optionIds: string[];
  freeText: string;
  sourceTitle: string;
  sourceStyle: string;
  sourceLyrics: string;
};
type AppSettings = {
  apiKey: string;
  hasApiKey: boolean;
  model: string;
};
type SettingsResponse = {
  hasApiKey: boolean;
  model: string;
};
type SettingsStatus = {
  tone: "success" | "error";
  message: string;
} | null;

const revisionOptions = [
  { id: "scene_arrangement", label: "場面ごとの構成を変えたい" },
  { id: "instrumentation", label: "楽器編成を変えたい" },
  { id: "ensemble_size", label: "人数感を変えたい" },
  { id: "key", label: "キーを変えたい" },
  { id: "bpm", label: "BPMを変えたい" },
  { id: "mood", label: "雰囲気を変えたい" },
  { id: "add_vocal", label: "ボーカルを追加したい" },
  { id: "reduce_vocal", label: "ボーカルを減らしたい" },
  { id: "instrumental", label: "インストで作りたい" },
  { id: "lyrics_only", label: "歌詞だけ直したい" },
  { id: "style_only", label: "Styleだけ直したい" },
  { id: "shorten", label: "Suno向けに短く整理したい" }
] as const;

const defaultRevisionForm: RevisionForm = {
  mode: "new",
  optionIds: [],
  freeText: "",
  sourceTitle: "",
  sourceStyle: "",
  sourceLyrics: ""
};

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message ?? "生成に失敗しました。";
    const issues = Array.isArray(data?.issues) ? `\n${data.issues.join("\n")}` : "";
    throw new Error(`${message}${issues}`);
  }

  return data as T;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function sameSequence(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function modelLabel(value: string) {
  const option = openRouterModelOptions.find((item) => item.value === value);
  return option ? `${option.provider} / ${option.label}` : value;
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function confidencePercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function analysisEngineLabel(engine: AudioAnalysisResult["engine"]) {
  if (engine === "advanced-local") return "High Precision";
  return engine === "python-librosa" ? "Python / librosa" : "Browser basic";
}

function audioInputClassificationLabel(source: AudioInputClassification["source"]) {
  return source === "ai" ? "API反映済み" : "ローカル反映済み";
}

function cleanValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function cleanValues(values: Array<string | null | undefined>) {
  return values.map(cleanValue).filter(Boolean);
}

function displayList(values: string[]) {
  return values.length ? values.join(", ") : "未選択";
}

function markdownList(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "- 未選択";
}

function buildAdvancedSettingsBlock(input: SongInput) {
  return [
    `Custom Mode: ${input.customMode ? "on" : "off"}`,
    `Instrumental: ${input.instrumental ? "on" : "off"}`,
    `Style Weight: ${input.styleWeight.toFixed(2)}`,
    `Weirdness: ${input.weirdnessConstraint.toFixed(2)}`,
    `Audio Weight: ${input.audioWeight.toFixed(2)}`,
    `Vocal Gender: ${input.vocalGender ?? "auto"}`
  ].join("\n");
}

function buildLocalStylePrompt(input: SongInput, selectedDirection: DirectionItem | undefined, answers: Record<string, string>) {
  const answerValues = Object.values(answers).filter((value) => cleanValue(value));
  const parts = cleanValues([
    input.useCase,
    ...input.genres,
    `${input.bpmMin}-${input.bpmMax} BPM`,
    input.instrumental ? "instrumental" : input.vocalType,
    ...input.moods,
    ...input.instruments,
    input.structure.length ? `Structure: ${input.structure.join(" > ")}` : "",
    ...input.priorities,
    input.lyricLanguage ? `${input.lyricLanguage} lyrics` : "",
    input.lyricLength ? `${input.lyricLength} lyrics` : "",
    input.lyricTheme ? `Lyric theme: ${input.lyricTheme}` : "",
    input.freeText,
    input.customMode ? "Custom Mode" : "Simple Mode",
    `Style Weight ${input.styleWeight.toFixed(2)}`,
    `Weirdness ${input.weirdnessConstraint.toFixed(2)}`,
    `Audio Weight ${input.audioWeight.toFixed(2)}`,
    input.advancedNotes ? `Notes: ${input.advancedNotes}` : "",
    selectedDirection ? `Direction: ${selectedDirection.name}` : "",
    selectedDirection?.description,
    ...(selectedDirection?.genreBlend ?? []),
    selectedDirection?.bpmRange,
    selectedDirection?.keyMood,
    ...(selectedDirection?.recommendedInstruments ?? []),
    selectedDirection?.vocalDirection,
    selectedDirection?.structure.length ? `Direction structure: ${selectedDirection.structure.join(" > ")}` : "",
    ...answerValues.map((answer) => `Answer: ${answer}`),
    input.avoid.length ? `Avoid: ${input.avoid.join(", ")}` : ""
  ]);

  return parts.join(", ");
}

function buildAnswerMarkdown(proposal: DirectionProposal | null, answers: Record<string, string>) {
  const rows = Object.entries(answers)
    .filter(([, value]) => cleanValue(value))
    .map(([id, value]) => {
      const question = proposal?.questions.find((item) => item.id === id);
      return `- ${question?.question ?? id}: ${value}`;
    });

  return rows.length ? rows.join("\n") : "- 未回答";
}

function buildDirectionMarkdown(selectedDirection: DirectionItem | undefined) {
  if (!selectedDirection) {
    return "- 未選択";
  }

  return [
    `- Name: ${selectedDirection.name}`,
    `- Description: ${selectedDirection.description}`,
    `- Genre Blend: ${displayList(selectedDirection.genreBlend)}`,
    `- BPM Range: ${selectedDirection.bpmRange}`,
    `- Key Mood: ${selectedDirection.keyMood}`,
    `- Recommended Instruments: ${displayList(selectedDirection.recommendedInstruments)}`,
    `- Vocal Direction: ${selectedDirection.vocalDirection}`,
    `- Structure: ${displayList(selectedDirection.structure)}`,
    "",
    "### Strengths",
    markdownList(selectedDirection.strengths),
    "",
    "### Risks",
    markdownList(selectedDirection.risks)
  ].join("\n");
}

function buildLocalExport(input: SongInput, proposal: DirectionProposal | null, selectedDirection: DirectionItem | undefined, answers: Record<string, string>) {
  const stylePrompt = buildLocalStylePrompt(input, selectedDirection, answers);
  const negativeTags = displayList(input.avoid);
  const advancedSettings = buildAdvancedSettingsBlock(input);
  const selectedItemCount =
    cleanValues([
      input.useCase,
      input.freeText,
      input.vocalType,
      input.lyricLanguage,
      input.lyricTheme,
      input.lyricLength,
      input.advancedNotes,
      selectedDirection?.name,
      ...Object.values(answers),
      ...input.moods,
      ...input.genres,
      ...input.instruments,
      ...input.structure,
      ...input.priorities,
      ...input.avoid
    ]).length + 4;

  const markdown = [
    "# Suno Style Export",
    "",
    "## Suno Style Prompt",
    "```text",
    stylePrompt,
    "```",
    "",
    "## LLM Request",
    "この内容を元に、Sunoで使える曲名、Style、Lyrics、Negative Tags、Advanced設定の候補を作ってください。下の選択項目は省略せず反映してください。",
    "",
    "## Selected Inputs",
    `- Use Case: ${input.useCase || "未選択"}`,
    `- Free Text: ${input.freeText || "未入力"}`,
    `- BPM: ${input.bpmMin}-${input.bpmMax}`,
    `- Vocal: ${input.vocalType || "未選択"}`,
    `- Instrumental: ${input.instrumental ? "on" : "off"}`,
    `- Custom Mode: ${input.customMode ? "on" : "off"}`,
    `- Lyric Language: ${input.lyricLanguage || "未選択"}`,
    `- Lyric Theme: ${input.lyricTheme || "未入力"}`,
    `- Lyric Length: ${input.lyricLength || "未選択"}`,
    `- Advanced Notes: ${input.advancedNotes || "未入力"}`,
    "",
    "### Moods",
    markdownList(input.moods),
    "",
    "### Genres",
    markdownList(input.genres),
    "",
    "### Instruments / Sounds",
    markdownList(input.instruments),
    "",
    "### Structure",
    markdownList(input.structure),
    "",
    "### Priorities",
    markdownList(input.priorities),
    "",
    "### Avoid",
    markdownList(input.avoid),
    "",
    "## Selected Direction",
    buildDirectionMarkdown(selectedDirection),
    "",
    "## Additional Answers",
    buildAnswerMarkdown(proposal, answers),
    "",
    "## Suno Copy Blocks",
    "",
    "### Style",
    "```text",
    stylePrompt,
    "```",
    "",
    "### Negative Tags",
    "```text",
    negativeTags,
    "```",
    "",
    "### Advanced",
    "```text",
    advancedSettings,
    "```"
  ].join("\n");

  return {
    advancedSettings,
    markdown,
    negativeTags,
    selectedItemCount,
    stylePrompt
  };
}

function OutputBlock({
  title,
  value,
  rows = 5
}: {
  title: string;
  value: string;
  rows?: number;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-muted/35 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <CopyButton value={value} />
      </div>
      <textarea
        className={cn(inputClassName, "min-h-28 resize-y font-mono text-xs leading-5")}
        readOnly
        rows={rows}
        value={value}
      />
    </div>
  );
}

function CategorizedOptionSelector({
  groups,
  selected,
  onToggle,
  onClear
}: {
  groups: OptionGroup[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [activeGroupId, setActiveGroupId] = React.useState(groups[0]?.id ?? "");
  const activeGroup = React.useMemo(() => {
    return groups.find((group) => group.id === activeGroupId) ?? groups[0];
  }, [activeGroupId, groups]);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[170px_1fr]">
        <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:max-h-64 md:overflow-y-auto md:pb-0">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={cn(
                "min-h-9 shrink-0 rounded-md border px-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:w-full",
                activeGroup?.id === group.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
              onClick={() => setActiveGroupId(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {activeGroup?.options.map((option) => (
            <ChipButton key={option} active={selected.includes(option)} onClick={() => onToggle(option)}>
              {option}
            </ChipButton>
          ))}
        </div>
      </div>

      <div className="grid gap-2 border-t border-border/70 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">選択済み {selected.length}</span>
          {selected.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              解除
            </Button>
          ) : null}
        </div>
        {selected.length ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((option) => (
              <ChipButton key={option} active onClick={() => onToggle(option)}>
                {option}
              </ChipButton>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">未選択</p>
        )}
      </div>
    </div>
  );
}

function DirectionCard({
  direction,
  index,
  active,
  onSelect
}: {
  direction: DirectionItem;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-panel-strong/70 p-4 transition",
        active ? "border-primary shadow-[0_0_0_1px_rgba(190,255,67,0.28)]" : "border-border"
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
              active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            )}
          >
            {index + 1}
          </span>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{direction.name}</h3>
              <Badge tone={active ? "primary" : "default"}>{direction.bpmRange}</Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{direction.description}</p>
            <div className="flex flex-wrap gap-2">
              {direction.genreBlend.slice(0, 4).map((genre) => (
                <Badge key={genre}>{genre}</Badge>
              ))}
              <Badge tone="accent">{direction.vocalDirection}</Badge>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant={active ? "primary" : "secondary"}
          size="sm"
          className="min-w-24 whitespace-nowrap"
          onClick={onSelect}
        >
          {active ? <CheckCircle2 className="size-4" /> : <Sparkles className="size-4" />}
          {active ? "選択中" : "選択"}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 border-t border-border/80 pt-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-primary">Strengths</p>
          <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
            {direction.strengths.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-warning">Risks</p>
          <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
            {direction.risks.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function SunoStudio() {
  const [input, setInput] = React.useState<SongInput>(defaultInput);
  const [proposal, setProposal] = React.useState<DirectionProposal | null>(null);
  const [selectedDirectionId, setSelectedDirectionId] = React.useState<string | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [finalOutput, setFinalOutput] = React.useState<FinalSunoOutput | null>(null);
  const [revisionForm, setRevisionForm] = React.useState<RevisionForm>(defaultRevisionForm);
  const [revisionOutput, setRevisionOutput] = React.useState<RevisedSunoOutput | null>(null);
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [audioAnalysis, setAudioAnalysis] = React.useState<AudioAnalysisResult | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = React.useState(false);
  const [isAnalyzingAudioAdvanced, setIsAnalyzingAudioAdvanced] = React.useState(false);
  const [audioAnalysisError, setAudioAnalysisError] = React.useState<string | null>(null);
  const [audioAnalysisNotice, setAudioAnalysisNotice] = React.useState<string | null>(null);
  const [audioStyleApplied, setAudioStyleApplied] = React.useState(false);
  const [audioStyleProposals, setAudioStyleProposals] = React.useState<AudioStyleProposalOutput | null>(null);
  const [isGeneratingAudioStyles, setIsGeneratingAudioStyles] = React.useState(false);
  const [audioStyleProposalError, setAudioStyleProposalError] = React.useState<string | null>(null);
  const [appliedAudioStyleId, setAppliedAudioStyleId] = React.useState<string | null>(null);
  const [audioInputClassification, setAudioInputClassification] = React.useState<AudioInputClassification | null>(null);
  const [audioInputClassificationError, setAudioInputClassificationError] = React.useState<string | null>(null);
  const [isClassifyingAudioInput, setIsClassifyingAudioInput] = React.useState(false);
  const [history, setHistory] = React.useState<GenerationHistoryItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<TabId>("direction");
  const [isProposing, setIsProposing] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isRevising, setIsRevising] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settings, setSettings] = React.useState<AppSettings>({
    apiKey: "",
    hasApiKey: false,
    model: defaultOpenRouterModel
  });
  const [settingsStatus, setSettingsStatus] = React.useState<SettingsStatus>(null);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setHistory(loadGenerationHistory());
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) return;
        const data = (await response.json()) as SettingsResponse;
        if (cancelled) return;

        setSettings({
          apiKey: "",
          hasApiKey: data.hasApiKey,
          model: data.model || defaultOpenRouterModel
        });
      } catch {
        if (!cancelled) {
          setSettingsStatus({ tone: "error", message: "設定の読み込みに失敗しました。" });
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDirection = React.useMemo(() => {
    return proposal?.recommendedDirections.find((direction) => direction.id === selectedDirectionId);
  }, [proposal, selectedDirectionId]);
  const selectedDirectionIndex = React.useMemo(() => {
    return proposal?.recommendedDirections.findIndex((direction) => direction.id === selectedDirectionId) ?? -1;
  }, [proposal, selectedDirectionId]);

  const limits = finalOutput ? SUNO_LIMITS[finalOutput.recommendedModel] : null;
  const promptLength = finalOutput ? `${finalOutput.style}\n${finalOutput.lyrics}`.length : 0;
  const modelOptionsForSelect = React.useMemo(() => {
    const hasCurrentModel = openRouterModelOptions.some((option) => option.value === settings.model);
    return hasCurrentModel
      ? openRouterModelOptions
      : [{ provider: "Current", value: settings.model, label: settings.model }, ...openRouterModelOptions];
  }, [settings.model]);
  const localExport = React.useMemo(() => {
    return buildLocalExport(input, proposal, selectedDirection, answers);
  }, [answers, input, proposal, selectedDirection]);

  function updateInput<K extends keyof SongInput>(key: K, value: SongInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function updateRevisionForm<K extends keyof RevisionForm>(key: K, value: RevisionForm[K]) {
    setRevisionForm((current) => ({ ...current, [key]: value }));
  }

  function toggleArrayValue(field: ArrayField, value: string) {
    setInput((current) => {
      const currentValues = current[field] ?? [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        [field]: nextValues
      };
    });
  }

  function setBpm(key: "bpmMin" | "bpmMax", value: number) {
    setInput((current) => {
      const next = { ...current, [key]: value };
      if (next.bpmMin > next.bpmMax) {
        return key === "bpmMin" ? { ...next, bpmMax: value } : { ...next, bpmMin: value };
      }
      return next;
    });
  }

  function selectVocalOption(option: string) {
    setInput((current) => ({
      ...current,
      vocalType: option,
      instrumental: option === "インスト",
      vocalGender: option === "男性" ? "m" : option === "女性" ? "f" : undefined
    }));
  }

  function toggleRevisionOption(id: string) {
    setRevisionForm((current) => ({
      ...current,
      optionIds: current.optionIds.includes(id)
        ? current.optionIds.filter((item) => item !== id)
        : [...current.optionIds, id]
    }));
  }

  function loadFinalIntoRevision() {
    if (!finalOutput) return;
    setRevisionForm((current) => ({
      ...current,
      sourceTitle: finalOutput.sunoCopyBlocks.title,
      sourceStyle: finalOutput.sunoCopyBlocks.style,
      sourceLyrics: finalOutput.sunoCopyBlocks.lyrics
    }));
    setActiveTab("revise");
  }

  function applySongPreset(useCase: string) {
    const preset = songPresetOptions.find((option) => option.label === useCase);

    if (!preset) {
      updateInput("useCase", useCase);
      return;
    }

    setInput((current) => ({
      ...current,
      ...preset.input,
      moods: [...preset.input.moods],
      genres: [...preset.input.genres],
      instruments: [...preset.input.instruments],
      structure: [...preset.input.structure],
      priorities: [...preset.input.priorities],
      avoid: [...preset.input.avoid],
      vocalGender: preset.input.vocalGender
    }));
    setFinalOutput(null);
    setError(null);
  }

  async function saveSettings() {
    setIsSavingSettings(true);
    setSettingsStatus(null);

    try {
      const data = await postJson<SettingsResponse>("/api/settings", {
        apiKey: settings.apiKey,
        model: settings.model
      });

      setSettings({
        apiKey: "",
        hasApiKey: data.hasApiKey,
        model: data.model || defaultOpenRouterModel
      });
      setSettingsStatus({ tone: "success", message: "設定を保存しました。" });
    } catch (nextError) {
      setSettingsStatus({
        tone: "error",
        message: nextError instanceof Error ? nextError.message : "設定の保存に失敗しました。"
      });
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function proposeDirection() {
    setIsProposing(true);
    setError(null);

    try {
      const data = await postJson<DirectionProposal>("/api/propose-direction", input);
      setProposal(data);
      setSelectedDirectionId(data.recommendedDirections[0]?.id ?? null);
      setActiveTab("direction");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "方向性の提案に失敗しました。");
    } finally {
      setIsProposing(false);
    }
  }

  async function generateFinal() {
    setIsGenerating(true);
    setError(null);

    try {
      const data = await postJson<FinalSunoOutput>("/api/generate-final", {
        input,
        selectedDirection,
        answers
      });
      setFinalOutput(data);
      setRevisionForm((current) => ({
        ...current,
        sourceTitle: data.sunoCopyBlocks.title,
        sourceStyle: data.sunoCopyBlocks.style,
        sourceLyrics: data.sunoCopyBlocks.lyrics
      }));
      setActiveTab("final");

      const item: GenerationHistoryItem = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        input,
        selectedDirectionName: selectedDirection?.name,
        output: data
      };
      setHistory(addGenerationHistory(item));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "最終生成に失敗しました。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function reviseOutput() {
    setIsRevising(true);
    setError(null);

    try {
      const optionLabels = revisionOptions
        .filter((option) => revisionForm.optionIds.includes(option.id))
        .map((option) => option.label);
      const data = await postJson<RevisedSunoOutput>("/api/revise", {
        ...revisionForm,
        optionLabels,
        input,
        selectedDirection,
        finalOutput: finalOutput ?? undefined
      });
      setRevisionOutput(data);
      setActiveTab("revise");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "修正案の生成に失敗しました。");
    } finally {
      setIsRevising(false);
    }
  }

  function selectAudioFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAudioFile(file);
    setAudioAnalysis(null);
    setAudioAnalysisError(null);
    setAudioAnalysisNotice(null);
    setAudioStyleApplied(false);
    setAudioStyleProposals(null);
    setAudioStyleProposalError(null);
    setAppliedAudioStyleId(null);
    setAudioInputClassification(null);
    setAudioInputClassificationError(null);
  }

  async function analyzeSelectedAudio() {
    if (!audioFile) {
      setAudioAnalysisError("音声ファイルを選択してください。");
      return;
    }

    setIsAnalyzingAudio(true);
    setAudioAnalysisError(null);
    setAudioAnalysisNotice(null);
    setAudioStyleApplied(false);
    setAudioStyleProposals(null);
    setAudioStyleProposalError(null);
    setAppliedAudioStyleId(null);
    setAudioInputClassification(null);
    setAudioInputClassificationError(null);

    try {
      const result = await analyzeAudioFileOnServer(audioFile);
      setAudioAnalysis(result);
    } catch (serverError) {
      try {
        const fallback = await analyzeAudioFile(audioFile);
        const serverMessage =
          serverError instanceof Error ? serverError.message : "Python音声解析に失敗しました。";
        setAudioAnalysis({
          ...fallback,
          warnings: [`Python解析に失敗したため、ブラウザ簡易解析結果を表示しています。${serverMessage}`, ...fallback.warnings]
        });
        setAudioAnalysisNotice("Python解析に失敗したため、ブラウザ簡易解析結果を表示しています。");
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : "音声解析に失敗しました。別の音声形式で試してください。";
        setAudioAnalysisError(message);
      }
    } finally {
      setIsAnalyzingAudio(false);
    }
  }

  async function analyzeSelectedAudioAdvanced() {
    if (!audioFile) {
      setAudioAnalysisError("音声ファイルを選択してください。");
      return;
    }

    setIsAnalyzingAudioAdvanced(true);
    setAudioAnalysisError(null);
    setAudioAnalysisNotice(null);
    setAudioStyleApplied(false);
    setAudioStyleProposals(null);
    setAudioStyleProposalError(null);
    setAppliedAudioStyleId(null);
    setAudioInputClassification(null);
    setAudioInputClassificationError(null);

    try {
      const result = await analyzeAudioFileAdvancedOnServer(audioFile);
      setAudioAnalysis(result);
      setAudioAnalysisNotice("高精度解析結果を表示しています。all-in-one / Demucsが未導入の場合は通常解析を併用します。");
    } catch (advancedError) {
      try {
        const result = await analyzeAudioFileOnServer(audioFile);
        const advancedMessage =
          advancedError instanceof Error ? advancedError.message : "高精度音声解析に失敗しました。";
        setAudioAnalysis({
          ...result,
          warnings: [`高精度解析に失敗したため、通常Python解析結果を表示しています。${advancedMessage}`, ...result.warnings]
        });
        setAudioAnalysisNotice("高精度解析に失敗したため、通常Python解析結果を表示しています。");
      } catch (serverError) {
        try {
          const fallback = await analyzeAudioFile(audioFile);
          const advancedMessage =
            advancedError instanceof Error ? advancedError.message : "高精度音声解析に失敗しました。";
          const serverMessage =
            serverError instanceof Error ? serverError.message : "Python音声解析に失敗しました。";
          setAudioAnalysis({
            ...fallback,
            warnings: [
              `高精度解析とPython解析に失敗したため、ブラウザ簡易解析結果を表示しています。${advancedMessage} / ${serverMessage}`,
              ...fallback.warnings
            ]
          });
          setAudioAnalysisNotice("高精度解析とPython解析に失敗したため、ブラウザ簡易解析結果を表示しています。");
        } catch (fallbackError) {
          const message =
            fallbackError instanceof Error
              ? fallbackError.message
              : "高精度音声解析に失敗しました。別の音声形式で試してください。";
          setAudioAnalysisError(message);
        }
      }
    } finally {
      setIsAnalyzingAudioAdvanced(false);
    }
  }

  function applyAudioStyleToRevision() {
    if (!audioAnalysis) return;
    setRevisionForm((current) => ({
      ...current,
      sourceStyle: audioAnalysis.sunoStyle
    }));
    setAudioStyleApplied(true);
    setAppliedAudioStyleId("local-analysis");
  }

  async function generateAudioStyleProposals() {
    if (!audioAnalysis) {
      setAudioStyleProposalError("先に音源解析を実行してください。");
      return;
    }

    setIsGeneratingAudioStyles(true);
    setAudioStyleProposalError(null);

    try {
      const data = await postJson<AudioStyleProposalOutput>("/api/generate-audio-styles", {
        analysis: audioAnalysis,
        sourceStyle: revisionForm.sourceStyle,
        freeText: revisionForm.freeText
      });
      setAudioStyleProposals(data);
    } catch (nextError) {
      setAudioStyleProposalError(
        nextError instanceof Error ? nextError.message : "AIスタイル案の生成に失敗しました。"
      );
    } finally {
      setIsGeneratingAudioStyles(false);
    }
  }

  function applyAudioStyleProposal(proposal: AudioStyleProposal) {
    setRevisionForm((current) => ({
      ...current,
      sourceStyle: proposal.style
    }));
    setAudioStyleApplied(true);
    setAppliedAudioStyleId(proposal.id);
  }

  function applyAudioInputClassification(classification: AudioInputClassification) {
    const normalized = normalizeAudioInputClassification(classification);
    const nextVocalGender = normalized.input.vocalGender === "auto" ? undefined : normalized.input.vocalGender;

    setInput((current) => ({
      ...current,
      moods: [...normalized.input.moods],
      genres: [...normalized.input.genres],
      bpmMin: normalized.input.bpmMin,
      bpmMax: normalized.input.bpmMax,
      vocalType: normalized.input.vocalType,
      vocalGender: nextVocalGender,
      instrumental: normalized.input.instrumental,
      instruments: [...normalized.input.instruments],
      structure: [...normalized.input.structure],
      priorities: [...normalized.input.priorities],
      customMode: normalized.input.customMode,
      styleWeight: normalized.input.styleWeight,
      weirdnessConstraint: normalized.input.weirdnessConstraint,
      audioWeight: normalized.input.audioWeight,
      advancedNotes: normalized.input.advancedNotes
    }));
    setAudioInputClassification(normalized);
    setAudioInputClassificationError(null);
  }

  function applyLocalAudioInputClassification() {
    if (!audioAnalysis) {
      setAudioInputClassificationError("先に音源解析を実行してください。");
      return;
    }

    applyAudioInputClassification(classifyAudioInputLocally(audioAnalysis));
  }

  async function classifyAudioInputWithApi() {
    if (!audioAnalysis) {
      setAudioInputClassificationError("先に音源解析を実行してください。");
      return;
    }

    setIsClassifyingAudioInput(true);
    setAudioInputClassificationError(null);

    try {
      const data = await postJson<AudioInputClassification>("/api/classify-audio-input", {
        analysis: audioAnalysis
      });
      applyAudioInputClassification(data);
    } catch (nextError) {
      setAudioInputClassificationError(
        nextError instanceof Error ? nextError.message : "API高精度判定に失敗しました。"
      );
    } finally {
      setIsClassifyingAudioInput(false);
    }
  }

  function loadFromHistory(item: GenerationHistoryItem) {
    setInput(item.input);
    setFinalOutput(item.output);
    setRevisionForm((current) => ({
      ...current,
      sourceTitle: item.output.sunoCopyBlocks.title,
      sourceStyle: item.output.sunoCopyBlocks.style,
      sourceLyrics: item.output.sunoCopyBlocks.lyrics
    }));
    setActiveTab("final");
    setError(null);
  }

  function deleteHistory(id: string) {
    setHistory(deleteGenerationHistoryItem(id));
  }

  function downloadLocalMarkdown() {
    const blob = new Blob([localExport.markdown], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    anchor.href = url;
    anchor.download = `suno-style-export-${date}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1540px] flex-col gap-4">
        <header className="flex flex-col gap-3 border-b border-border/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
              <AudioWaveform className="size-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-normal text-foreground sm:text-2xl">
                Suno Prompt Director
              </h1>
              <p className="text-sm font-semibold text-primary">Studio Console</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary" className="h-9 gap-2 px-3">
              <span className="size-2 rounded-full bg-primary" />
              {modelLabel(settings.model)}
            </Badge>
            <Button type="button" variant="secondary" onClick={() => setSettingsOpen((current) => !current)}>
              <Settings2 className="size-4" />
              設定
            </Button>
            <Button type="button" variant="secondary" onClick={() => setActiveTab("history")}>
              <History className="size-4" />
              履歴
            </Button>
            <Button type="button" variant="ghost" onClick={() => setInput(defaultInput)}>
              <RefreshCw className="size-4" />
              初期化
            </Button>
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="whitespace-pre-wrap leading-6">{error}</p>
          </div>
        ) : null}

        {settingsOpen ? (
          <Panel>
            <PanelHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="size-4 text-primary" />
                <h2 className="text-sm font-bold">API設定</h2>
              </div>
              <Badge tone={settings.hasApiKey ? "primary" : "default"}>env.local</Badge>
            </PanelHeader>
            <PanelBody className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <Field label="APIキー" icon={<KeyRound className="size-4 text-muted-foreground" />} className="border-b-0 py-0">
                <input
                  className={inputClassName}
                  type="password"
                  autoComplete="off"
                  value={settings.apiKey}
                  onChange={(event) => {
                    setSettings((current) => ({ ...current, apiKey: event.target.value }));
                    setSettingsStatus(null);
                  }}
                  placeholder={settings.hasApiKey ? "保存済み" : "sk-or-v1-..."}
                />
              </Field>
              <Field label="モデル" icon={<WandSparkles className="size-4 text-muted-foreground" />} className="border-b-0 py-0">
                <select
                  className={inputClassName}
                  value={settings.model}
                  onChange={(event) => {
                    setSettings((current) => ({ ...current, model: event.target.value }));
                    setSettingsStatus(null);
                  }}
                >
                  {modelOptionsForSelect.map((option) => (
                    <option key={`${option.provider}-${option.value}`} value={option.value}>
                      {option.provider} / {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-2">
                <Button type="button" variant="primary" onClick={saveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  保存
                </Button>
                {settingsStatus ? (
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      settingsStatus.tone === "success" ? "text-primary" : "text-danger"
                    )}
                  >
                    {settingsStatus.message}
                  </p>
                ) : null}
              </div>
            </PanelBody>
          </Panel>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[132px_1fr_1.18fr]">
          <aside className="hidden rounded-lg border border-border bg-panel p-2 shadow-console xl:flex xl:flex-col xl:justify-between">
            <nav className="grid gap-2">
              <Button type="button" variant="primary" className="justify-start">
                <SlidersHorizontal className="size-4" />
                ミキサー
              </Button>
              <Button type="button" variant="ghost" className="justify-start" onClick={() => setActiveTab("history")}>
                <History className="size-4" />
                履歴
              </Button>
              <Button type="button" variant="ghost" className="justify-start" onClick={() => setActiveTab("final")}>
                <WandSparkles className="size-4" />
                Final
              </Button>
              <Button type="button" variant="ghost" className="justify-start" onClick={() => setActiveTab("export")}>
                <Download className="size-4" />
                Export
              </Button>
              <Button type="button" variant="ghost" className="justify-start" onClick={() => setActiveTab("revise")}>
                <FileText className="size-4" />
                Revise
              </Button>
            </nav>
            <div className="grid gap-2 rounded-md border border-border bg-muted/35 p-3">
              <p className="text-xs text-muted-foreground">今月の生成数</p>
              <p className="text-2xl font-bold text-primary">{history.length}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/4 rounded-full bg-primary" />
              </div>
            </div>
          </aside>

          <div className="grid gap-4">
            <Panel>
              <PanelHeader>
                <div className="flex items-center gap-2">
                  <WandSparkles className="size-4 text-primary" />
                  <h2 className="text-sm font-bold">インテント・コンポーザー</h2>
                </div>
                <Badge>任意</Badge>
              </PanelHeader>
              <PanelBody className="grid gap-4 md:grid-cols-[1fr_260px]">
                <textarea
                  className={cn(inputClassName, "min-h-24 resize-y text-base leading-7")}
                  value={input.freeText}
                  onChange={(event) => updateInput("freeText", event.target.value)}
                  placeholder="例: 夜のドライブで聴きたい、少し切なくて爽やかなシンセポップ"
                />
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">プリセット</label>
                  <select
                    className={inputClassName}
                    value={input.useCase}
                    onChange={(event) => applySongPreset(event.target.value)}
                  >
                    {useCaseOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="primary" onClick={proposeDirection} disabled={isProposing}>
                    {isProposing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    方向性を提案
                  </Button>
                </div>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" />
                  <h2 className="text-sm font-bold">Direction Board</h2>
                </div>
                <Badge tone="accent">{input.genres.length + input.moods.length} picks</Badge>
              </PanelHeader>
              <PanelBody className="py-1">
                <Field label="ユースケース" icon={<ListMusic className="size-4 text-muted-foreground" />}>
                  <div className="flex flex-wrap gap-2">
                    {useCaseOptions.map((option) => (
                      <ChipButton
                        key={option}
                        active={input.useCase === option}
                        onClick={() => applySongPreset(option)}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </div>
                </Field>

                <Field label="ムード / 雰囲気" icon={<Sparkles className="size-4 text-muted-foreground" />}>
                  <div className="flex flex-wrap gap-2">
                    {moodOptions.map((option) => (
                      <ChipButton
                        key={option}
                        active={input.moods.includes(option)}
                        onClick={() => toggleArrayValue("moods", option)}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </div>
                </Field>

                <Field label="ジャンル / スタイル" icon={<Music2 className="size-4 text-muted-foreground" />}>
                  <CategorizedOptionSelector
                    groups={genreOptionGroups}
                    selected={input.genres}
                    onToggle={(option) => toggleArrayValue("genres", option)}
                    onClear={() => updateInput("genres", [])}
                  />
                </Field>

                <Field label="BPM" hint={`${input.bpmMin} - ${input.bpmMax}`}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SliderControl
                      label="Min"
                      min={40}
                      max={220}
                      step={1}
                      value={input.bpmMin}
                      format={(value) => `${value}`}
                      onChange={(value) => setBpm("bpmMin", value)}
                    />
                    <SliderControl
                      label="Max"
                      min={40}
                      max={220}
                      step={1}
                      value={input.bpmMax}
                      format={(value) => `${value}`}
                      onChange={(value) => setBpm("bpmMax", value)}
                    />
                  </div>
                </Field>

                <Field label="ボーカル" icon={<Mic2 className="size-4 text-muted-foreground" />}>
                  <div className="flex flex-wrap gap-2">
                    {vocalOptions.map((option) => (
                      <ChipButton
                        key={option}
                        active={input.vocalType === option}
                        onClick={() => selectVocalOption(option)}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </div>
                </Field>

                <Field label="使用楽器 / サウンド">
                  <CategorizedOptionSelector
                    groups={instrumentOptionGroups}
                    selected={input.instruments}
                    onToggle={(option) => toggleArrayValue("instruments", option)}
                    onClear={() => updateInput("instruments", [])}
                  />
                </Field>

                <Field label="楽曲構成">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {structurePresets.map((preset) => (
                      <ChipButton
                        key={preset.id}
                        active={sameSequence(input.structure, preset.sections)}
                        onClick={() => updateInput("structure", [...preset.sections])}
                      >
                        {preset.label}
                      </ChipButton>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
                    {structureOptions.map((option) => (
                      <ChipButton
                        key={option}
                        active={input.structure.includes(option)}
                        onClick={() => toggleArrayValue("structure", option)}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </div>
                </Field>

                <Field label="優先したいこと">
                  <div className="flex flex-wrap gap-2">
                    {priorityOptions.map((option) => (
                      <ChipButton
                        key={option}
                        active={input.priorities.includes(option)}
                        onClick={() => toggleArrayValue("priorities", option)}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </div>
                </Field>

                <Field label="避けたい要素">
                  <div className="flex flex-wrap gap-2">
                    {avoidOptions.map((option) => (
                      <ChipButton
                        key={option}
                        active={input.avoid.includes(option)}
                        onClick={() => toggleArrayValue("avoid", option)}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </div>
                </Field>

                <Field label="歌詞の設定" icon={<BookOpen className="size-4 text-muted-foreground" />}>
                  <div className="grid gap-3 md:grid-cols-[150px_1fr_130px]">
                    <select
                      className={inputClassName}
                      value={input.lyricLanguage}
                      onChange={(event) => updateInput("lyricLanguage", event.target.value)}
                    >
                      <option value="日本語">日本語</option>
                      <option value="English">English</option>
                      <option value="Korean">Korean</option>
                      <option value="Spanish">Spanish</option>
                    </select>
                    <textarea
                      className={cn(inputClassName, "min-h-24 resize-y leading-6")}
                      value={input.lyricTheme}
                      onChange={(event) => updateInput("lyricTheme", event.target.value)}
                      placeholder="テーマ"
                    />
                    <select
                      className={inputClassName}
                      value={input.lyricLength}
                      onChange={(event) => updateInput("lyricLength", event.target.value)}
                    >
                      <option value="短め">短め</option>
                      <option value="標準">標準</option>
                      <option value="長め">長め</option>
                    </select>
                  </div>
                </Field>

                <Field label="Advanced">
                  <div className="grid gap-4 md:grid-cols-3">
                    <SliderControl
                      label="Style Weight"
                      value={input.styleWeight}
                      onChange={(value) => updateInput("styleWeight", Number(value.toFixed(2)))}
                    />
                    <SliderControl
                      label="Weirdness"
                      value={input.weirdnessConstraint}
                      onChange={(value) => updateInput("weirdnessConstraint", Number(value.toFixed(2)))}
                    />
                    <SliderControl
                      label="Audio Weight"
                      value={input.audioWeight}
                      onChange={(value) => updateInput("audioWeight", Number(value.toFixed(2)))}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ChipButton
                      active={input.customMode}
                      onClick={() => updateInput("customMode", !input.customMode)}
                    >
                      Custom Mode
                    </ChipButton>
                    <ChipButton
                      active={input.instrumental}
                      onClick={() => {
                        updateInput("instrumental", !input.instrumental);
                        updateInput("vocalType", input.instrumental ? "女性" : "インスト");
                      }}
                    >
                      Instrumental
                    </ChipButton>
                  </div>
                </Field>
              </PanelBody>
            </Panel>
          </div>

          <Panel className="overflow-hidden">
            <div className="flex overflow-x-auto border-b border-border bg-panel-strong/75">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    "min-h-12 min-w-32 border-r border-border px-4 text-sm font-semibold transition",
                    activeTab === tab.id
                      ? "bg-muted text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "direction" ? (
              <PanelBody className="grid gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-base font-bold">提案された方向性</h2>
                    {proposal ? (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{proposal.summary}</p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">まだ提案はありません。</p>
                    )}
                  </div>
                  <Button type="button" onClick={proposeDirection} disabled={isProposing}>
                    {isProposing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    再提案
                  </Button>
                </div>

                {proposal ? (
                  <div className="grid gap-3">
                    {proposal.recommendedDirections.map((direction, index) => (
                      <DirectionCard
                        key={direction.id}
                        direction={direction}
                        index={index}
                        active={selectedDirectionId === direction.id}
                        onSelect={() => setSelectedDirectionId(direction.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center">
                    <div className="max-w-sm">
                      <CircleOff className="mx-auto mb-3 size-8 text-muted-foreground" />
                      <p className="text-sm leading-6 text-muted-foreground">
                        左の条件から方向性を作成すると、候補とリスクがここに並びます。
                      </p>
                    </div>
                  </div>
                )}

                {proposal?.questions.length ? (
                  <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
                    <h3 className="text-sm font-bold">追加で決めること</h3>
                    {proposal.questions.map((question) => (
                      <div key={question.id} className="grid gap-2 border-t border-border/80 pt-3 first:border-t-0 first:pt-0">
                        <p className="text-sm font-semibold">{question.question}</p>
                        <p className="text-xs leading-5 text-muted-foreground">{question.reason}</p>
                        <div className="flex flex-wrap gap-2">
                          {question.options.map((option) => (
                            <ChipButton
                              key={option.id}
                              active={answers[question.id] === option.label}
                              onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.label }))}
                              title={option.description}
                            >
                              {option.label}
                            </ChipButton>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </PanelBody>
            ) : null}

            {activeTab === "final" ? (
              <PanelBody className="grid gap-4">
                {finalOutput ? (
                  <>
                    <div className="grid gap-3 rounded-lg border border-primary/35 bg-primary/10 p-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="text-xs font-semibold text-primary">Selected Title</p>
                        <h2 className="mt-1 text-2xl font-bold">{finalOutput.selectedTitle}</h2>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone="primary">{finalOutput.recommendedModel}</Badge>
                          <Badge>{finalOutput.customMode ? "Custom Mode" : "Simple Mode"}</Badge>
                          <Badge>{finalOutput.instrumental ? "Instrumental" : "Lyrics"}</Badge>
                          {limits ? (
                            <Badge tone={promptLength > limits.promptMax ? "danger" : "accent"}>
                              {promptLength} / {limits.promptMax}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <CopyButton value={finalOutput.sunoCopyBlocks.title} label="タイトルをコピー" />
                    </div>

                    <div className="grid gap-3">
                      <OutputBlock title="Style" value={finalOutput.sunoCopyBlocks.style} rows={4} />
                      <OutputBlock title="Lyrics" value={finalOutput.sunoCopyBlocks.lyrics} rows={10} />
                      <OutputBlock title="Negative Tags" value={finalOutput.sunoCopyBlocks.negativeTags} rows={3} />
                      <OutputBlock title="Advanced" value={finalOutput.sunoCopyBlocks.advanced} rows={4} />
                    </div>

                    <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
                      <h3 className="text-sm font-bold">Rationale</h3>
                      <div className="grid gap-2 text-sm leading-6 text-muted-foreground md:grid-cols-2">
                        <p>{finalOutput.rationale.bpmReason}</p>
                        <p>{finalOutput.rationale.genreReason}</p>
                        <p>{finalOutput.rationale.instrumentReason}</p>
                        <p>{finalOutput.rationale.structureReason}</p>
                      </div>
                    </div>

                    <details className="rounded-lg border border-border bg-panel-strong">
                      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold">
                        Raw JSON
                        <ChevronDown className="size-4" />
                      </summary>
                      <pre className="max-h-96 overflow-auto border-t border-border p-4 text-xs leading-5 text-muted-foreground">
                        {JSON.stringify(finalOutput, null, 2)}
                      </pre>
                    </details>
                  </>
                ) : (
                  <div className="grid min-h-[560px] place-items-center rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center">
                    <div className="max-w-sm">
                      <WandSparkles className="mx-auto mb-3 size-9 text-primary" />
                      <h2 className="text-lg font-bold">Final プロンプトを生成</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        選択中の方向性と入力内容から、コピー用ブロックを作成します。
                      </p>
                      <Button className="mt-5" type="button" variant="primary" onClick={generateFinal} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        Final プロンプトを生成
                      </Button>
                    </div>
                  </div>
                )}
              </PanelBody>
            ) : null}

            {activeTab === "export" ? (
              <PanelBody className="grid gap-4">
                <div className="grid gap-3 rounded-lg border border-primary/35 bg-primary/10 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="text-xs font-semibold text-primary">Local Export</p>
                    <h2 className="mt-1 text-2xl font-bold">APIなしで書き出し</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone="primary">No OpenRouter</Badge>
                      <Badge>{localExport.selectedItemCount} items</Badge>
                      <Badge tone={selectedDirection ? "accent" : "warning"}>
                        {selectedDirection ? "Direction selected" : "Input only"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton value={localExport.markdown} label="Markdownをコピー" />
                    <Button type="button" variant="primary" onClick={downloadLocalMarkdown}>
                      <Download className="size-4" />
                      Markdown保存
                    </Button>
                  </div>
                </div>

                <OutputBlock title="Suno Style Prompt" value={localExport.stylePrompt} rows={6} />
                <OutputBlock title="Markdown for LLM" value={localExport.markdown} rows={16} />

                <div className="grid gap-3">
                  <h3 className="text-sm font-bold">含まれる選択項目</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2 rounded-md border border-border bg-panel-strong p-3">
                      <p className="text-xs font-semibold text-primary">Genre / Mood</p>
                      <p className="font-mono text-xs leading-5 text-muted-foreground">
                        {displayList([...input.genres, ...input.moods])}
                      </p>
                    </div>
                    <div className="grid gap-2 rounded-md border border-border bg-panel-strong p-3">
                      <p className="text-xs font-semibold text-primary">Instrument / Structure</p>
                      <p className="font-mono text-xs leading-5 text-muted-foreground">
                        {displayList([...input.instruments, ...input.structure])}
                      </p>
                    </div>
                    <div className="grid gap-2 rounded-md border border-border bg-panel-strong p-3">
                      <p className="text-xs font-semibold text-primary">Vocal / Lyrics</p>
                      <p className="font-mono text-xs leading-5 text-muted-foreground">
                        {displayList([
                          input.vocalType,
                          input.instrumental ? "Instrumental" : "Lyrics",
                          input.lyricLanguage,
                          input.lyricLength,
                          input.lyricTheme
                        ].filter(Boolean))}
                      </p>
                    </div>
                    <div className="grid gap-2 rounded-md border border-border bg-panel-strong p-3">
                      <p className="text-xs font-semibold text-primary">Priority / Avoid</p>
                      <p className="font-mono text-xs leading-5 text-muted-foreground">
                        {displayList([...input.priorities, ...input.avoid])}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">Suno補助ブロック</h3>
                    <Badge tone={input.avoid.length ? "warning" : "default"}>Negative</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <OutputBlock title="Negative Tags" value={localExport.negativeTags} rows={3} />
                    <OutputBlock title="Advanced" value={localExport.advancedSettings} rows={6} />
                  </div>
                </div>
              </PanelBody>
            ) : null}

            {activeTab === "revise" ? (
              <PanelBody className="grid gap-4">
                <div className="grid gap-3 rounded-lg border border-border bg-muted/25 p-4">
                  <div className="flex flex-wrap gap-2">
                    <ChipButton
                      active={revisionForm.mode === "new"}
                      onClick={() => updateRevisionForm("mode", "new")}
                    >
                      新規で修正案を作る
                    </ChipButton>
                    <ChipButton
                      active={revisionForm.mode === "cover"}
                      onClick={() => updateRevisionForm("mode", "cover")}
                    >
                      Coverとして修正
                    </ChipButton>
                    {finalOutput ? (
                      <Button type="button" variant="secondary" size="sm" onClick={loadFinalIntoRevision}>
                        <FileText className="size-4" />
                        Finalを読み込む
                      </Button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
                    {revisionOptions.map((option) => (
                      <ChipButton
                        key={option.id}
                        active={revisionForm.optionIds.includes(option.id)}
                        onClick={() => toggleRevisionOption(option.id)}
                      >
                        {option.label}
                      </ChipButton>
                    ))}
                  </div>

                  <textarea
                    className={cn(inputClassName, "min-h-28 resize-y leading-6")}
                    value={revisionForm.freeText}
                    onChange={(event) => updateRevisionForm("freeText", event.target.value)}
                    placeholder="追加要望"
                  />
                </div>

                <div className="grid gap-3 rounded-lg border border-border bg-muted/25 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <FileAudio className="size-4 text-primary" />
                      <h3 className="text-sm font-bold">音源解析</h3>
                      <Badge tone="accent">{audioAnalysis ? analysisEngineLabel(audioAnalysis.engine) : "Python Local"}</Badge>
                    </div>
                    {audioAnalysis ? (
                      <Badge tone={audioStyleApplied ? "primary" : "warning"}>
                        {audioStyleApplied ? "Style反映済み" : "反映待ち"}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-dashed border-border bg-panel-strong px-3 text-sm font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
                      <Upload className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 truncate">{audioFile ? audioFile.name : "音声ファイルを選択"}</span>
                      <input
                        className="sr-only"
                        type="file"
                        accept="audio/*,.wav,.mp3,.m4a,.aac,.flac,.ogg"
                        onChange={selectAudioFile}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={analyzeSelectedAudio}
                        disabled={isAnalyzingAudio || isAnalyzingAudioAdvanced || !audioFile}
                      >
                        {isAnalyzingAudio ? <Loader2 className="size-4 animate-spin" /> : <AudioWaveform className="size-4" />}
                        音源を解析
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={analyzeSelectedAudioAdvanced}
                        disabled={isAnalyzingAudio || isAnalyzingAudioAdvanced || !audioFile}
                      >
                        {isAnalyzingAudioAdvanced ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        高精度解析
                      </Button>
                    </div>
                  </div>

                  {audioAnalysisError ? (
                    <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm leading-6 text-danger">
                      {audioAnalysisError}
                    </p>
                  ) : null}

                  {audioAnalysisNotice ? (
                    <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm leading-6 text-warning">
                      {audioAnalysisNotice}
                    </p>
                  ) : null}

                  {audioAnalysis ? (
                    <div className="grid gap-3 border-t border-border/70 pt-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="primary">
                          {audioAnalysis.bpm ? `${audioAnalysis.bpm} BPM` : "BPM不明"}
                        </Badge>
                        <Badge tone="primary">
                          {audioAnalysis.key && audioAnalysis.mode
                            ? `${audioAnalysis.key} ${audioAnalysis.mode}`
                            : "キー不明"}
                        </Badge>
                        <Badge>尺 {formatSeconds(audioAnalysis.duration)}</Badge>
                        <Badge>構成 {audioAnalysis.structure.length} blocks</Badge>
                        <Badge>Tempo {confidencePercent(audioAnalysis.bpmConfidence)}</Badge>
                        <Badge>Key {confidencePercent(audioAnalysis.keyConfidence)}</Badge>
                      </div>

                      <p className="text-sm leading-6 text-muted-foreground">{audioAnalysis.summary}</p>

                      <div className="grid gap-3 rounded-md border border-border bg-panel-strong p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <SlidersHorizontal className="size-4 text-primary" />
                            <h4 className="text-xs font-semibold text-primary">Direction Board判定</h4>
                            {audioInputClassification ? (
                              <Badge tone={audioInputClassification.source === "ai" ? "primary" : "accent"}>
                                {audioInputClassificationLabel(audioInputClassification.source)}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={applyLocalAudioInputClassification}>
                              <CheckCircle2 className="size-4" />
                              ローカル判定で置き換え
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={classifyAudioInputWithApi}
                              disabled={isClassifyingAudioInput}
                            >
                              {isClassifyingAudioInput ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Sparkles className="size-4" />
                              )}
                              API高精度で置き換え
                            </Button>
                          </div>
                        </div>

                        {audioInputClassification ? (
                          <div className="grid gap-2">
                            <p className="text-xs leading-5 text-muted-foreground">{audioInputClassification.summary}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge>{audioInputClassification.input.bpmMin}-{audioInputClassification.input.bpmMax} BPM</Badge>
                              {audioInputClassification.input.genres.slice(0, 3).map((genre) => (
                                <Badge key={genre}>{genre}</Badge>
                              ))}
                              {audioInputClassification.input.moods.slice(0, 3).map((mood) => (
                                <Badge key={mood}>{mood}</Badge>
                              ))}
                              <Badge tone="accent">{confidencePercent(audioInputClassification.confidence)}</Badge>
                            </div>
                          </div>
                        ) : null}

                        {audioInputClassificationError ? (
                          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-5 text-danger">
                            {audioInputClassificationError}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-2 rounded-md border border-border bg-panel-strong p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="text-xs font-semibold text-primary">Suno再現スタイル案</h4>
                          <div className="flex flex-wrap gap-2">
                            <CopyButton value={audioAnalysis.sunoStyle} />
                            <Button type="button" variant="secondary" size="sm" onClick={applyAudioStyleToRevision}>
                              <CheckCircle2 className="size-4" />
                              既存Styleへ反映
                            </Button>
                          </div>
                        </div>
                        <textarea
                          className={cn(inputClassName, "min-h-28 resize-y font-mono text-xs leading-5")}
                          readOnly
                          value={audioAnalysis.sunoStyle}
                        />
                      </div>

                      <div className="grid gap-3 rounded-md border border-border bg-panel-strong p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 className="text-xs font-semibold text-primary">AIスタイル案</h4>
                            {audioStyleProposals ? (
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{audioStyleProposals.summary}</p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={generateAudioStyleProposals}
                            disabled={isGeneratingAudioStyles}
                          >
                            {isGeneratingAudioStyles ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Sparkles className="size-4" />
                            )}
                            3案を生成
                          </Button>
                        </div>

                        {audioStyleProposalError ? (
                          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-5 text-danger">
                            {audioStyleProposalError}
                          </p>
                        ) : null}

                        {audioStyleProposals ? (
                          <div className="grid gap-3">
                            {audioStyleProposals.proposals.map((proposal) => (
                              <article
                                key={proposal.id}
                                className={cn(
                                  "grid gap-3 rounded-md border bg-muted/25 p-3",
                                  appliedAudioStyleId === proposal.id ? "border-primary/70" : "border-border"
                                )}
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h5 className="text-sm font-bold">{proposal.name}</h5>
                                      {appliedAudioStyleId === proposal.id ? <Badge tone="primary">反映済み</Badge> : null}
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{proposal.intent}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <CopyButton value={proposal.style} />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => applyAudioStyleProposal(proposal)}>
                                      <CheckCircle2 className="size-4" />
                                      既存Styleへ反映
                                    </Button>
                                  </div>
                                </div>

                                <textarea
                                  className={cn(inputClassName, "min-h-24 resize-y font-mono text-xs leading-5")}
                                  readOnly
                                  value={proposal.style}
                                />
                                <div className="grid gap-2 text-xs leading-5 text-muted-foreground md:grid-cols-2">
                                  <p>{proposal.rationale}</p>
                                  <p>{proposal.bestUse}</p>
                                </div>
                                <div className="grid gap-2 rounded-md border border-border/70 bg-panel p-2">
                                  <p className="text-xs font-semibold text-warning">Negative</p>
                                  <p className="font-mono text-xs leading-5 text-muted-foreground">{proposal.negativeTags}</p>
                                </div>
                                {proposal.cautions.length ? (
                                  <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                                    {proposal.cautions.map((caution) => (
                                      <li key={caution}>{caution}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </article>
                            ))}
                            {audioStyleProposals.warnings.length ? (
                              <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
                                {audioStyleProposals.warnings.map((warning) => (
                                  <p key={warning}>{warning}</p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-2 rounded-md border border-border bg-panel-strong p-3">
                          <h4 className="text-xs font-semibold text-primary">構成推定</h4>
                          <div className="grid gap-2 text-xs leading-5 text-muted-foreground">
                            {audioAnalysis.structure.map((section, index) => (
                              <div key={`${section.label}-${section.start}-${index}`} className="grid gap-1 border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-foreground">{section.label}</span>
                                  <span>{confidencePercent(section.confidence)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span>
                                    {formatSeconds(section.start)} - {formatSeconds(section.end)}
                                  </span>
                                  <span>{section.energy > 0.68 ? "dense" : section.energy < 0.36 ? "soft" : "mid"}</span>
                                </div>
                                <span>{section.description}</span>
                                <span>{section.reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-2 rounded-md border border-border bg-panel-strong p-3">
                          <h4 className="text-xs font-semibold text-primary">楽器候補</h4>
                          <div className="grid gap-2 text-xs leading-5 text-muted-foreground">
                            {audioAnalysis.instruments.map((instrument) => (
                              <div key={instrument.label} className="grid gap-1 border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-foreground">{instrument.label}</span>
                                  <span>{confidencePercent(instrument.confidence)}</span>
                                </div>
                                <span>{instrument.reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {audioAnalysis.warnings.length ? (
                        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
                          {audioAnalysis.warnings.map((warning) => (
                            <p key={warning}>{warning}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="既存Style" icon={<SlidersHorizontal className="size-4 text-muted-foreground" />} className="border-b-0 py-0">
                    <textarea
                      className={cn(inputClassName, "min-h-40 resize-y font-mono text-xs leading-5")}
                      value={revisionForm.sourceStyle}
                      onChange={(event) => updateRevisionForm("sourceStyle", event.target.value)}
                      placeholder="Style"
                    />
                  </Field>
                  <Field label="既存Lyrics" icon={<BookOpen className="size-4 text-muted-foreground" />} className="border-b-0 py-0">
                    <textarea
                      className={cn(inputClassName, "min-h-40 resize-y font-mono text-xs leading-5")}
                      value={revisionForm.sourceLyrics}
                      onChange={(event) => updateRevisionForm("sourceLyrics", event.target.value)}
                      placeholder="Lyrics"
                    />
                  </Field>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <Field label="既存タイトル" className="border-b-0 py-0">
                    <input
                      className={inputClassName}
                      value={revisionForm.sourceTitle}
                      onChange={(event) => updateRevisionForm("sourceTitle", event.target.value)}
                      placeholder="タイトル"
                    />
                  </Field>
                  <Button type="button" variant="primary" size="lg" onClick={reviseOutput} disabled={isRevising}>
                    {isRevising ? <Loader2 className="size-5 animate-spin" /> : <WandSparkles className="size-5" />}
                    修正案を生成
                  </Button>
                </div>

                {revisionOutput ? (
                  <div className="grid gap-4">
                    <div className="grid gap-3 rounded-lg border border-primary/35 bg-primary/10 p-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="text-xs font-semibold text-primary">Revision</p>
                        <h2 className="mt-1 text-2xl font-bold">{revisionOutput.revisedTitle}</h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{revisionOutput.summary}</p>
                      </div>
                      <CopyButton value={revisionOutput.copyBlocks.title} label="タイトルをコピー" />
                    </div>

                    <div className="grid gap-3">
                      <OutputBlock title="Revised Style" value={revisionOutput.copyBlocks.style} rows={5} />
                      <OutputBlock title="Revised Lyrics" value={revisionOutput.copyBlocks.lyrics} rows={10} />
                      <OutputBlock title="Notes" value={revisionOutput.copyBlocks.notes} rows={5} />
                    </div>

                    <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
                      <h3 className="text-sm font-bold">変更内容</h3>
                      <div className="grid gap-4 text-sm leading-6 text-muted-foreground md:grid-cols-3">
                        <div>
                          <p className="mb-2 text-xs font-semibold text-primary">Style</p>
                          <ul className="space-y-1">
                            {revisionOutput.styleChanges.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold text-primary">Lyrics</p>
                          <ul className="space-y-1">
                            {revisionOutput.lyricChanges.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold text-primary">Arrange</p>
                          <ul className="space-y-1">
                            {revisionOutput.arrangementNotes.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {revisionOutput.warnings.length ? (
                        <div className="border-t border-border/80 pt-3">
                          <p className="mb-2 text-xs font-semibold text-warning">注意点</p>
                          <ul className="space-y-1 text-sm leading-6 text-muted-foreground">
                            {revisionOutput.warnings.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center">
                    <div className="max-w-sm">
                      <FileText className="mx-auto mb-3 size-9 text-primary" />
                      <h2 className="text-lg font-bold">修正案を生成</h2>
                    </div>
                  </div>
                )}
              </PanelBody>
            ) : null}

            {activeTab === "alternates" ? (
              <PanelBody className="grid gap-3">
                {finalOutput?.alternateDirections.length ? (
                  finalOutput.alternateDirections.map((direction) => (
                    <article key={direction.name} className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold">{direction.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{direction.description}</p>
                        </div>
                        <CopyButton value={`${direction.style}\n\nNegative: ${direction.negativeTags}`} />
                      </div>
                      <p className="font-mono text-xs leading-5 text-muted-foreground">{direction.style}</p>
                    </article>
                  ))
                ) : (
                  <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center text-sm text-muted-foreground">
                    Final生成後に別案が表示されます。
                  </div>
                )}
              </PanelBody>
            ) : null}

            {activeTab === "history" ? (
              <PanelBody className="grid gap-3">
                {history.length ? (
                  history.map((item) => (
                    <article
                      key={item.id}
                      className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 md:grid-cols-[1fr_auto] md:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{item.output.selectedTitle}</h3>
                          <Badge>{shortDate(item.createdAt)}</Badge>
                          {item.selectedDirectionName ? <Badge tone="primary">{item.selectedDirectionName}</Badge> : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {item.output.style}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => loadFromHistory(item)}>
                          読み込む
                        </Button>
                        <Button type="button" size="icon" variant="danger" onClick={() => deleteHistory(item.id)} aria-label="履歴を削除">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center text-sm text-muted-foreground">
                    保存済みの生成履歴はありません。
                  </div>
                )}
              </PanelBody>
            ) : null}
          </Panel>
        </section>

        <footer className="rounded-lg border border-border bg-panel/95 p-3 shadow-console backdrop-blur lg:sticky lg:bottom-3 lg:z-10">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full border border-primary bg-primary/15 text-sm font-bold text-primary">
                  {selectedDirection ? selectedDirectionIndex + 1 : "-"}
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">選択中の方向性</p>
                  <p className="font-semibold">{selectedDirection?.name ?? "未選択"}</p>
                </div>
              </div>
              <div className="hidden h-9 border-l border-border sm:block" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="size-4 text-primary" />
              <span>{isGenerating ? "生成中" : finalOutput ? "保存済み" : "準備完了"}</span>
              <Badge tone={selectedDirection ? "primary" : "default"}>
                {selectedDirection ? "Direction selected" : "Input only"}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedDirectionId(null);
                  setFinalOutput(null);
                }}
              >
                <X className="size-4" />
                クリア
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={proposeDirection} disabled={isProposing}>
                {isProposing ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
                方向性を提案
              </Button>
              <Button type="button" variant="primary" size="lg" onClick={generateFinal} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="size-5 animate-spin" /> : <WandSparkles className="size-5" />}
                Final プロンプトを生成
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
