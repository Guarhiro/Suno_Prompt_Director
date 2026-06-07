import type { AudioAnalysisInstrument, AudioAnalysisResult, AudioAnalysisSection } from "@/lib/schemas/audioAnalysis";
export type { AudioAnalysisInstrument, AudioAnalysisResult, AudioAnalysisSection } from "@/lib/schemas/audioAnalysis";

type TempoEstimate = {
  bpm: number | null;
  confidence: number;
  onsetRate: number;
};

type TonalEstimate = {
  key: string | null;
  mode: "major" | "minor" | null;
  confidence: number;
  chroma: number[];
};

type BandProfile = {
  lowRatio: number;
  bassRatio: number;
  midRatio: number;
  highRatio: number;
  airRatio: number;
};

type FeatureProfile = {
  energy: number;
  brightness: number;
  dynamics: number;
  onsetRate: number;
  bandProfile: BandProfile;
};

const MAX_ANALYSIS_SECONDS = 300;
const TARGET_SAMPLE_RATE = 22050;
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export async function analyzeAudioFileOnServer(file: File): Promise<AudioAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/analyze-audio", {
    method: "POST",
    body: formData
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? "Python音声解析に失敗しました。");
  }

  return data as AudioAnalysisResult;
}

export async function analyzeAudioFileAdvancedOnServer(file: File): Promise<AudioAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/analyze-audio-advanced", {
    method: "POST",
    body: formData
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? "高精度音声解析に失敗しました。");
  }

  return data as AudioAnalysisResult;
}

export async function analyzeAudioFile(file: File): Promise<AudioAnalysisResult> {
  const audioContext = new AudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    const limited = mixToMono(decoded, MAX_ANALYSIS_SECONDS);
    const resampled = resample(limited.signal, decoded.sampleRate, TARGET_SAMPLE_RATE);

    const tempo = estimateTempo(resampled.signal, resampled.sampleRate);
    const tonal = estimateKey(resampled.signal, resampled.sampleRate);
    const profile = analyzeFeatureProfile(resampled.signal, resampled.sampleRate, tempo.onsetRate);
    const structure = estimateStructure(resampled.signal, resampled.sampleRate, tempo.bpm, limited.duration);
    const instruments = inferInstruments(profile, tempo);
    const sunoStyle = buildSunoStyle({
      tempo,
      tonal,
      profile,
      structure,
      instruments
    });
    const warnings = buildWarnings(decoded.duration, limited.duration, instruments);

    return {
      engine: "browser-basic",
      fileName: file.name,
      duration: decoded.duration,
      analyzedDuration: limited.duration,
      sampleRate: decoded.sampleRate,
      bpm: tempo.bpm,
      bpmConfidence: tempo.confidence,
      key: tonal.key,
      mode: tonal.mode,
      keyConfidence: tonal.confidence,
      energy: profile.energy,
      brightness: profile.brightness,
      dynamics: profile.dynamics,
      structure,
      instruments,
      sunoStyle,
      summary: buildSummary(tempo, tonal, profile, instruments),
      warnings
    };
  } finally {
    void audioContext.close();
  }
}

function mixToMono(buffer: AudioBuffer, maxSeconds: number) {
  const sampleCount = Math.min(buffer.length, Math.floor(buffer.sampleRate * maxSeconds));
  const signal = new Float32Array(sampleCount);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < sampleCount; index += 1) {
      signal[index] += data[index] / buffer.numberOfChannels;
    }
  }

  return {
    signal,
    duration: sampleCount / buffer.sampleRate
  };
}

function resample(signal: Float32Array, sourceRate: number, targetRate: number) {
  if (sourceRate <= targetRate) {
    return { signal, sampleRate: sourceRate };
  }

  const ratio = sourceRate / targetRate;
  const length = Math.floor(signal.length / ratio);
  const output = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    const sourceIndex = index * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(signal.length - 1, left + 1);
    const fraction = sourceIndex - left;
    output[index] = signal[left] * (1 - fraction) + signal[right] * fraction;
  }

  return {
    signal: output,
    sampleRate: targetRate
  };
}

function estimateTempo(signal: Float32Array, sampleRate: number): TempoEstimate {
  const frameSize = Math.max(512, Math.round(sampleRate * 0.046));
  const hopSize = Math.max(256, Math.round(sampleRate * 0.023));
  const envelope = onsetEnvelope(signal, frameSize, hopSize);

  if (envelope.length < 16) {
    return { bpm: null, confidence: 0, onsetRate: 0 };
  }

  const hopSeconds = hopSize / sampleRate;
  const minBpm = 55;
  const maxBpm = 210;
  const minLag = Math.max(2, Math.floor(60 / maxBpm / hopSeconds));
  const maxLag = Math.min(envelope.length - 2, Math.ceil(60 / minBpm / hopSeconds));
  const scores: Array<{ bpm: number; score: number }> = [];
  let totalScore = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    let count = 0;

    for (let index = 0; index + lag < envelope.length; index += 1) {
      score += envelope[index] * envelope[index + lag];
      count += 1;
    }

    const bpm = 60 / (lag * hopSeconds);
    const preference = tempoPreference(bpm);
    const normalizedScore = count > 0 ? (score / count) * preference : 0;
    scores.push({ bpm, score: normalizedScore });
    totalScore += normalizedScore;
  }

  scores.sort((left, right) => right.score - left.score);
  const best = scores[0];

  if (!best || best.score <= 0) {
    return { bpm: null, confidence: 0, onsetRate: estimateOnsetRate(envelope, hopSeconds) };
  }

  const correctedBpm = correctTempoOctave(best.bpm, best.score, scores);
  const averageScore = totalScore / Math.max(1, scores.length);
  const confidence = clamp01((best.score - averageScore) / Math.max(best.score, 0.0001));

  return {
    bpm: Math.round(correctedBpm),
    confidence,
    onsetRate: estimateOnsetRate(envelope, hopSeconds)
  };
}

function onsetEnvelope(signal: Float32Array, frameSize: number, hopSize: number) {
  const frames = Math.max(0, Math.floor((signal.length - frameSize) / hopSize));
  const rms = new Float32Array(frames);

  for (let frame = 0; frame < frames; frame += 1) {
    const offset = frame * hopSize;
    let sum = 0;

    for (let index = 0; index < frameSize; index += 1) {
      const value = signal[offset + index];
      sum += value * value;
    }

    rms[frame] = Math.sqrt(sum / frameSize);
  }

  const envelope = new Float32Array(frames);
  let maxValue = 0;

  for (let index = 1; index < frames; index += 1) {
    const value = Math.max(0, rms[index] - rms[index - 1] * 0.96);
    envelope[index] = value;
    maxValue = Math.max(maxValue, value);
  }

  if (maxValue <= 0) return envelope;

  for (let index = 0; index < envelope.length; index += 1) {
    const previous = envelope[Math.max(0, index - 1)];
    const current = envelope[index];
    const next = envelope[Math.min(envelope.length - 1, index + 1)];
    envelope[index] = (previous + current * 2 + next) / (maxValue * 4);
  }

  return envelope;
}

function tempoPreference(bpm: number) {
  if (bpm >= 72 && bpm <= 168) return 1;
  if (bpm >= 60 && bpm < 72) return 0.88;
  if (bpm > 168 && bpm <= 190) return 0.9;
  return 0.78;
}

function correctTempoOctave(bpm: number, score: number, scores: Array<{ bpm: number; score: number }>) {
  const half = closestTempoScore(scores, bpm / 2);
  const double = closestTempoScore(scores, bpm * 2);

  if (bpm < 78 && double && double.score > score * 0.7) {
    return double.bpm;
  }

  if (bpm > 176 && half && half.score > score * 0.74) {
    return half.bpm;
  }

  return bpm;
}

function closestTempoScore(scores: Array<{ bpm: number; score: number }>, targetBpm: number) {
  if (targetBpm < 55 || targetBpm > 210) return null;

  return scores.reduce<{ bpm: number; score: number } | null>((best, item) => {
    if (!best) return item;
    return Math.abs(item.bpm - targetBpm) < Math.abs(best.bpm - targetBpm) ? item : best;
  }, null);
}

function estimateOnsetRate(envelope: Float32Array, hopSeconds: number) {
  const threshold = percentile(Array.from(envelope), 0.72);
  let hits = 0;

  for (const value of envelope) {
    if (value > threshold && value > 0.02) hits += 1;
  }

  return hits / Math.max(envelope.length * hopSeconds, 1);
}

function estimateKey(signal: Float32Array, sampleRate: number): TonalEstimate {
  const frameSize = 4096;
  const hopSize = Math.max(frameSize, Math.round(sampleRate * 0.45));
  const chroma = Array.from({ length: 12 }, () => 0);
  let analyzedFrames = 0;

  for (let offset = 0; offset + frameSize < signal.length; offset += hopSize) {
    const frameEnergy = rms(signal, offset, frameSize);
    if (frameEnergy < 0.008) continue;

    for (let midi = 36; midi <= 84; midi += 1) {
      const frequency = midiToFrequency(midi);
      if (frequency >= sampleRate / 2) continue;
      const pitchClass = midi % 12;
      const power = goertzelPower(signal, offset, frameSize, sampleRate, frequency);
      chroma[pitchClass] += Math.sqrt(power) / Math.sqrt(frequency);
    }

    analyzedFrames += 1;
    if (analyzedFrames >= 520) break;
  }

  const total = chroma.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return { key: null, mode: null, confidence: 0, chroma };
  }

  const normalized = chroma.map((value) => value / total);
  const scores: Array<{ root: number; mode: "major" | "minor"; score: number }> = [];

  for (let root = 0; root < 12; root += 1) {
    scores.push({ root, mode: "major", score: profileScore(normalized, MAJOR_PROFILE, root) });
    scores.push({ root, mode: "minor", score: profileScore(normalized, MINOR_PROFILE, root) });
  }

  scores.sort((left, right) => right.score - left.score);
  const best = scores[0];
  const second = scores[1];
  const confidence = best && second ? clamp01((best.score - second.score) * 3.2) : 0;

  return {
    key: best ? NOTE_NAMES[best.root] : null,
    mode: best?.mode ?? null,
    confidence,
    chroma: normalized
  };
}

function profileScore(chroma: number[], profile: number[], root: number) {
  const profileTotal = profile.reduce((sum, value) => sum + value, 0);
  let score = 0;

  for (let index = 0; index < 12; index += 1) {
    score += chroma[(index + root) % 12] * (profile[index] / profileTotal);
  }

  return score;
}

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function goertzelPower(signal: Float32Array, offset: number, frameSize: number, sampleRate: number, frequency: number) {
  const normalizedFrequency = frequency / sampleRate;
  const coefficient = 2 * Math.cos(2 * Math.PI * normalizedFrequency);
  let previous = 0;
  let previous2 = 0;

  for (let index = 0; index < frameSize; index += 1) {
    const current = signal[offset + index] + coefficient * previous - previous2;
    previous2 = previous;
    previous = current;
  }

  return previous2 * previous2 + previous * previous - coefficient * previous * previous2;
}

function analyzeFeatureProfile(signal: Float32Array, sampleRate: number, onsetRate: number): FeatureProfile {
  const frameSize = 2048;
  const hopSize = Math.max(frameSize, Math.round(sampleRate * 0.8));
  const rmsValues: number[] = [];
  let zeroCrossings = 0;
  let zeroCrossingSamples = 0;

  for (let offset = 0; offset + frameSize < signal.length; offset += hopSize) {
    rmsValues.push(rms(signal, offset, frameSize));

    for (let index = offset + 1; index < offset + frameSize; index += 1) {
      if ((signal[index - 1] >= 0 && signal[index] < 0) || (signal[index - 1] < 0 && signal[index] >= 0)) {
        zeroCrossings += 1;
      }
      zeroCrossingSamples += 1;
    }
  }

  const averageEnergy = average(rmsValues);
  const dynamics = clamp01((percentile(rmsValues, 0.9) - percentile(rmsValues, 0.1)) / 0.22);
  const brightness = clamp01((zeroCrossings / Math.max(zeroCrossingSamples, 1)) * 18);
  const bandProfile = estimateBandProfile(signal, sampleRate);

  return {
    energy: clamp01(averageEnergy / 0.16),
    brightness: clamp01((brightness + bandProfile.highRatio + bandProfile.airRatio * 1.25) / 2.7),
    dynamics,
    onsetRate,
    bandProfile
  };
}

function estimateBandProfile(signal: Float32Array, sampleRate: number): BandProfile {
  const frameSize = 2048;
  const hopSize = Math.max(frameSize, Math.round(sampleRate * 1.2));
  const bands = [
    { key: "low", frequencies: [55, 82, 110, 150] },
    { key: "bass", frequencies: [180, 240, 320] },
    { key: "mid", frequencies: [500, 800, 1200, 1800] },
    { key: "high", frequencies: [2600, 3600, 4800] },
    { key: "air", frequencies: [6200, 7800, 9200] }
  ] as const;
  const totals = {
    low: 0,
    bass: 0,
    mid: 0,
    high: 0,
    air: 0
  };
  let frames = 0;

  for (let offset = 0; offset + frameSize < signal.length; offset += hopSize) {
    if (rms(signal, offset, frameSize) < 0.006) continue;

    for (const band of bands) {
      for (const frequency of band.frequencies) {
        if (frequency < sampleRate / 2) {
          totals[band.key] += Math.sqrt(goertzelPower(signal, offset, frameSize, sampleRate, frequency));
        }
      }
    }

    frames += 1;
    if (frames >= 260) break;
  }

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0) || 1;

  return {
    lowRatio: totals.low / total,
    bassRatio: totals.bass / total,
    midRatio: totals.mid / total,
    highRatio: totals.high / total,
    airRatio: totals.air / total
  };
}

function estimateStructure(signal: Float32Array, sampleRate: number, bpm: number | null, duration: number): AudioAnalysisSection[] {
  const phraseSeconds = bpm ? clamp((60 / bpm) * 32, 13, 30) : 18;
  const sectionCount = clamp(Math.round(duration / phraseSeconds), 3, 8);
  const sectionSeconds = duration / sectionCount;
  const sections = Array.from({ length: sectionCount }, (_, index) => {
    const start = index * sectionSeconds;
    const end = index === sectionCount - 1 ? duration : (index + 1) * sectionSeconds;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.min(signal.length, Math.floor(end * sampleRate));
    const features = sectionFeatures(signal, sampleRate, startSample, endSample);

    return {
      index,
      start,
      end,
      ...features
    };
  });
  const energies = sections.map((section) => section.energy);
  const highEnergy = percentile(energies, 0.72);
  const lowEnergy = percentile(energies, 0.28);
  const firstChorusIndex = sections.findIndex((section, index) => index > 0 && section.energy >= highEnergy);

  return sections.map((section) => {
    const label = inferSectionLabel({
      index: section.index,
      count: sections.length,
      energy: section.energy,
      brightness: section.brightness,
      lowEnergy,
      highEnergy,
      firstChorusIndex
    });

    return {
      label,
      start: section.start,
      end: section.end,
      energy: section.energy,
      brightness: section.brightness,
      confidence: sectionConfidence({
        index: section.index,
        count: sections.length,
        energy: section.energy,
        brightness: section.brightness,
        lowEnergy,
        highEnergy,
        label
      }),
      reason: sectionReason(label, section.index, sections.length, section.energy, lowEnergy, highEnergy),
      description: sectionDescription(label, section.energy, section.brightness)
    };
  });
}

function sectionFeatures(signal: Float32Array, sampleRate: number, startSample: number, endSample: number) {
  const frameSize = 1024;
  const hopSize = Math.max(frameSize, Math.round(sampleRate * 0.5));
  const values: number[] = [];
  let zeroCrossings = 0;
  let samples = 0;

  for (let offset = startSample; offset + frameSize < endSample; offset += hopSize) {
    values.push(rms(signal, offset, frameSize));

    for (let index = offset + 1; index < offset + frameSize; index += 1) {
      if ((signal[index - 1] >= 0 && signal[index] < 0) || (signal[index - 1] < 0 && signal[index] >= 0)) {
        zeroCrossings += 1;
      }
      samples += 1;
    }
  }

  return {
    energy: clamp01(average(values) / 0.16),
    brightness: clamp01((zeroCrossings / Math.max(samples, 1)) * 18)
  };
}

function inferSectionLabel({
  index,
  count,
  energy,
  brightness,
  lowEnergy,
  highEnergy,
  firstChorusIndex
}: {
  index: number;
  count: number;
  energy: number;
  brightness: number;
  lowEnergy: number;
  highEnergy: number;
  firstChorusIndex: number;
}) {
  if (index === 0) return energy <= lowEnergy * 1.08 ? "Intro" : "Verse";
  if (index === count - 1) return energy <= highEnergy * 0.92 ? "Outro" : "Final Chorus";
  if (firstChorusIndex > 1 && index === firstChorusIndex - 1) return "Pre-Chorus";
  if (energy >= highEnergy) return "Chorus";
  if (index > Math.floor(count * 0.55) && brightness < 0.42 && energy <= lowEnergy * 1.12) return "Bridge";
  return "Verse";
}

function sectionDescription(label: string, energy: number, brightness: number) {
  const energyText = energy > 0.68 ? "高めの密度" : energy < 0.36 ? "抑えめの密度" : "中程度の密度";
  const brightnessText = brightness > 0.6 ? "明るい音像" : brightness < 0.35 ? "丸い音像" : "自然な明るさ";
  return `${label}: ${energyText} / ${brightnessText}`;
}

function sectionConfidence({
  index,
  count,
  energy,
  brightness,
  lowEnergy,
  highEnergy,
  label
}: {
  index: number;
  count: number;
  energy: number;
  brightness: number;
  lowEnergy: number;
  highEnergy: number;
  label: string;
}) {
  const positionalConfidence = index === 0 || index === count - 1 ? 0.18 : 0.08;
  const energyDistance = Math.max(Math.abs(energy - lowEnergy), Math.abs(energy - highEnergy));
  const energyConfidence = clamp01(energyDistance * 1.35);
  const brightnessConfidence = label === "Bridge" && brightness < 0.42 ? 0.2 : 0.08;
  return clamp01(0.42 + positionalConfidence + energyConfidence * 0.28 + brightnessConfidence);
}

function sectionReason(label: string, index: number, count: number, energy: number, lowEnergy: number, highEnergy: number) {
  const energyText = energy >= highEnergy ? "密度が高い" : energy <= lowEnergy ? "密度が低い" : "密度が中程度";

  if (index === 0) return `冒頭区間で${energyText}ため、${label}として推定。`;
  if (index === count - 1) return `終端区間で${energyText}ため、${label}として推定。`;
  return `${energyText}区間として、位置と音量変化から${label}寄りに推定。`;
}

function inferInstruments(profile: FeatureProfile, tempo: TempoEstimate): AudioAnalysisInstrument[] {
  const instruments: AudioAnalysisInstrument[] = [];
  const { bandProfile } = profile;

  if (bandProfile.lowRatio + bandProfile.bassRatio > 0.34) {
    instruments.push({
      label: bandProfile.lowRatio > 0.22 ? "シンセベース / サブベース" : "エレクトリックベース",
      styleTag: bandProfile.lowRatio > 0.22 ? "deep synth bass" : "warm electric bass",
      confidence: clamp01((bandProfile.lowRatio + bandProfile.bassRatio) * 1.7),
      reason: "低域の継続成分が強め"
    });
  }

  if (tempo.onsetRate > 0.62 || profile.dynamics > 0.5) {
    instruments.push({
      label: profile.brightness > 0.55 ? "電子ドラム / パーカッション" : "ドラムセット",
      styleTag: profile.brightness > 0.55 ? "crisp electronic drums" : "steady drum kit",
      confidence: clamp01(tempo.onsetRate / 1.8 + profile.dynamics * 0.45),
      reason: "オンセット量と音量変化からリズム楽器を推定"
    });
  }

  const pianoScore = browserPianoLikelihood(profile);
  const chordLayerScore = browserChordLayerLikelihood(profile);
  if (pianoScore >= 0.76) {
    instruments.push({
      label: "ピアノ / エレクトリックピアノ",
      styleTag: "warm piano and electric piano",
      confidence: pianoScore,
      reason: "中域の和音感に加え、打鍵に近い音量変化と自然な明るさがある"
    });
  } else if (chordLayerScore >= 0.52) {
    instruments.push({
      label: "和音レイヤー / 鍵盤系パッド",
      styleTag: "warm harmonic chord layer",
      confidence: Math.min(chordLayerScore, 0.66),
      reason: "中域の和音感はあるが、ピアノ特有の打鍵条件が弱いため保守的に推定"
    });
  }

  if (bandProfile.highRatio > 0.19 && profile.onsetRate > 0.34) {
    instruments.push({
      label: "クリーンギター / プラック",
      styleTag: "clean guitar plucks",
      confidence: clamp01(bandProfile.highRatio * 2.3 + profile.onsetRate * 0.18),
      reason: "高域のアタック成分が目立つ"
    });
  }

  if (profile.onsetRate < 0.75 && profile.dynamics < 0.58) {
    instruments.push({
      label: "シンセパッド / ストリングス",
      styleTag: profile.brightness > 0.48 ? "shimmering synth pads" : "soft strings and pads",
      confidence: clamp01(0.62 - profile.onsetRate * 0.22 + (1 - profile.dynamics) * 0.35),
      reason: "持続音向きのなだらかな音量変化"
    });
  }

  if (bandProfile.airRatio > 0.13 || profile.brightness > 0.67) {
    instruments.push({
      label: "シンセリード / ベル",
      styleTag: "bright synth lead accents",
      confidence: clamp01(bandProfile.airRatio * 2.7 + profile.brightness * 0.35),
      reason: "上モノの明るい倍音が多い"
    });
  }

  if (!instruments.length) {
    instruments.push({
      label: "ミニマルな伴奏",
      styleTag: "minimal atmospheric accompaniment",
      confidence: 0.42,
      reason: "明確な楽器特徴が少ない"
    });
  }

  return instruments
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 5);
}

function buildSunoStyle({
  tempo,
  tonal,
  profile,
  structure,
  instruments
}: {
  tempo: TempoEstimate;
  tonal: TonalEstimate;
  profile: FeatureProfile;
  structure: AudioAnalysisSection[];
  instruments: AudioAnalysisInstrument[];
}) {
  const genreTags = inferGenreTags(tempo, profile, instruments);
  const moodTags = inferMoodTags(tonal, profile);
  const tempoTag = tempo.bpm ? `${tempo.bpm} BPM` : "moderate tempo";
  const keyTag = tonal.key && tonal.mode ? `${tonal.key} ${tonal.mode}` : "tonal pop harmony";
  const instrumentTags = instruments.map((instrument) => instrument.styleTag).slice(0, 4);
  const structureTags = compactStructure(structure);
  const productionTags = profile.brightness > 0.58 ? "bright polished mix" : "warm polished mix";
  const dynamicsTags = profile.energy > 0.62 ? "high-energy layered arrangement" : "restrained detailed arrangement";

  return [
    tempoTag,
    keyTag,
    ...genreTags,
    ...moodTags,
    ...instrumentTags,
    `${structureTags} arrangement`,
    "clear section contrast",
    dynamicsTags,
    productionTags,
  ].join(", ");
}

function inferGenreTags(tempo: TempoEstimate, profile: FeatureProfile, instruments: AudioAnalysisInstrument[]) {
  const tags: string[] = [];
  const instrumentText = instruments.map((instrument) => instrument.styleTag).join(" ");
  const bpm = tempo.bpm ?? 100;

  if (instrumentText.includes("synth") && profile.brightness > 0.5) tags.push("modern synth pop");
  if (instrumentText.includes("electronic drums") && bpm >= 112) tags.push("electropop");
  if (instrumentText.includes("guitar") && bpm < 130) tags.push("indie pop");
  if (instrumentText.includes("piano") && bpm < 108) tags.push("cinematic piano pop");
  if (bpm < 86) tags.push("downtempo");
  if (bpm >= 128 && tags.length < 2) tags.push("dance pop");
  if (!tags.length) tags.push("melodic pop");

  return tags.slice(0, 3);
}

function inferMoodTags(tonal: TonalEstimate, profile: FeatureProfile) {
  const tags: string[] = [];

  if (tonal.mode === "minor") tags.push("emotional");
  if (tonal.mode === "major" && profile.brightness > 0.48) tags.push("uplifting");
  if (profile.energy > 0.62) tags.push("driving");
  if (profile.energy < 0.34) tags.push("intimate");
  if (profile.brightness > 0.6) tags.push("shimmering");
  if (profile.brightness < 0.34) tags.push("warm");

  return tags.length ? tags.slice(0, 3) : ["balanced mood"];
}

function compactStructure(structure: AudioAnalysisSection[]) {
  const labels = structure.map((section) => section.label.replace("Final Chorus", "Chorus"));
  const compact = labels.filter((label, index) => index === 0 || label !== labels[index - 1]);
  return compact.join("-").toLowerCase();
}

function buildSummary(
  tempo: TempoEstimate,
  tonal: TonalEstimate,
  profile: FeatureProfile,
  instruments: AudioAnalysisInstrument[]
) {
  const bpmText = tempo.bpm ? `${tempo.bpm} BPM` : "BPM不明";
  const keyText = tonal.key && tonal.mode ? `${tonal.key} ${tonal.mode}` : "キー不明";
  const energyText = profile.energy > 0.62 ? "高密度" : profile.energy < 0.34 ? "抑えめ" : "中密度";
  const instrumentText = instruments
    .slice(0, 3)
    .map((instrument) => instrument.label)
    .join("、");

  return `${bpmText} / ${keyText} / ${energyText}。主なサウンド候補: ${instrumentText}`;
}

function buildWarnings(duration: number, analyzedDuration: number, instruments: AudioAnalysisInstrument[]) {
  const warnings: string[] = [
    "楽器と構成はローカル音響特徴からの推定です。ミックス済み音源では誤差が出ます。"
  ];

  if (duration > analyzedDuration + 1) {
    warnings.push(`解析負荷を抑えるため先頭${Math.round(analyzedDuration)}秒を解析しました。`);
  }

  if (instruments.every((instrument) => instrument.confidence < 0.5)) {
    warnings.push("楽器推定の確信度が低めです。Style反映後に手動調整してください。");
  }

  if (instruments.some((instrument) => instrument.label.includes("和音レイヤー"))) {
    warnings.push("低確信度の鍵盤系は、具体楽器名ではなく和音レイヤーとして保守的に表示しています。");
  }

  return warnings;
}

function browserPianoLikelihood(profile: FeatureProfile) {
  const { bandProfile } = profile;
  const midScore = clamp01((bandProfile.midRatio - 0.4) / 0.22);
  const attackScore = Math.max(
    clamp01((profile.onsetRate - 0.36) / 0.7),
    clamp01((profile.dynamics - 0.36) / 0.4)
  );
  const brightnessScore = clamp01(1 - Math.abs(profile.brightness - 0.38) / 0.34);
  const highAirScore = clamp01((bandProfile.highRatio + bandProfile.airRatio - 0.06) / 0.26);
  const lowPenalty = clamp01((bandProfile.lowRatio + bandProfile.bassRatio - 0.44) / 0.3) * 0.14;
  let score = midScore * 0.36 + attackScore * 0.28 + brightnessScore * 0.22 + highAirScore * 0.14 - lowPenalty;

  if (bandProfile.midRatio < 0.4 || attackScore < 0.32 || profile.brightness > 0.64) {
    score *= 0.56;
  }

  return clamp01(score);
}

function browserChordLayerLikelihood(profile: FeatureProfile) {
  const { bandProfile } = profile;
  if (bandProfile.midRatio < 0.28 || profile.brightness > 0.7) return 0;

  const midScore = clamp01(bandProfile.midRatio * 1.55);
  const warmScore = clamp01((0.68 - profile.brightness) / 0.68);
  const sustainScore = clamp01(1 - profile.dynamics * 0.45);
  const balanceScore = clamp01((bandProfile.midRatio + bandProfile.highRatio * 0.35) * 1.35);
  return clamp01(midScore * 0.5 + warmScore * 0.18 + sustainScore * 0.12 + balanceScore * 0.2);
}

function rms(signal: Float32Array, offset: number, frameSize: number) {
  let sum = 0;

  for (let index = 0; index < frameSize; index += 1) {
    const value = signal[offset + index] ?? 0;
    sum += value * value;
  }

  return Math.sqrt(sum / frameSize);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], target: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = clamp(Math.round((sorted.length - 1) * target), 0, sorted.length - 1);
  return sorted[index];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}
