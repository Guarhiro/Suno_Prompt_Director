import { execFile } from "node:child_process";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const MAX_AUDIO_BYTES = 90 * 1024 * 1024;
const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".aiff", ".aif"]);

export async function POST(request: Request) {
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ message: "音声ファイルが送信されていません。" }, { status: 400 });
    }

    if (!isAudioFile(fileValue)) {
      return NextResponse.json({ message: "音声ファイルのみ解析できます。" }, { status: 415 });
    }

    if (fileValue.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ message: "解析できる音声ファイルは90MBまでです。" }, { status: 413 });
    }

    tempDir = join(tmpdir(), `suno-audio-advanced-${crypto.randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    const audioPath = join(tempDir, `source${safeExtension(fileValue.name)}`);
    const buffer = Buffer.from(await fileValue.arrayBuffer());
    await writeFile(audioPath, buffer);

    const pythonPath = await resolvePythonPath();
    const ffmpegPath = await resolveOptionalExecutable(process.env.FFMPEG_PATH, [
      join(process.cwd(), ".venv", "bin", "ffmpeg"),
      "/opt/homebrew/bin/ffmpeg",
      "/usr/local/bin/ffmpeg",
      "/opt/homebrew/opt/ffmpeg/bin/ffmpeg",
      "/usr/local/opt/ffmpeg/bin/ffmpeg"
    ]);
    const allin1PythonCandidates = await resolveExecutableCandidates([
      process.env.ALLIN1_PYTHON,
      process.env.AUDIO_ADVANCED_PYTHON,
      join(process.cwd(), ".venv", "bin", "python")
    ]);
    const demucsPythonCandidates = await resolveExecutableCandidates([
      process.env.DEMUCS_PYTHON,
      process.env.AUDIO_ADVANCED_PYTHON,
      join(process.cwd(), ".venv", "bin", "python")
    ]);
    const scriptPath = join(process.cwd(), "scripts", "analyze_audio_advanced.py");
    const args = [scriptPath, audioPath, "--file-name", basename(fileValue.name)];

    if (ffmpegPath) {
      args.push("--ffmpeg", ffmpegPath);
    }
    for (const candidate of allin1PythonCandidates) {
      args.push("--allin1-python", candidate);
    }
    for (const candidate of demucsPythonCandidates) {
      args.push("--demucs-python", candidate);
    }

    const { stdout } = await execFileAsync(pythonPath, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(ffmpegPath ? { FFMPEG_PATH: ffmpegPath } : {})
      },
      maxBuffer: 24 * 1024 * 1024,
      timeout: 900_000
    });

    return NextResponse.json(JSON.parse(stdout));
  } catch (error) {
    const message = parseAnalysisError(error);
    return NextResponse.json({ message }, { status: 502 });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

function isAudioFile(file: File) {
  if (file.type.startsWith("audio/")) return true;
  return AUDIO_EXTENSIONS.has(safeExtension(file.name));
}

function safeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return AUDIO_EXTENSIONS.has(extension) ? extension : ".audio";
}

async function resolvePythonPath() {
  const candidates = [
    process.env.AUDIO_ANALYSIS_PYTHON,
    join(process.cwd(), ".venv", "bin", "python"),
    "python3"
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate === "python3") return candidate;
    if (await fileExists(candidate)) return candidate;
  }

  return "python3";
}

async function resolveOptionalExecutable(explicitPath: string | undefined, candidates: string[]) {
  const allCandidates = [explicitPath, ...candidates].filter(Boolean) as string[];

  for (const candidate of allCandidates) {
    if (await fileExists(candidate)) return candidate;
  }

  return undefined;
}

async function resolveExecutableCandidates(candidates: Array<string | undefined>) {
  const output: string[] = [];
  for (const candidate of candidates) {
    if (candidate && !output.includes(candidate) && (await fileExists(candidate))) {
      output.push(candidate);
    }
  }
  return output;
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseAnalysisError(error: unknown) {
  if (error instanceof SyntaxError) {
    return "高精度音声解析結果のJSON変換に失敗しました。";
  }

  if (isExecError(error)) {
    const stderr = error.stderr?.trim();
    const stdout = error.stdout?.trim();
    const parsed = parseJsonError(stderr) ?? parseJsonError(stdout);

    if (parsed) return parsed;
    if (stderr) return stderr;
    if (error.killed) return "高精度音声解析がタイムアウトしました。短い音声で試してください。";
  }

  return error instanceof Error ? error.message : "高精度音声解析に失敗しました。";
}

function parseJsonError(value: string | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return typeof parsed?.error === "string" ? parsed.error : null;
  } catch {
    return null;
  }
}

function isExecError(error: unknown): error is Error & { stderr?: string; stdout?: string; killed?: boolean } {
  return error instanceof Error && ("stderr" in error || "stdout" in error || "killed" in error);
}
