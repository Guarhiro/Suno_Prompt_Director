import OpenAI from "openai";
import { defaultOpenRouterModel } from "@/data/options";
import { readEnvLocalSync } from "@/lib/env-local";

function getSettingValue(key: string) {
  const envLocal = readEnvLocalSync();
  return envLocal[key] ?? process.env[key];
}

export function getOpenRouterClient() {
  const apiKey = getSettingValue("OPENROUTER_API_KEY");

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": getSettingValue("OPENROUTER_SITE_URL") ?? "http://localhost:3000",
      "X-Title": "Suno Prompt Director"
    }
  });
}

export function getOpenRouterModel() {
  return getSettingValue("OPENROUTER_MODEL") ?? defaultOpenRouterModel;
}
