import {
  genreOptions,
  instrumentOptions,
  moodOptions,
  priorityOptions,
  structureOptions,
  vocalOptions
} from "@/data/options";
import type { AudioAnalysisResult } from "@/lib/schemas/audioAnalysis";
import type { AudioInputClassification, AudioInputPatch } from "@/lib/schemas/audioInputClassification";

const genreSet = new Set(genreOptions);
const instrumentSet = new Set(instrumentOptions);
const moodSet = new Set(moodOptions);
const prioritySet = new Set(priorityOptions);
const structureSet = new Set(structureOptions);
const vocalSet = new Set(vocalOptions);

export function classifyAudioInputLocally(analysis: AudioAnalysisResult): AudioInputClassification {
  const text = analysisText(analysis);
  const bpm = classifyBpm(analysis);
  const genres = classifyGenres(analysis, text);
  const moods = classifyMoods(analysis);
  const instruments = classifyInstruments(analysis, text);
  const structure = classifyStructure(analysis);
  const vocal = classifyVocal(analysis, text);
  const priorities = classifyPriorities(analysis, genres, moods, structure);
  const confidence = estimateOverallConfidence(analysis);
  const input: AudioInputPatch = {
    moods,
    genres,
    ...bpm,
    vocalType: vocal.vocalType,
    vocalGender: "auto",
    instrumental: vocal.instrumental,
    instruments,
    structure,
    priorities,
    customMode: true,
    styleWeight: roundToTwo(confidence >= 0.68 ? 0.7 : 0.64),
    weirdnessConstraint: roundToTwo(analysis.energy > 0.7 && analysis.brightness > 0.62 ? 0.28 : 0.2),
    audioWeight: roundToTwo(confidence >= 0.68 ? 0.76 : 0.68),
    advancedNotes: buildAdvancedNotes(analysis, genres, moods)
  };

  return normalizeAudioInputClassification({
    source: "local",
    summary: `ローカル解析で${bpm.bpmMin}-${bpm.bpmMax} BPM、${genres.slice(0, 3).join(" / ")}、${moods.slice(0, 3).join(" / ")}として判定しました。`,
    confidence,
    input,
    rationale: buildRationale(analysis, input),
    warnings: buildLocalWarnings(analysis, vocal.instrumental)
  });
}

export function normalizeAudioInputClassification(classification: AudioInputClassification): AudioInputClassification {
  const bpmMin = clampInt(classification.input.bpmMin, 40, 240);
  const bpmMax = clampInt(classification.input.bpmMax, 40, 240);
  const moods = uniqueAllowed(classification.input.moods, moodSet, 6);
  const genres = uniqueAllowed(classification.input.genres, genreSet, 5);
  const instruments = uniqueAllowed(classification.input.instruments, instrumentSet, 7);
  const structure = normalizeStructureList(classification.input.structure).slice(0, 10);
  const priorities = uniqueAllowed(classification.input.priorities, prioritySet, 4);
  const vocalType = vocalSet.has(classification.input.vocalType)
    ? classification.input.vocalType
    : classification.input.instrumental
      ? "インスト"
      : "自動";

  return {
    ...classification,
    confidence: clamp01(classification.confidence),
    input: {
      ...classification.input,
      moods: moods.length ? moods : ["キャッチー"],
      genres: genres.length ? genres : ["ジェイポップ"],
      bpmMin: Math.min(bpmMin, bpmMax),
      bpmMax: Math.max(bpmMin, bpmMax),
      vocalType,
      instrumental: vocalType === "インスト" ? true : classification.input.instrumental,
      instruments: instruments.length ? instruments : ["シンセパッド"],
      structure: structure.length ? structure : ["Intro", "Verse", "Chorus", "Bridge", "Outro"],
      priorities: priorities.length ? priorities : ["雰囲気重視"],
      styleWeight: roundToTwo(clamp01(classification.input.styleWeight)),
      weirdnessConstraint: roundToTwo(clamp01(classification.input.weirdnessConstraint)),
      audioWeight: roundToTwo(clamp01(classification.input.audioWeight)),
      advancedNotes: classification.input.advancedNotes.trim()
    },
    rationale: classification.rationale.map((item) => item.trim()).filter(Boolean),
    warnings: classification.warnings.map((item) => item.trim()).filter(Boolean)
  };
}

function analysisText(analysis: AudioAnalysisResult) {
  return [
    analysis.summary,
    analysis.sunoStyle,
    ...analysis.instruments.flatMap((instrument) => [instrument.label, instrument.styleTag, instrument.reason]),
    ...analysis.structure.flatMap((section) => [section.label, section.description, section.reason]),
    ...analysis.warnings
  ]
    .join(" ")
    .toLowerCase();
}

function classifyBpm(analysis: AudioAnalysisResult) {
  if (analysis.bpm) {
    const spread = analysis.bpmConfidence >= 0.76 ? 4 : analysis.bpmConfidence >= 0.54 ? 7 : 12;
    return {
      bpmMin: clampInt(analysis.bpm - spread, 40, 240),
      bpmMax: clampInt(analysis.bpm + spread, 40, 240)
    };
  }

  if (analysis.energy >= 0.62) return { bpmMin: 128, bpmMax: 168 };
  if (analysis.energy <= 0.34) return { bpmMin: 68, bpmMax: 96 };
  return { bpmMin: 90, bpmMax: 126 };
}

function classifyGenres(analysis: AudioAnalysisResult, text: string) {
  const genres: string[] = [];

  addIf(genres, text, ["synth pop", "modern synth", "synth lead", "シンセ"], ["シンセポップ"]);
  addIf(genres, text, ["electropop", "electronic drums"], ["イーディーエム"]);
  addIf(genres, text, ["dance pop"], ["イーディーエム", "ジェイポップ"]);
  addIf(genres, text, ["future bass"], ["フューチャーベース"]);
  addIf(genres, text, ["guitar", "ギター"], [analysis.energy >= 0.58 ? "ポップロック" : "バンドポップ"]);
  addIf(genres, text, ["piano", "ピアノ"], [analysis.energy <= 0.44 ? "ピアノバラード" : "ピアノポップ"]);
  addIf(genres, text, ["strings", "orchestra", "cinematic", "ストリングス"], ["シネマティック"]);
  addIf(genres, text, ["orchestra", "オーケストラ"], ["オーケストラ"]);
  addIf(genres, text, ["downtempo", "chill"], ["チルアウト"]);
  addIf(genres, text, ["lofi", "lo-fi", "ローファイ"], ["ローファイ"]);
  addIf(genres, text, ["indie pop"], ["バンドポップ"]);

  if (!genres.length && analysis.bpm && analysis.bpm >= 128 && analysis.energy >= 0.54) genres.push("イーディーエム");
  if (!genres.length && analysis.brightness <= 0.38 && analysis.energy <= 0.45) genres.push("アンビエント");
  if (!genres.length) genres.push("ジェイポップ");

  return uniqueAllowed(genres, genreSet, 5);
}

function classifyMoods(analysis: AudioAnalysisResult) {
  const moods: string[] = [];

  if ((analysis.bpm ?? 0) >= 138 || analysis.energy >= 0.64) moods.push("疾走感");
  if (analysis.energy >= 0.54) moods.push("高揚感");
  if (analysis.brightness >= 0.56) moods.push("爽やか", "透明感");
  if (analysis.brightness >= 0.62 && analysis.energy <= 0.58) moods.push("浮遊感");
  if (analysis.mode === "minor") moods.push("切ない");
  if (analysis.energy <= 0.36) moods.push("静か", "儚い");
  if (analysis.mode === "minor" && analysis.brightness <= 0.42) moods.push("不穏");
  if (analysis.brightness <= 0.34) moods.push("ダーク");
  if (analysis.energy >= 0.58 && analysis.dynamics >= 0.55) moods.push("キャッチー");

  if (!moods.length) moods.push("キャッチー", "雰囲気重視");

  return uniqueAllowed(moods, moodSet, 6);
}

function classifyInstruments(analysis: AudioAnalysisResult, text: string) {
  const instruments: string[] = [];

  for (const instrument of analysis.instruments) {
    const itemText = `${instrument.label} ${instrument.styleTag} ${instrument.reason}`.toLowerCase();
    addIf(instruments, itemText, ["シンセベース", "synth bass"], ["シンセベース"]);
    addIf(instruments, itemText, ["sub bass", "サブベース"], ["サブベース"]);
    addIf(instruments, itemText, ["808"], ["808ベース"]);
    addIf(instruments, itemText, ["electric bass", "エレクトリックベース", "ベース"], ["ソフトベース"]);
    addIf(instruments, itemText, ["electronic drums", "電子ドラム"], ["電子ドラム"]);
    addIf(instruments, itemText, ["drum", "ドラム"], ["ドラムセット"]);
    addIf(instruments, itemText, ["percussion", "パーカッション"], ["生パーカッション"]);
    addIf(instruments, itemText, ["electric piano", "エレクトリックピアノ"], ["エレクトリックピアノ"]);
    addIf(instruments, itemText, ["piano", "ピアノ"], ["ピアノ"]);
    addIf(instruments, itemText, ["chord layer", "和音レイヤー", "pad"], ["シンセパッド"]);
    addIf(instruments, itemText, ["clean guitar", "クリーンギター"], ["クリーンギター"]);
    addIf(instruments, itemText, ["guitar", "ギター"], ["エレキギター"]);
    addIf(instruments, itemText, ["strings", "ストリングス"], ["ストリングス"]);
    addIf(instruments, itemText, ["synth pad", "シンセパッド"], ["シンセパッド"]);
    addIf(instruments, itemText, ["synth lead", "シンセリード"], ["シンセリード"]);
    addIf(instruments, itemText, ["bell", "ベル"], ["ベル"]);
    addIf(instruments, itemText, ["choir", "クワイア", "合唱"], ["クワイア"]);
  }

  if (!instruments.length) {
    addIf(instruments, text, ["synth"], ["シンセパッド"]);
    addIf(instruments, text, ["piano"], ["ピアノ"]);
    addIf(instruments, text, ["drum"], ["ドラムセット"]);
  }

  if (!instruments.length) instruments.push("シンセパッド", "ソフトベース");

  return uniqueAllowed(instruments, instrumentSet, 7);
}

function classifyStructure(analysis: AudioAnalysisResult) {
  const labels = normalizeStructureList(analysis.structure.map((section) => section.label));

  if (labels.length) return labels.slice(0, 10);
  if (analysis.energy >= 0.6 && (analysis.bpm ?? 0) >= 124) {
    return ["Intro", "Verse", "Build-up", "Drop", "Breakdown", "Final Drop", "Outro"];
  }

  return ["Intro", "Verse", "Chorus", "Bridge", "Outro"];
}

function classifyVocal(analysis: AudioAnalysisResult, text: string) {
  const hasVocalStem = text.includes("ボーカルstem") || text.includes("lead vocal presence");
  const hasChoir = text.includes("choir") || text.includes("クワイア") || text.includes("合唱");
  const stronglyInstrumental = analysis.engine === "advanced-local" && !hasVocalStem && !hasChoir;

  if (hasChoir) return { vocalType: "コーラス多め", instrumental: false };
  if (stronglyInstrumental) return { vocalType: "インスト", instrumental: true };
  return { vocalType: "自動", instrumental: false };
}

function classifyPriorities(
  analysis: AudioAnalysisResult,
  genres: string[],
  moods: string[],
  structure: string[]
) {
  const priorities: string[] = [];

  if (moods.includes("キャッチー") || (analysis.energy >= 0.48 && analysis.brightness >= 0.46)) priorities.push("キャッチー");
  if (analysis.energy <= 0.5 || genres.some((genre) => ["シネマティック", "アンビエント", "チルアウト"].includes(genre))) {
    priorities.push("雰囲気重視");
  }
  if ((analysis.bpm ?? 0) >= 118 && analysis.energy >= 0.54) priorities.push("踊れる");
  if (analysis.duration <= 105 || structure.length <= 4) priorities.push("短く強い");

  if (!priorities.length) priorities.push("雰囲気重視");

  return uniqueAllowed(priorities, prioritySet, 4);
}

function estimateOverallConfidence(analysis: AudioAnalysisResult) {
  const instrumentConfidence = analysis.instruments.length
    ? average(analysis.instruments.slice(0, 4).map((instrument) => instrument.confidence))
    : 0.42;
  const structureConfidence = analysis.structure.length
    ? average(analysis.structure.map((section) => section.confidence))
    : 0.42;

  return roundToTwo(clamp01(analysis.bpmConfidence * 0.28 + analysis.keyConfidence * 0.14 + instrumentConfidence * 0.34 + structureConfidence * 0.24));
}

function buildAdvancedNotes(analysis: AudioAnalysisResult, genres: string[], moods: string[]) {
  const bpmText = analysis.bpm ? `${analysis.bpm} BPM` : "BPM不明";
  const keyText = analysis.key && analysis.mode ? `${analysis.key} ${analysis.mode}` : "キー不明";
  const engineText = analysis.engine === "advanced-local" ? "高精度解析" : analysis.engine === "python-librosa" ? "Python解析" : "ブラウザ簡易解析";
  return `音源解析反映: ${engineText} / ${bpmText} / ${keyText} / ${genres.slice(0, 3).join("・")} / ${moods.slice(0, 3).join("・")}`;
}

function buildRationale(analysis: AudioAnalysisResult, input: AudioInputPatch) {
  const instrumentText = analysis.instruments
    .slice(0, 3)
    .map((instrument) => `${instrument.label} ${Math.round(instrument.confidence * 100)}%`)
    .join("、");

  return [
    `BPMは解析値と確信度から${input.bpmMin}-${input.bpmMax}に設定。`,
    `ジャンルは${input.genres.join(" / ")}、ムードは${input.moods.join(" / ")}を優先。`,
    instrumentText ? `主な楽器候補は${instrumentText}。` : "楽器候補は保守的に判定。",
    `構成は${input.structure.join(" > ")}として反映。`
  ];
}

function buildLocalWarnings(analysis: AudioAnalysisResult, instrumental: boolean) {
  const warnings: string[] = [];

  if (analysis.bpmConfidence < 0.45) warnings.push("BPM確信度が低めです。必要に応じて手動調整してください。");
  if (analysis.instruments.every((instrument) => instrument.confidence < 0.5)) {
    warnings.push("楽器推定の確信度が低めです。");
  }
  if (!instrumental && analysis.engine !== "advanced-local") {
    warnings.push("ローカル通常解析ではボーカル有無の判定が弱いため、ボーカルは自動にしています。");
  }

  return warnings;
}

function normalizeStructureList(values: string[]) {
  const mapped = values
    .map((value) => normalizeStructureLabel(value))
    .filter((value): value is string => Boolean(value) && structureSet.has(value));

  return mapped.filter((value, index) => index === 0 || value !== mapped[index - 1]);
}

function normalizeStructureLabel(value: string) {
  const key = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
  const mapping: Record<string, string> = {
    break: "Breakdown",
    breakdown: "Breakdown",
    bridge: "Bridge",
    "build-up": "Build-up",
    buildup: "Build-up",
    chorus: "Chorus",
    drop: "Drop",
    "final-chorus": "Final Chorus",
    "final-drop": "Final Drop",
    inst: "Instrumental Solo",
    instrumental: "Instrumental Solo",
    intro: "Intro",
    outro: "Outro",
    "post-chorus": "Post-Chorus",
    prechorus: "Pre-Chorus",
    "pre-chorus": "Pre-Chorus",
    solo: "Instrumental Solo",
    verse: "Verse"
  };

  return mapping[key] ?? value.trim();
}

function addIf(output: string[], text: string, needles: string[], values: string[]) {
  if (needles.some((needle) => text.includes(needle.toLowerCase()))) {
    output.push(...values);
  }
}

function uniqueAllowed(values: string[], allowed: Set<string>, limit: number) {
  const output: string[] = [];

  for (const value of values) {
    const clean = value.trim();
    if (!clean || !allowed.has(clean) || output.includes(clean)) continue;
    output.push(clean);
    if (output.length >= limit) break;
  }

  return output;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value), min), max);
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}
