import { z } from "zod";

export const AudioAnalysisSectionSchema = z.object({
  label: z.string(),
  start: z.number(),
  end: z.number(),
  energy: z.number().min(0).max(1),
  brightness: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  description: z.string()
});

export const AudioAnalysisInstrumentSchema = z.object({
  label: z.string(),
  styleTag: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string()
});

export const AudioAnalysisResultSchema = z.object({
  engine: z.enum(["browser-basic", "python-librosa", "advanced-local"]),
  fileName: z.string(),
  duration: z.number().nonnegative(),
  analyzedDuration: z.number().nonnegative(),
  sampleRate: z.number().int().positive(),
  bpm: z.number().int().positive().nullable(),
  bpmConfidence: z.number().min(0).max(1),
  key: z.string().nullable(),
  mode: z.enum(["major", "minor"]).nullable(),
  keyConfidence: z.number().min(0).max(1),
  energy: z.number().min(0).max(1),
  brightness: z.number().min(0).max(1),
  dynamics: z.number().min(0).max(1),
  structure: z.array(AudioAnalysisSectionSchema),
  instruments: z.array(AudioAnalysisInstrumentSchema),
  sunoStyle: z.string(),
  summary: z.string(),
  warnings: z.array(z.string())
});

export type AudioAnalysisSection = z.infer<typeof AudioAnalysisSectionSchema>;
export type AudioAnalysisInstrument = z.infer<typeof AudioAnalysisInstrumentSchema>;
export type AudioAnalysisResult = z.infer<typeof AudioAnalysisResultSchema>;
