import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultOpenRouterModel } from "@/data/options";
import { readEnvLocal, updateEnvLocal } from "@/lib/env-local";

export const runtime = "nodejs";

const SettingsSchema = z.object({
  apiKey: z.string().trim().optional(),
  model: z.string().trim().min(1, "モデルを選択してください。")
});

function currentSettings(envLocal: Record<string, string>) {
  const apiKey = envLocal.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "";
  const model = envLocal.OPENROUTER_MODEL ?? process.env.OPENROUTER_MODEL ?? defaultOpenRouterModel;

  return {
    hasApiKey: apiKey.length > 0,
    model
  };
}

export async function GET() {
  const envLocal = await readEnvLocal();
  return NextResponse.json(currentSettings(envLocal));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = SettingsSchema.parse(body);
    const updates: Record<string, string> = {
      OPENROUTER_MODEL: payload.model
    };

    if (payload.apiKey) {
      updates.OPENROUTER_API_KEY = payload.apiKey;
    }

    await updateEnvLocal(updates);

    if (payload.apiKey) {
      process.env.OPENROUTER_API_KEY = payload.apiKey;
    }
    process.env.OPENROUTER_MODEL = payload.model;

    const envLocal = await readEnvLocal();
    return NextResponse.json(currentSettings(envLocal));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "設定の保存内容を確認してください。", issues: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "設定の保存に失敗しました。";
    return NextResponse.json({ message }, { status: 500 });
  }
}
