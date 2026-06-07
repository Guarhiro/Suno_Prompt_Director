import { promises as fs } from "fs";
import { readFileSync } from "fs";
import path from "path";

export const envLocalPath = path.join(process.cwd(), ".env.local");

type EnvMap = Record<string, string>;

function unquoteEnvValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }

  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function serializeEnvValue(value: string) {
  return JSON.stringify(value);
}

export function parseEnvContent(content: string) {
  const values: EnvMap = {};

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = unquoteEnvValue(match[2]);
  }

  return values;
}

export function readEnvLocalSync() {
  try {
    return parseEnvContent(readFileSync(envLocalPath, "utf8"));
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    if (code === "ENOENT") return {};
    throw error;
  }
}

export async function readEnvLocal() {
  try {
    return parseEnvContent(await fs.readFile(envLocalPath, "utf8"));
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    if (code === "ENOENT") return {};
    throw error;
  }
}

export async function updateEnvLocal(updates: EnvMap) {
  let content = "";

  try {
    content = await fs.readFile(envLocalPath, "utf8");
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    if (code !== "ENOENT") throw error;
  }

  const pending = new Map(Object.entries(updates));
  const nextLines = content
    ? content.split(/\r?\n/).map((line) => {
        const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);
        if (!match || !pending.has(match[2])) return line;

        const value = pending.get(match[2]) ?? "";
        pending.delete(match[2]);
        return `${match[1]}${match[2]}${match[3]}${serializeEnvValue(value)}`;
      })
    : [];

  for (const [key, value] of pending) {
    nextLines.push(`${key}=${serializeEnvValue(value)}`);
  }

  await fs.writeFile(envLocalPath, `${nextLines.filter((line, index, lines) => line || index < lines.length - 1).join("\n")}\n`);
}
