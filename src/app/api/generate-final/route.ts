import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenRouterClient, getOpenRouterModel } from "@/lib/openrouter";
import { buildFinalPrompt } from "@/lib/prompts/finalPrompt";
import { systemPrompt } from "@/lib/prompts/systemPrompt";
import {
  FinalGenerationRequestSchema,
  FinalSunoOutputSchema,
  finalSunoOutputJsonSchema
} from "@/lib/schemas/finalSunoOutput";
import { validateSunoOutput } from "@/lib/suno/validateSunoOutput";

export const runtime = "nodejs";

function parseJsonContent(content: string | null | undefined) {
  if (!content) {
    throw new Error("The model returned an empty response.");
  }

  return JSON.parse(content);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = FinalGenerationRequestSchema.parse(body);
    const client = getOpenRouterClient();

    const completion = await client.chat.completions.create({
      model: getOpenRouterModel(),
      temperature: 0.72,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildFinalPrompt(payload) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "final_suno_output",
          strict: true,
          schema: finalSunoOutputJsonSchema
        }
      }
    });

    const raw = parseJsonContent(completion.choices[0]?.message.content);
    const parsed = FinalSunoOutputSchema.parse(raw);
    const validation = validateSunoOutput(parsed);

    if (!validation.ok) {
      return NextResponse.json(
        {
          message: "Sunoの文字数または設定値の制限に合いませんでした。もう一度生成してください。",
          issues: validation.issues
        },
        { status: 422 }
      );
    }

    return NextResponse.json(validation.output);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "入力または生成結果の検証に失敗しました。", issues: error.flatten() },
        { status: 400 }
      );
    }

    const rawMessage = error instanceof Error ? error.message : "Unknown error";
    const missingKey = rawMessage.includes("OPENROUTER_API_KEY");
    const message = missingKey
      ? "APIキーが未設定です。.env.local に OPENROUTER_API_KEY を設定してください。"
      : rawMessage;
    const status = missingKey ? 500 : 502;

    return NextResponse.json({ message }, { status });
  }
}
