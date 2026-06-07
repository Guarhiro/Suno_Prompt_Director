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
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf

from analyze_audio import AnalysisError, analyze_audio_path, clean_float, find_ffmpeg


DEFAULT_ALLIN1_MODEL = "harmonix-fold0"
DEFAULT_DEMUCS_MODEL = "htdemucs"
STEM_LABELS = {
    "drums": ("ドラム / パーカッション", "defined drum stem", "Demucsでドラムstemの比率が高い"),
    "bass": ("ベース", "defined bass stem", "Demucsでベースstemの比率が高い"),
    "vocals": ("ボーカル", "lead vocal presence", "Demucsでボーカルstemを検出"),
    "guitar": ("ギター", "separated guitar stem", "Demucs 6-stemでギターstemを検出"),
    "piano": ("ピアノ / エレクトリックピアノ", "separated piano stem", "Demucs 6-stemでピアノstemを検出"),
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Run high precision local audio analysis for Suno style reconstruction.")
    parser.add_argument("audio_path")
    parser.add_argument("--file-name", default="")
    parser.add_argument("--ffmpeg", default=os.environ.get("FFMPEG_PATH", ""))
    parser.add_argument("--allin1-python", action="append", default=[])
    parser.add_argument("--demucs-python", action="append", default=[])
    parser.add_argument("--allin1-model", default=os.environ.get("AUDIO_ADVANCED_ALLIN1_MODEL", DEFAULT_ALLIN1_MODEL))
    parser.add_argument("--demucs-model", default=os.environ.get("AUDIO_ADVANCED_DEMUCS_MODEL", DEFAULT_DEMUCS_MODEL))
    args = parser.parse_args()

    audio_path = Path(args.audio_path)
    if not audio_path.exists():
        raise AnalysisError(f"Audio file was not found: {audio_path}")

    ffmpeg_path = find_ffmpeg(args.ffmpeg)
    result = analyze_audio_path(audio_path, args.file_name, ffmpeg_path or "")
    result["engine"] = "advanced-local"
    result["warnings"] = [
        warning
        for warning in result.get("warnings", [])
        if "楽器と構成はlibrosa音響特徴からの推定" not in warning
    ]
    result["warnings"].append("高精度解析: all-in-one / Demucsを利用できる場合は構成とstem比率を優先します。")

    with tempfile.TemporaryDirectory(prefix="suno-advanced-analysis-") as temp_root:
        temp_path = Path(temp_root)
        allin1_update = run_allin1(
            audio_path=audio_path,
            model=args.allin1_model,
            python_candidates=args.allin1_python,
            temp_root=temp_path / "allin1",
            ffmpeg_path=ffmpeg_path,
        )
        apply_allin1_update(result, allin1_update, args.allin1_model)

        demucs_update = run_demucs(
            audio_path=audio_path,
            model=args.demucs_model,
            python_candidates=args.demucs_python,
            temp_root=temp_path / "demucs",
            ffmpeg_path=ffmpeg_path,
        )
        apply_demucs_update(result, demucs_update, args.demucs_model)

    result["instruments"] = sorted(result["instruments"], key=lambda item: item["confidence"], reverse=True)[:5]
    result["sunoStyle"] = build_suno_style_from_result(result)
    result["summary"] = build_summary_from_result(result)
    result["warnings"].append("高精度解析のstem/スペクトログラム等の中間ファイルは解析後に削除しました。")
    print(json.dumps(result, ensure_ascii=False))
    return 0


def run_allin1(
    audio_path: Path,
    model: str,
    python_candidates: list[str],
    temp_root: Path,
    ffmpeg_path: str | None,
) -> dict[str, Any]:
    helper = r"""
import json
import os
import sys
from pathlib import Path

try:
    import allin1
except ModuleNotFoundError as exc:
    print(json.dumps({"ok": False, "missing": exc.name or "allin1"}, ensure_ascii=False))
    raise SystemExit(0)

audio_path = sys.argv[1]
model = sys.argv[2]
temp_root = Path(sys.argv[3])
demix_dir = temp_root / "demix"
spec_dir = temp_root / "spec"
kwargs = {
    "model": model,
    "keep_byproducts": False,
    "demix_dir": demix_dir,
    "spec_dir": spec_dir,
}

try:
    result = allin1.analyze(audio_path, **kwargs)
except TypeError:
    result = allin1.analyze(audio_path, model=model)

if isinstance(result, list):
    result = result[0]

def read_value(obj, key, fallback=None):
    if isinstance(obj, dict):
        return obj.get(key, fallback)
    return getattr(obj, key, fallback)

segments = []
for segment in read_value(result, "segments", []) or []:
    segments.append({
        "start": float(read_value(segment, "start", 0.0)),
        "end": float(read_value(segment, "end", 0.0)),
        "label": str(read_value(segment, "label", "section")),
    })

payload = {
    "ok": True,
    "python": sys.executable,
    "bpm": read_value(result, "bpm"),
    "segments": segments,
}
print(json.dumps(payload, ensure_ascii=False))
"""
    temp_root.mkdir(parents=True, exist_ok=True)
    env = build_subprocess_env(ffmpeg_path)
    mpl_config_dir = temp_root / "matplotlib"
    mpl_config_dir.mkdir(parents=True, exist_ok=True)
    env["MPLCONFIGDIR"] = str(mpl_config_dir)
    last_error = ""

    for python_path in python_path_candidates(python_candidates, include_current=True):
        try:
            completed = subprocess.run(
                [python_path, "-c", helper, str(audio_path), model, str(temp_root)],
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=480,
                cwd=str(temp_root),
                env=env,
            )
        except Exception as exc:  # noqa: BLE001 - try the next candidate and report the final detail.
            last_error = str(exc)
            continue

        stdout = completed.stdout.strip()
        stderr = completed.stderr.strip()
        if completed.returncode != 0:
            last_error = stderr or stdout or f"exit code {completed.returncode}"
            continue

        try:
            payload = json.loads(last_json_line(stdout))
        except json.JSONDecodeError:
            last_error = stderr or stdout or "invalid JSON"
            continue

        if payload.get("ok"):
            return payload

        missing = payload.get("missing") or "allin1"
        last_error = f"{missing} is not installed in {python_path}"

    return {"ok": False, "error": last_error or "all-in-one is not available"}


def run_demucs(
    audio_path: Path,
    model: str,
    python_candidates: list[str],
    temp_root: Path,
    ffmpeg_path: str | None,
) -> dict[str, Any]:
    temp_root.mkdir(parents=True, exist_ok=True)
    env = build_subprocess_env(ffmpeg_path)
    last_error = ""

    for python_path in python_path_candidates(python_candidates, include_current=False):
        command = [
            python_path,
            "-m",
            "demucs",
            "-n",
            model,
            "-o",
            str(temp_root),
            "--shifts",
            "1",
            "--overlap",
            "0.25",
            "--clip-mode",
            "rescale",
            "--filename",
            "{stem}.{ext}",
            str(audio_path),
        ]
        try:
            completed = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=720,
                cwd=str(temp_root),
                env=env,
            )
        except Exception as exc:  # noqa: BLE001 - try the next candidate and report the final detail.
            last_error = str(exc)
            continue

        if completed.returncode != 0:
            last_error = (completed.stderr or completed.stdout or "").strip() or f"exit code {completed.returncode}"
            continue

        stem_paths = discover_stems(temp_root)
        if not stem_paths:
            last_error = "Demucs finished but no stem files were found"
            continue

        return {
            "ok": True,
            "python": python_path,
            "model": model,
            "ratios": stem_energy_ratios(stem_paths),
            "stems": sorted(stem_paths),
        }

    return {"ok": False, "error": last_error or "Demucs is not available"}


def apply_allin1_update(result: dict[str, Any], update: dict[str, Any], model: str) -> None:
    if not update.get("ok"):
        result["warnings"].append(f"all-in-one構成解析は未使用です: {update.get('error', '利用できません')}")
        return

    segments = normalize_allin1_segments(update.get("segments") or [], result)
    if segments:
        result["structure"] = segments
        result["warnings"].append(f"all-in-one構成解析を適用しました: {model}")

    bpm = update.get("bpm")
    if isinstance(bpm, (int, float)) and math.isfinite(float(bpm)) and bpm > 0:
        result["bpm"] = int(round(float(bpm)))
        result["bpmConfidence"] = max(float(result.get("bpmConfidence") or 0), 0.9)


def apply_demucs_update(result: dict[str, Any], update: dict[str, Any], model: str) -> None:
    if not update.get("ok"):
        result["warnings"].append(f"Demucs stem解析は未使用です: {update.get('error', '利用できません')}")
        return

    ratios = update.get("ratios") or {}
    if not ratios:
        result["warnings"].append("Demucs stem解析は完了しましたが、有効なstem比率を取得できませんでした。")
        return

    result["warnings"].append(f"Demucs stem比率を楽器推定に反映しました: {model}")
    result["instruments"] = merge_stem_instruments(result.get("instruments") or [], ratios)


def normalize_allin1_segments(segments: list[dict[str, Any]], result: dict[str, Any]) -> list[dict[str, Any]]:
    duration = float(result.get("analyzedDuration") or result.get("duration") or 0)
    if duration <= 0:
        return []

    normalized = []
    base_sections = result.get("structure") or []
    for raw in segments:
        start = clamp(float(raw.get("start") or 0), 0, duration)
        end = clamp(float(raw.get("end") or 0), 0, duration)
        if end - start < 1.0:
            continue

        label = normalize_segment_label(str(raw.get("label") or "section"))
        if label in {"Start", "End"}:
            continue

        reference = closest_section(base_sections, (start + end) / 2)
        energy = float(reference.get("energy", result.get("energy", 0.5))) if reference else float(result.get("energy", 0.5))
        brightness = (
            float(reference.get("brightness", result.get("brightness", 0.5)))
            if reference
            else float(result.get("brightness", 0.5))
        )
        normalized.append(
            {
                "label": label,
                "start": clean_float(start),
                "end": clean_float(end),
                "energy": clean_float(clamp01(energy)),
                "brightness": clean_float(clamp01(brightness)),
                "confidence": 0.88,
                "reason": "all-in-oneのsegment boundary / labelを優先して判定。",
                "description": f"{label}: all-in-one structure segment",
            }
        )

    return normalized


def normalize_segment_label(label: str) -> str:
    key = label.strip().lower().replace("_", "-")
    mapping = {
        "start": "Start",
        "end": "End",
        "intro": "Intro",
        "outro": "Outro",
        "break": "Break",
        "bridge": "Bridge",
        "inst": "Instrumental",
        "instrumental": "Instrumental",
        "solo": "Solo",
        "verse": "Verse",
        "chorus": "Chorus",
    }
    return mapping.get(key, label.strip().title() or "Section")


def closest_section(sections: list[dict[str, Any]], midpoint: float) -> dict[str, Any] | None:
    if not sections:
        return None

    return min(
        sections,
        key=lambda section: abs(
            ((float(section.get("start", 0)) + float(section.get("end", 0))) / 2) - midpoint
        ),
    )


def discover_stems(root: Path) -> dict[str, Path]:
    stems: dict[str, Path] = {}
    for path in root.rglob("*"):
        if path.suffix.lower() not in {".wav", ".flac", ".mp3"}:
            continue
        stem_name = path.stem.lower()
        if stem_name in {"drums", "bass", "other", "vocals", "guitar", "piano"}:
            stems[stem_name] = path
    return stems


def stem_energy_ratios(stem_paths: dict[str, Path]) -> dict[str, float]:
    energies: dict[str, float] = {}
    for stem, path in stem_paths.items():
        try:
            data, _sample_rate = sf.read(path, always_2d=False)
        except Exception:
            continue
        array = np.asarray(data, dtype=np.float32)
        if array.size == 0:
            continue
        energies[stem] = float(np.sqrt(np.mean(np.square(array))))

    total = sum(energies.values())
    if total <= 0:
        return {}
    return {stem: clean_float(value / total) for stem, value in energies.items()}


def merge_stem_instruments(instruments: list[dict[str, Any]], ratios: dict[str, float]) -> list[dict[str, Any]]:
    merged = [item for item in instruments if not should_replace_with_stem(item, ratios)]

    thresholds = {
        "drums": 0.08,
        "bass": 0.08,
        "vocals": 0.07,
        "guitar": 0.08,
        "piano": 0.08,
    }
    multipliers = {
        "drums": 2.4,
        "bass": 2.5,
        "vocals": 2.2,
        "guitar": 2.0,
        "piano": 2.0,
    }

    for stem, threshold in thresholds.items():
        ratio = float(ratios.get(stem) or 0)
        if ratio < threshold:
            continue
        label, style_tag, reason = STEM_LABELS[stem]
        merged.append(
            {
                "label": label,
                "styleTag": style_tag,
                "confidence": clean_float(clamp01(0.46 + ratio * multipliers[stem])),
                "reason": f"{reason} ({round(ratio * 100)}%)",
            }
        )

    if ratios.get("other", 0) >= 0.42 and not any("和音レイヤー" in item["label"] for item in merged):
        merged.append(
            {
                "label": "上モノ / 和音レイヤー",
                "styleTag": "harmonic instrumental layers",
                "confidence": clean_float(clamp01(0.42 + float(ratios["other"]) * 0.65)),
                "reason": f"Demucsでother stemの比率が高い ({round(float(ratios['other']) * 100)}%)",
            }
        )

    return dedupe_instruments(merged)


def should_replace_with_stem(instrument: dict[str, Any], ratios: dict[str, float]) -> bool:
    label = instrument.get("label", "")
    if "ドラム" in label or "パーカッション" in label:
        return "drums" in ratios
    if "ベース" in label:
        return "bass" in ratios
    if "ボーカル" in label:
        return "vocals" in ratios
    if "ギター" in label:
        return "guitar" in ratios
    if "ピアノ" in label:
        return "piano" in ratios
    return False


def dedupe_instruments(instruments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    output = []
    for item in sorted(instruments, key=lambda value: value["confidence"], reverse=True):
        key = item["label"]
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def build_suno_style_from_result(result: dict[str, Any]) -> str:
    bpm = result.get("bpm")
    tempo_tag = f"{bpm} BPM" if bpm else "moderate tempo"
    key = result.get("key")
    mode = result.get("mode")
    key_tag = f"{key} {mode}" if key and mode else "tonal pop harmony"
    profile = {
        "energy": float(result.get("energy") or 0),
        "brightness": float(result.get("brightness") or 0),
    }
    instruments = result.get("instruments") or []
    instrument_text = " ".join(item.get("styleTag", "") for item in instruments)
    genre_tags = infer_genre_tags(int(bpm or 100), profile, instrument_text)
    mood_tags = infer_mood_tags(mode, profile)
    instrument_tags = [item["styleTag"] for item in instruments[:4]]
    structure_tag = compact_structure(result.get("structure") or [])
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


def infer_genre_tags(bpm: int, profile: dict[str, float], instrument_text: str) -> list[str]:
    tags: list[str] = []
    if "synth" in instrument_text and profile["brightness"] > 0.45:
        tags.append("modern synth pop")
    if "drum" in instrument_text and bpm >= 110:
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


def infer_mood_tags(mode: str | None, profile: dict[str, float]) -> list[str]:
    tags: list[str] = []
    if mode == "minor":
        tags.append("emotional")
    if mode == "major" and profile["brightness"] > 0.45:
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
    return "-".join(compact).lower() if compact else "song"


def build_summary_from_result(result: dict[str, Any]) -> str:
    bpm_text = f"{result['bpm']} BPM" if result.get("bpm") else "BPM不明"
    key_text = f"{result['key']} {result['mode']}" if result.get("key") and result.get("mode") else "キー不明"
    energy = float(result.get("energy") or 0)
    energy_text = "高密度" if energy > 0.62 else "抑えめ" if energy < 0.34 else "中密度"
    instrument_text = "、".join(item["label"] for item in (result.get("instruments") or [])[:3])
    return f"{bpm_text} / {key_text} / {energy_text}。主なサウンド候補: {instrument_text}"


def python_path_candidates(paths: list[str], include_current: bool) -> list[str]:
    candidates = [
        *paths,
        os.environ.get("AUDIO_ADVANCED_PYTHON", ""),
        os.environ.get("ALLIN1_PYTHON", ""),
        os.environ.get("DEMUCS_PYTHON", ""),
        str(Path.home() / "Documents" / "music separater" / ".allin1-venv" / "bin" / "python"),
        str(Path.cwd() / ".venv" / "bin" / "python"),
        str(Path.home() / "Documents" / "music separater" / ".venv" / "bin" / "python"),
    ]
    if include_current:
        candidates.append(sys.executable)

    output = []
    for candidate in candidates:
        if candidate and candidate not in output and Path(candidate).is_file():
            output.append(candidate)
    return output


def build_subprocess_env(ffmpeg_path: str | None) -> dict[str, str]:
    env = os.environ.copy()
    path_prefixes = []
    if ffmpeg_path:
        path_prefixes.append(str(Path(ffmpeg_path).parent))
    audio_stem_ffmpeg = Path.home() / "Documents" / "music separater" / ".venv" / "bin" / "ffmpeg"
    if audio_stem_ffmpeg.is_file():
        path_prefixes.append(str(audio_stem_ffmpeg.parent))
    if path_prefixes:
        env["PATH"] = os.pathsep.join(path_prefixes + [env.get("PATH", "")])
    expat_lib = Path("/opt/homebrew/opt/expat/lib")
    if expat_lib.is_dir():
        existing_dyld_path = env.get("DYLD_LIBRARY_PATH", "")
        env["DYLD_LIBRARY_PATH"] = os.pathsep.join(
            [str(expat_lib), existing_dyld_path] if existing_dyld_path else [str(expat_lib)]
        )
    return env


def last_json_line(value: str) -> str:
    for line in reversed(value.splitlines()):
        stripped = line.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            return stripped
    return value


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def clamp01(value: float) -> float:
    return clamp(float(value), 0.0, 1.0)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AnalysisError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
