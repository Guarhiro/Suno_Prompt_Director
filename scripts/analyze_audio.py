#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import warnings
from pathlib import Path
from typing import Any

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")
warnings.filterwarnings("ignore", message="Could not find the number of physical cores.*")
warnings.filterwarnings("ignore", message="n_fft=.*too large for input signal.*")
warnings.filterwarnings("ignore", category=UserWarning, module=r"joblib\.externals\.loky\.backend\.context")

try:
    import librosa
    import numpy as np
except ModuleNotFoundError as exc:
    missing_name = exc.name or "audio analysis dependency"
    print(
        json.dumps(
            {
                "error": (
                    f"Missing Python dependency: {missing_name}. "
                    "Run `.venv/bin/python -m pip install -r requirements-audio.txt`."
                )
            },
            ensure_ascii=False,
        ),
        file=sys.stderr,
    )
    raise SystemExit(2)


MAX_ANALYSIS_SECONDS = 300
TARGET_SAMPLE_RATE = 22050
NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze a local audio file for Suno style reconstruction.")
    parser.add_argument("audio_path")
    parser.add_argument("--file-name", default="")
    parser.add_argument("--ffmpeg", default=os.environ.get("FFMPEG_PATH", ""))
    args = parser.parse_args()

    result = analyze_audio_path(Path(args.audio_path), args.file_name, args.ffmpeg)
    print(json.dumps(result, ensure_ascii=False))
    return 0


def analyze_audio_path(audio_path: Path, file_name: str = "", explicit_ffmpeg_path: str = "") -> dict[str, Any]:
    audio_path = Path(audio_path)
    if not audio_path.exists():
        raise AnalysisError(f"Audio file was not found: {audio_path}")

    analysis_warnings: list[str] = []
    ffmpeg_path = find_ffmpeg(explicit_ffmpeg_path)

    with tempfile.TemporaryDirectory(prefix="suno-audio-analysis-") as temp_dir:
        prepared_path = prepare_audio(audio_path, Path(temp_dir), ffmpeg_path, analysis_warnings)
        y, sr = load_audio(prepared_path)

    if y.size < sr:
        raise AnalysisError("Audio is too short to analyze.")

    analyzed_duration = float(y.size / sr)
    source_duration = probe_duration(audio_path, ffmpeg_path) or analyzed_duration
    if source_duration > analyzed_duration + 1:
        analysis_warnings.append(f"解析負荷を抑えるため先頭{round(analyzed_duration)}秒を解析しました。")

    y = normalize_audio(y)
    harmonic, percussive = librosa.effects.hpss(y)
    tempo = estimate_tempo(percussive, sr, analyzed_duration)
    tonal = estimate_key(harmonic, sr)
    profile = analyze_features(y, harmonic, percussive, sr, tempo["onsetRate"])
    structure = estimate_structure(y, harmonic, sr, tempo["bpm"], analyzed_duration)
    instruments = infer_instruments(profile, tempo)
    suno_style = build_suno_style(tempo, tonal, profile, structure, instruments)

    analysis_warnings.append("楽器と構成はlibrosa音響特徴からの推定です。ミックス済み音源では誤差が出ます。")
    if any("和音レイヤー" in item["label"] for item in instruments):
        analysis_warnings.append("低確信度の鍵盤系は、具体楽器名ではなく和音レイヤーとして保守的に表示しています。")

    return {
        "engine": "python-librosa",
        "fileName": file_name or audio_path.name,
        "duration": clean_float(source_duration),
        "analyzedDuration": clean_float(analyzed_duration),
        "sampleRate": int(sr),
        "bpm": tempo["bpm"],
        "bpmConfidence": clean_float(tempo["confidence"]),
        "key": tonal["key"],
        "mode": tonal["mode"],
        "keyConfidence": clean_float(tonal["confidence"]),
        "energy": clean_float(profile["energy"]),
        "brightness": clean_float(profile["brightness"]),
        "dynamics": clean_float(profile["dynamics"]),
        "structure": structure,
        "instruments": instruments,
        "sunoStyle": suno_style,
        "summary": build_summary(tempo, tonal, profile, instruments),
        "warnings": analysis_warnings,
    }


class AnalysisError(Exception):
    pass


def find_ffmpeg(explicit_path: str) -> str | None:
    candidates = [
        explicit_path,
        shutil.which("ffmpeg") or "",
        str(
            Path.home()
            / "Documents"
            / "Codex"
            / "creative-file-studio-push"
            / "vendor"
            / "backgroundremover-venv"
            / "bin"
            / "ffmpeg"
        ),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/opt/homebrew/opt/ffmpeg/bin/ffmpeg",
        "/usr/local/opt/ffmpeg/bin/ffmpeg",
    ]

    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate

    return None


def prepare_audio(audio_path: Path, temp_dir: Path, ffmpeg_path: str | None, warnings: list[str]) -> Path:
    if not ffmpeg_path:
        warnings.append("ffmpegが見つからないため、Pythonローダーで直接読み込みます。mp3/m4aでは失敗する場合があります。")
        return audio_path

    output_path = temp_dir / "analysis.wav"
    command = [
        ffmpeg_path,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(audio_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(TARGET_SAMPLE_RATE),
        "-t",
        str(MAX_ANALYSIS_SECONDS),
        str(output_path),
    ]

    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        raise AnalysisError(f"ffmpeg conversion failed. {detail}") from exc

    return output_path


def load_audio(audio_path: Path) -> tuple[np.ndarray, int]:
    try:
        y, sr = librosa.load(str(audio_path), sr=TARGET_SAMPLE_RATE, mono=True, duration=MAX_ANALYSIS_SECONDS)
    except Exception as exc:  # noqa: BLE001 - report decoder/library detail to the API layer.
        raise AnalysisError(f"Audio decode failed. Install ffmpeg or use WAV/FLAC. Detail: {exc}") from exc

    if not np.isfinite(y).all():
        y = np.nan_to_num(y)

    return y.astype(np.float32), int(sr)


def probe_duration(audio_path: Path, ffmpeg_path: str | None) -> float | None:
    ffprobe = find_ffprobe(ffmpeg_path)
    if ffprobe:
        command = [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(audio_path),
        ]
        try:
            completed = subprocess.run(command, check=True, capture_output=True, text=True)
            return float(completed.stdout.strip())
        except Exception:
            pass

    try:
        return float(librosa.get_duration(path=str(audio_path)))
    except Exception:
        return None


def find_ffprobe(ffmpeg_path: str | None) -> str | None:
    candidates = [shutil.which("ffprobe") or ""]
    if ffmpeg_path:
        candidates.append(str(Path(ffmpeg_path).with_name("ffprobe")))

    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate

    return None


def normalize_audio(y: np.ndarray) -> np.ndarray:
    peak = float(np.max(np.abs(y)))
    if peak <= 0:
        return y
    return y / peak


def estimate_tempo(y: np.ndarray, sr: int, duration: float) -> dict[str, Any]:
    hop_length = 512
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length, aggregate=np.median)

    if onset_env.size < 8 or float(np.max(onset_env)) <= 0:
        return {"bpm": None, "confidence": 0.0, "onsetRate": 0.0, "beatTimes": []}

    tempo_raw, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop_length,
        trim=False,
    )
    bpm = float(np.asarray(tempo_raw).reshape(-1)[0])
    bpm = correct_tempo_octave(bpm)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)

    onset_threshold = float(np.percentile(onset_env, 72))
    onset_rate = float(np.sum(onset_env > onset_threshold) / max(duration, 1))
    expected_beats = max(duration / max(60 / bpm, 0.01), 1) if bpm > 0 else 1
    beat_density_score = min(float(len(beat_times)) / expected_beats, 1.0)
    onset_contrast = float(np.std(onset_env) / (np.mean(onset_env) + 1e-8))
    confidence = clamp01(beat_density_score * 0.62 + min(onset_contrast / 3.0, 1.0) * 0.38)

    return {
        "bpm": int(round(bpm)) if bpm > 0 else None,
        "confidence": confidence,
        "onsetRate": onset_rate,
        "beatTimes": [clean_float(value) for value in beat_times.tolist()],
    }


def correct_tempo_octave(bpm: float) -> float:
    if bpm <= 0:
        return bpm
    while bpm < 72:
        bpm *= 2
    while bpm > 188:
        bpm /= 2
    return bpm


def estimate_key(y_harmonic: np.ndarray, sr: int) -> dict[str, Any]:
    try:
        chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr, bins_per_octave=36)
    except Exception:
        chroma = librosa.feature.chroma_stft(y=y_harmonic, sr=sr)

    chroma_mean = np.mean(chroma, axis=1)
    if float(np.sum(chroma_mean)) <= 0:
        return {"key": None, "mode": None, "confidence": 0.0, "chroma": [0.0] * 12}

    chroma_norm = chroma_mean / (np.linalg.norm(chroma_mean) + 1e-8)
    scores: list[tuple[int, str, float]] = []
    for root in range(12):
        scores.append((root, "major", profile_correlation(chroma_norm, np.roll(MAJOR_PROFILE, root))))
        scores.append((root, "minor", profile_correlation(chroma_norm, np.roll(MINOR_PROFILE, root))))

    scores.sort(key=lambda item: item[2], reverse=True)
    best = scores[0]
    second = scores[1]
    confidence = clamp01((best[2] - second[2]) * 1.85)

    return {
        "key": NOTE_NAMES[best[0]],
        "mode": best[1],
        "confidence": confidence,
        "chroma": [clean_float(value) for value in chroma_norm.tolist()],
    }


def profile_correlation(chroma: np.ndarray, profile: np.ndarray) -> float:
    profile_norm = profile / (np.linalg.norm(profile) + 1e-8)
    return float(np.dot(chroma, profile_norm))


def analyze_features(y: np.ndarray, y_harmonic: np.ndarray, y_percussive: np.ndarray, sr: int, onset_rate: float) -> dict[str, Any]:
    hop_length = 512
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=hop_length)[0]
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=hop_length)[0]
    flatness = librosa.feature.spectral_flatness(y=y, hop_length=hop_length)[0]
    band_profile = estimate_band_profile(y, sr)

    energy = clamp01(float(np.mean(rms)) / 0.18)
    dynamics = clamp01(float(np.percentile(rms, 90) - np.percentile(rms, 10)) / 0.26)
    brightness = clamp01(float(np.mean(centroid) / (sr / 2)))
    harmonic_ratio = clamp01(float(np.mean(np.abs(y_harmonic)) / (np.mean(np.abs(y)) + 1e-8)))
    percussive_ratio = clamp01(float(np.mean(np.abs(y_percussive)) / (np.mean(np.abs(y)) + 1e-8)))

    return {
        "energy": energy,
        "brightness": brightness,
        "dynamics": dynamics,
        "onsetRate": float(onset_rate),
        "spectralBandwidth": clamp01(float(np.mean(bandwidth) / (sr / 2))),
        "zeroCrossing": clamp01(float(np.mean(zcr) * 12)),
        "flatness": clamp01(float(np.mean(flatness) * 8)),
        "harmonicRatio": harmonic_ratio,
        "percussiveRatio": percussive_ratio,
        "bandProfile": band_profile,
    }


def estimate_band_profile(y: np.ndarray, sr: int) -> dict[str, float]:
    spectrum = np.abs(librosa.stft(y, n_fft=2048, hop_length=1024))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    power = np.square(spectrum)
    total = float(np.sum(power)) + 1e-8

    def band(low: float, high: float) -> float:
        mask = (freqs >= low) & (freqs < high)
        return float(np.sum(power[mask])) / total

    return {
        "lowRatio": band(20, 120),
        "bassRatio": band(120, 350),
        "midRatio": band(350, 2200),
        "highRatio": band(2200, 6200),
        "airRatio": band(6200, sr / 2),
    }


def estimate_structure(y: np.ndarray, y_harmonic: np.ndarray, sr: int, bpm: int | None, duration: float) -> list[dict[str, Any]]:
    hop_length = 1024
    beat_seconds = 60 / bpm if bpm else None
    phrase_seconds = clamp((beat_seconds or 0.55) * 32, 12, 30) if beat_seconds else 18
    desired_count = int(clamp(round(duration / phrase_seconds), 3, 8))

    structure_context = build_structure_context(y, y_harmonic, sr, hop_length)
    boundaries = segment_boundaries(
        structure_context["features"],
        sr,
        hop_length,
        desired_count,
        duration,
        beat_seconds,
    )
    sections = []
    for index, (start, end) in enumerate(zip(boundaries, boundaries[1:])):
        if end - start < 1.5:
            continue
        features = section_features(y, y_harmonic, sr, start, end, structure_context)
        sections.append({"index": index, "start": start, "end": end, **features})

    if len(sections) < 2:
        sections = even_sections(y, y_harmonic, sr, desired_count, duration, structure_context)

    energies = np.array([section["energy"] for section in sections])
    repeat_scores = np.array([section["repeatScore"] for section in sections])
    boundary_scores = np.array([section["boundaryStrength"] for section in sections])
    high_energy = float(np.percentile(energies, 72)) if energies.size else 0.0
    low_energy = float(np.percentile(energies, 28)) if energies.size else 0.0
    high_repeat = float(np.percentile(repeat_scores, 72)) if repeat_scores.size else 0.0
    high_boundary = float(np.percentile(boundary_scores, 65)) if boundary_scores.size else 0.0
    first_chorus = next(
        (
            section["index"]
            for section in sections
            if section["index"] > 0 and (section["energy"] >= high_energy or section["repeatScore"] >= high_repeat)
        ),
        -1,
    )

    output = []
    for section in sections:
        label, label_confidence, reason = infer_section_label(
            section["index"],
            len(sections),
            section["energy"],
            section["brightness"],
            section["repeatScore"],
            section["boundaryStrength"],
            low_energy,
            high_energy,
            high_repeat,
            high_boundary,
            first_chorus,
        )
        confidence = section_confidence(section, label_confidence)
        output.append(
            {
                "label": label,
                "start": clean_float(section["start"]),
                "end": clean_float(section["end"]),
                "energy": clean_float(section["energy"]),
                "brightness": clean_float(section["brightness"]),
                "confidence": clean_float(confidence),
                "reason": reason,
                "description": section_description(
                    label,
                    section["energy"],
                    section["brightness"],
                    section["repeatScore"],
                    section["boundaryStrength"],
                ),
            }
        )

    return output


def build_structure_context(y: np.ndarray, y_harmonic: np.ndarray, sr: int, hop_length: int) -> dict[str, Any]:
    try:
        chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr, hop_length=hop_length, bins_per_octave=36)
    except Exception:
        chroma = librosa.feature.chroma_stft(y=y_harmonic, sr=sr, hop_length=hop_length)

    mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop_length, n_mfcc=8)
    rms = librosa.feature.rms(y=y, hop_length=hop_length)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)
    features = np.vstack(
        [
            librosa.util.normalize(chroma),
            librosa.util.normalize(mfcc),
            librosa.util.normalize(rms),
            librosa.util.normalize(centroid),
        ]
    )
    recurrence = librosa.segment.recurrence_matrix(features, mode="affinity", sym=True)

    return {
        "features": features,
        "rms": rms[0],
        "centroid": centroid[0],
        "recurrence": recurrence,
        "frame_count": features.shape[1],
    }


def segment_boundaries(
    features: np.ndarray,
    sr: int,
    hop_length: int,
    desired_count: int,
    duration: float,
    beat_seconds: float | None,
) -> list[float]:
    boundary_frames = librosa.segment.agglomerative(features, desired_count)
    boundary_times = sorted(float(value) for value in librosa.frames_to_time(boundary_frames, sr=sr, hop_length=hop_length))
    snapped_times = [snap_to_phrase_grid(value, beat_seconds, duration) for value in boundary_times if 2.0 < value < duration - 2.0]
    times = [0.0, *snapped_times, duration]
    min_gap = clamp((beat_seconds or 0.5) * 16, 6.0, 14.0)
    return merge_close_boundaries(times, min_gap=min_gap, duration=duration)


def snap_to_phrase_grid(value: float, beat_seconds: float | None, duration: float) -> float:
    if not beat_seconds:
        return value

    phrase_grid = beat_seconds * 8
    if phrase_grid <= 0:
        return value

    snapped = round(value / phrase_grid) * phrase_grid
    return clamp(snapped, 0.0, duration)


def merge_close_boundaries(boundaries: list[float], min_gap: float, duration: float) -> list[float]:
    merged = [0.0]
    for boundary in boundaries[1:-1]:
        if boundary - merged[-1] >= min_gap:
            merged.append(boundary)
    if duration - merged[-1] < min_gap and len(merged) > 1:
        merged.pop()
    merged.append(duration)
    return merged


def even_sections(
    y: np.ndarray,
    y_harmonic: np.ndarray,
    sr: int,
    count: int,
    duration: float,
    structure_context: dict[str, Any],
) -> list[dict[str, Any]]:
    section_seconds = duration / count
    sections = []
    for index in range(count):
        start = index * section_seconds
        end = duration if index == count - 1 else (index + 1) * section_seconds
        sections.append(
            {
                "index": index,
                "start": start,
                "end": end,
                **section_features(y, y_harmonic, sr, start, end, structure_context),
            }
        )
    return sections


def section_features(
    y: np.ndarray,
    y_harmonic: np.ndarray,
    sr: int,
    start: float,
    end: float,
    structure_context: dict[str, Any],
) -> dict[str, float]:
    start_sample = max(0, int(start * sr))
    end_sample = min(y.size, int(end * sr))
    segment = y[start_sample:end_sample]
    if segment.size < sr:
        segment = y[start_sample : min(y.size, start_sample + sr)]
    if segment.size == 0:
        return {"energy": 0.0, "brightness": 0.0, "repeatScore": 0.0, "boundaryStrength": 0.0, "harmonicChange": 0.0}

    rms = librosa.feature.rms(y=segment)[0]
    centroid = librosa.feature.spectral_centroid(y=segment, sr=sr)[0]
    start_frame = max(0, int(start * sr / 1024))
    end_frame = min(structure_context["frame_count"], max(start_frame + 1, int(end * sr / 1024)))
    repeat_score = section_repeat_score(structure_context["recurrence"], start_frame, end_frame)
    boundary_strength = boundary_strength_score(structure_context["features"], start_frame, end_frame)
    harmonic_change = harmonic_change_score(y_harmonic, sr, start, end)

    return {
        "energy": clamp01(float(np.mean(rms)) / 0.18),
        "brightness": clamp01(float(np.mean(centroid) / (sr / 2))),
        "repeatScore": repeat_score,
        "boundaryStrength": boundary_strength,
        "harmonicChange": harmonic_change,
    }


def section_repeat_score(recurrence: np.ndarray, start_frame: int, end_frame: int) -> float:
    if recurrence.size == 0 or end_frame <= start_frame:
        return 0.0

    section = recurrence[start_frame:end_frame, :]
    if section.size == 0:
        return 0.0

    local_start = max(0, start_frame - (end_frame - start_frame))
    local_end = min(recurrence.shape[1], end_frame + (end_frame - start_frame))
    mask = np.ones(section.shape[1], dtype=bool)
    mask[local_start:local_end] = False
    if not np.any(mask):
        return 0.0

    return clamp01(float(np.mean(section[:, mask])))


def boundary_strength_score(features: np.ndarray, start_frame: int, end_frame: int) -> float:
    frame_count = features.shape[1]
    if frame_count < 3:
        return 0.0

    scores = []
    for frame in [start_frame, end_frame]:
        if frame <= 1 or frame >= frame_count - 2:
            continue
        before = np.mean(features[:, max(0, frame - 4) : frame], axis=1)
        after = np.mean(features[:, frame : min(frame_count, frame + 4)], axis=1)
        scores.append(float(np.linalg.norm(after - before)))

    if not scores:
        return 0.0

    return clamp01(float(np.mean(scores)) / 4.0)


def harmonic_change_score(y_harmonic: np.ndarray, sr: int, start: float, end: float) -> float:
    start_sample = max(0, int(start * sr))
    end_sample = min(y_harmonic.size, int(end * sr))
    segment = y_harmonic[start_sample:end_sample]
    if segment.size < sr * 2:
        return 0.0

    try:
        chroma = librosa.feature.chroma_cqt(y=segment, sr=sr, bins_per_octave=36)
    except Exception:
        chroma = librosa.feature.chroma_stft(y=segment, sr=sr)

    if chroma.shape[1] < 4:
        return 0.0

    first = np.mean(chroma[:, : max(1, chroma.shape[1] // 3)], axis=1)
    last = np.mean(chroma[:, -max(1, chroma.shape[1] // 3) :], axis=1)
    return clamp01(float(np.linalg.norm(last - first)) / 2.0)


def infer_section_label(
    index: int,
    count: int,
    energy: float,
    brightness: float,
    repeat_score: float,
    boundary_strength: float,
    low_energy: float,
    high_energy: float,
    high_repeat: float,
    high_boundary: float,
    first_chorus: int,
) -> tuple[str, float, str]:
    energy_note = "高密度" if energy >= high_energy else "低密度" if energy <= low_energy else "中密度"
    repeat_note = "繰り返し類似が高い" if repeat_score >= high_repeat and repeat_score > 0.08 else "繰り返しは控えめ"
    boundary_note = "境界変化が強い" if boundary_strength >= high_boundary and boundary_strength > 0.08 else "境界変化は弱め"

    if index == 0:
        if energy <= low_energy * 1.12:
            return "Intro", 0.82, f"冒頭区間で{energy_note}、導入として自然。"
        return "Verse", 0.66, f"冒頭だが密度があり、歌/主題に入っている可能性が高い。"
    if index == count - 1:
        if energy <= high_energy * 0.92:
            return "Outro", 0.74, f"終端区間で{energy_note}、収束部として判定。"
        return "Final Chorus", 0.78, f"終端で{energy_note}かつ{repeat_note}なため、最後のサビ寄り。"
    if first_chorus > 1 and index == first_chorus - 1:
        return "Pre-Chorus", 0.7, f"高密度区間の直前で{boundary_note}ため、サビ前として判定。"
    if energy >= high_energy and repeat_score >= high_repeat:
        return "Chorus", 0.86, f"{energy_note}で{repeat_note}ため、反復される中心部として判定。"
    if energy >= high_energy:
        return "Chorus", 0.74, f"{energy_note}のため、盛り上がり区間として判定。"
    if index > math.floor(count * 0.55) and brightness < 0.42 and energy <= low_energy * 1.18:
        return "Bridge", 0.68, f"後半で{energy_note}、音像も丸く、展開変化部として判定。"
    if boundary_strength >= high_boundary and index > 0:
        return "Verse", 0.62, f"{boundary_note}だが密度は控えめで、主部の別区間として判定。"
    return "Verse", 0.58, f"{energy_note}で{repeat_note}ため、Verse寄りに保守判定。"


def section_confidence(section: dict[str, float], label_confidence: float) -> float:
    evidence = (
        label_confidence * 0.58
        + clamp01(section["boundaryStrength"] * 1.4) * 0.18
        + clamp01(section["repeatScore"] * 2.0) * 0.14
        + clamp01(section["harmonicChange"] * 1.5) * 0.1
    )
    return clamp01(evidence)


def section_description(label: str, energy: float, brightness: float, repeat_score: float, boundary_strength: float) -> str:
    energy_text = "高めの密度" if energy > 0.68 else "抑えめの密度" if energy < 0.36 else "中程度の密度"
    brightness_text = "明るい音像" if brightness > 0.60 else "丸い音像" if brightness < 0.35 else "自然な明るさ"
    repeat_text = "反復感あり" if repeat_score > 0.12 else "反復感控えめ"
    boundary_text = "変化点強め" if boundary_strength > 0.12 else "変化点控えめ"
    return f"{label}: {energy_text} / {brightness_text} / {repeat_text} / {boundary_text}"


def infer_instruments(profile: dict[str, Any], tempo: dict[str, Any]) -> list[dict[str, Any]]:
    instruments: list[dict[str, Any]] = []
    bands = profile["bandProfile"]
    bpm = tempo["bpm"] or 100

    if bands["lowRatio"] + bands["bassRatio"] > 0.18:
        instruments.append(
            instrument(
                "シンセベース / エレクトリックベース" if bands["lowRatio"] > 0.07 else "エレクトリックベース",
                "deep synth bass" if bands["lowRatio"] > 0.07 else "warm electric bass",
                (bands["lowRatio"] + bands["bassRatio"]) * 2.5,
                "低域のエネルギーが安定して強い",
            )
        )

    if profile["percussiveRatio"] > 0.32 or profile["onsetRate"] > 0.7:
        instruments.append(
            instrument(
                "電子ドラム / ドラムセット" if profile["brightness"] > 0.48 else "ドラムセット",
                "crisp electronic drums" if profile["brightness"] > 0.48 else "steady drum kit",
                profile["percussiveRatio"] * 0.8 + min(profile["onsetRate"] / 2.2, 0.4),
                "打点とパーカッシブ成分が多い",
            )
        )

    piano_score = piano_likelihood(profile, bands)
    chord_layer_score = chord_layer_likelihood(profile, bands)
    if piano_score >= 0.72:
        instruments.append(
            instrument(
                "ピアノ / エレクトリックピアノ",
                "warm piano and electric piano",
                piano_score,
                "中域の和音成分に加え、打鍵に近いアタックと自然な倍音バランスがある",
            )
        )
    elif chord_layer_score >= 0.48:
        instruments.append(
            instrument(
                "和音レイヤー / 鍵盤系パッド",
                "warm harmonic chord layer",
                min(chord_layer_score, 0.68),
                "中域の和音感はあるが、ピアノ特有の打鍵条件が弱いため保守的に推定",
            )
        )

    if profile["brightness"] > 0.42 and profile["zeroCrossing"] > 0.25 and profile["onsetRate"] > 0.28:
        instruments.append(
            instrument(
                "クリーンギター / プラック",
                "clean guitar plucks",
                profile["brightness"] * 0.55 + profile["zeroCrossing"] * 0.28,
                "高域寄りのアタックと細かな倍音が目立つ",
            )
        )

    if profile["harmonicRatio"] > 0.48 and profile["percussiveRatio"] < 0.58:
        instruments.append(
            instrument(
                "シンセパッド / ストリングス",
                "shimmering synth pads" if profile["brightness"] > 0.45 else "soft strings and pads",
                profile["harmonicRatio"] * 0.66 + (1 - profile["percussiveRatio"]) * 0.18,
                "持続音とハーモニック成分が多い",
            )
        )

    if bands["airRatio"] > 0.08 or (profile["brightness"] > 0.62 and bpm >= 105):
        instruments.append(
            instrument(
                "シンセリード / ベル",
                "bright synth lead accents",
                bands["airRatio"] * 2.1 + profile["brightness"] * 0.28,
                "上モノの明るい倍音が多い",
            )
        )

    if not instruments:
        instruments.append(instrument("ミニマルな伴奏", "minimal atmospheric accompaniment", 0.42, "明確な楽器特徴が少ない"))

    return sorted(instruments, key=lambda item: item["confidence"], reverse=True)[:5]


def piano_likelihood(profile: dict[str, Any], bands: dict[str, float]) -> float:
    mid_score = clamp01((bands["midRatio"] - 0.34) / 0.22)
    harmonic_score = clamp01((profile["harmonicRatio"] - 0.52) / 0.26)
    attack_score = max(
        clamp01((profile["onsetRate"] - 0.38) / 0.75),
        clamp01((profile["percussiveRatio"] - 0.24) / 0.36),
        clamp01((profile["dynamics"] - 0.38) / 0.34),
    )
    clean_score = clamp01((0.42 - profile["flatness"]) / 0.32)
    brightness_score = clamp01(1 - abs(profile["brightness"] - 0.38) / 0.34)
    high_air_score = clamp01((bands["highRatio"] + bands["airRatio"] - 0.06) / 0.26)
    low_penalty = clamp01((bands["lowRatio"] + bands["bassRatio"] - 0.46) / 0.28) * 0.12
    score = (
        mid_score * 0.24
        + harmonic_score * 0.24
        + attack_score * 0.22
        + clean_score * 0.14
        + brightness_score * 0.10
        + high_air_score * 0.06
        - low_penalty
    )

    if bands["midRatio"] < 0.34 or profile["harmonicRatio"] < 0.50 or attack_score < 0.28:
        score *= 0.62
    if profile["flatness"] > 0.50 or profile["brightness"] > 0.68:
        score *= 0.75

    return clamp01(score)


def chord_layer_likelihood(profile: dict[str, Any], bands: dict[str, float]) -> float:
    if bands["midRatio"] < 0.25 or profile["harmonicRatio"] < 0.38:
        return 0.0

    mid_score = clamp01(bands["midRatio"] * 1.35)
    harmonic_score = clamp01(profile["harmonicRatio"])
    sustain_score = clamp01(1 - profile["percussiveRatio"] * 0.6)
    clean_score = clamp01((0.75 - profile["flatness"]) / 0.55)
    return clamp01(mid_score * 0.46 + harmonic_score * 0.30 + sustain_score * 0.14 + clean_score * 0.10)


def instrument(label: str, style_tag: str, confidence: float, reason: str) -> dict[str, Any]:
    return {
        "label": label,
        "styleTag": style_tag,
        "confidence": clean_float(clamp01(confidence)),
        "reason": reason,
    }


def build_suno_style(
    tempo: dict[str, Any],
    tonal: dict[str, Any],
    profile: dict[str, Any],
    structure: list[dict[str, Any]],
    instruments: list[dict[str, Any]],
) -> str:
    tempo_tag = f"{tempo['bpm']} BPM" if tempo["bpm"] else "moderate tempo"
    key_tag = f"{tonal['key']} {tonal['mode']}" if tonal["key"] and tonal["mode"] else "tonal pop harmony"
    genre_tags = infer_genre_tags(tempo, profile, instruments)
    mood_tags = infer_mood_tags(tonal, profile)
    instrument_tags = [item["styleTag"] for item in instruments[:4]]
    structure_tag = compact_structure(structure)
    production_tag = "bright polished mix" if profile["brightness"] > 0.58 else "warm polished mix"
    dynamics_tag = "high-energy layered arrangement" if profile["energy"] > 0.62 else "restrained detailed arrangement"
    return ", ".join(
        [
            tempo_tag,
            key_tag,
            *genre_tags,
            *mood_tags,
            *instrument_tags,
            f"{structure_tag} arrangement",
            "clear section contrast",
            dynamics_tag,
            production_tag,
        ]
    )


def infer_genre_tags(tempo: dict[str, Any], profile: dict[str, Any], instruments: list[dict[str, Any]]) -> list[str]:
    tags: list[str] = []
    bpm = tempo["bpm"] or 100
    instrument_text = " ".join(item["styleTag"] for item in instruments)

    if "synth" in instrument_text and profile["brightness"] > 0.45:
        tags.append("modern synth pop")
    if "electronic drums" in instrument_text and bpm >= 110:
        tags.append("electropop")
    if "guitar" in instrument_text and bpm < 132:
        tags.append("indie pop")
    if "piano" in instrument_text and bpm < 110:
        tags.append("cinematic piano pop")
    if bpm < 86:
        tags.append("downtempo")
    if bpm >= 128 and len(tags) < 2:
        tags.append("dance pop")
    if not tags:
        tags.append("melodic pop")

    return tags[:3]


def infer_mood_tags(tonal: dict[str, Any], profile: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    if tonal["mode"] == "minor":
        tags.append("emotional")
    if tonal["mode"] == "major" and profile["brightness"] > 0.45:
        tags.append("uplifting")
    if profile["energy"] > 0.62:
        tags.append("driving")
    if profile["energy"] < 0.34:
        tags.append("intimate")
    if profile["brightness"] > 0.60:
        tags.append("shimmering")
    if profile["brightness"] < 0.34:
        tags.append("warm")
    return tags[:3] if tags else ["balanced mood"]


def compact_structure(structure: list[dict[str, Any]]) -> str:
    labels = [section["label"].replace("Final Chorus", "Chorus") for section in structure]
    compact = [label for index, label in enumerate(labels) if index == 0 or label != labels[index - 1]]
    return "-".join(compact).lower()


def build_summary(tempo: dict[str, Any], tonal: dict[str, Any], profile: dict[str, Any], instruments: list[dict[str, Any]]) -> str:
    bpm_text = f"{tempo['bpm']} BPM" if tempo["bpm"] else "BPM不明"
    key_text = f"{tonal['key']} {tonal['mode']}" if tonal["key"] and tonal["mode"] else "キー不明"
    energy_text = "高密度" if profile["energy"] > 0.62 else "抑えめ" if profile["energy"] < 0.34 else "中密度"
    instrument_text = "、".join(item["label"] for item in instruments[:3])
    return f"{bpm_text} / {key_text} / {energy_text}。主なサウンド候補: {instrument_text}"


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def clamp01(value: float) -> float:
    return clamp(float(value), 0.0, 1.0)


def clean_float(value: Any) -> float:
    next_value = float(value)
    if not math.isfinite(next_value):
        return 0.0
    return round(next_value, 4)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AnalysisError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
