import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenRouterClient, getOpenRouterModel } from "@/lib/openrouter";
import { buildAudioStyleProposalPrompt } from "@/lib/prompts/audioStyleProposalPrompt";
import { systemPrompt } from "@/lib/prompts/systemPrompt";
import {
  AudioStyleProposalOutputSchema,
  AudioStyleProposalRequestSchema,
  audioStyleProposalOutputJsonSchema
} from "@/lib/schemas/audioStyleProposal";

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
    const payload = AudioStyleProposalRequestSchema.parse(body);
    const client = getOpenRouterClient();

    const completion = await client.chat.completions.create({
      model: getOpenRouterModel(),
      temperature: 0.64,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildAudioStyleProposalPrompt(payload) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "audio_style_proposal_output",
          strict: true,
          schema: audioStyleProposalOutputJsonSchema
        }
      }
    });

    const raw = parseJsonContent(completion.choices[0]?.message.content);
    const parsed = AudioStyleProposalOutputSchema.parse(raw);

    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "音源スタイル案リクエストまたは生成結果の検証に失敗しました。", issues: error.flatten() },
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
