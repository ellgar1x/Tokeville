import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { findModel } from "@/lib/models";
import { decryptSecret } from "@/lib/crypto";

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 50_000;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  subAccountId?: string;
  model?: string;
  messages?: ChatMessage[];
  systemPrompt?: string;
}

/** Fetch the API key (and optional base URL) for a provider from the DB. */
async function getProviderKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  provider: string,
): Promise<{ apiKey: string; baseUrl?: string | null } | null> {
  // For Anthropic, also fall back to the env key so existing deployments keep working.
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return { apiKey: process.env.ANTHROPIC_API_KEY };
  }

  const { data } = await supabase
    .from("provider_api_keys")
    .select("api_key, base_url")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .limit(1)
    .single();

  if (!data) return null;
  return { apiKey: decryptSecret(data.api_key), baseUrl: data.base_url };
}

const DEFAULT_SYSTEM = "You are a helpful assistant accessed through Tokeville, an AI spend-management platform. Be clear and concise.";

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<{ reply: string; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt ?? DEFAULT_SYSTEM,
    messages: messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content),
    })),
  });
  const reply = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return { reply, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}

async function callOpenAI(
  apiKey: string,
  baseUrl: string | null | undefined,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<{ reply: string; inputTokens: number; outputTokens: number }> {
  const client = new OpenAI({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) });

  // o1/o3 reasoning models don't support system messages
  const isReasoning = model.startsWith("o1") || model.startsWith("o3");
  const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(!isReasoning
      ? [{ role: "system" as const, content: systemPrompt ?? DEFAULT_SYSTEM }]
      : []),
    ...messages.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content),
    })),
  ];

  const response = await client.chat.completions.create({
    model,
    messages: oaiMessages,
    max_completion_tokens: 4096,
  });

  const reply = response.choices[0]?.message?.content ?? "";
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  return { reply, inputTokens, outputTokens };
}

async function callGoogle(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<{ reply: string; inputTokens: number; outputTokens: number }> {
  const client = new GoogleGenerativeAI(apiKey);
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt ?? DEFAULT_SYSTEM,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastMessage = messages[messages.length - 1];

  const chat = genModel.startChat({ history });
  const result = await chat.sendMessage(lastMessage.content);
  const reply = result.response.text();
  const inputTokens = result.response.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = result.response.usageMetadata?.candidatesTokenCount ?? 0;
  return { reply, inputTokens, outputTokens };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[chat] Unauthenticated request");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const workspaceId = user.app_metadata?.workspace_id;
  if (!workspaceId) {
    console.error("[chat] User has no workspace_id", { userId: user.id });
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  let body: ChatBody;
  try { body = await request.json(); } catch {
    console.error("[chat] Failed to parse request body");
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { subAccountId, model, messages, systemPrompt: reqSystemPrompt } = body;
  if (!subAccountId || !model || !Array.isArray(messages) || messages.length === 0) {
    console.error("[chat] Missing required fields", { subAccountId: !!subAccountId, model, messageCount: messages?.length });
    return NextResponse.json({ error: "Missing subAccountId, model, or messages" }, { status: 400 });
  }

  // Enforce payload bounds before any external calls
  if (messages.length > MAX_MESSAGES) {
    return NextResponse.json({ error: `Too many messages (max ${MAX_MESSAGES})` }, { status: 400 });
  }
  for (const msg of messages) {
    if (typeof msg.content === "string" && msg.content.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_CHARS} chars)` }, { status: 400 });
    }
  }

  // Validate subAccountId belongs to caller's workspace BEFORE incurring any AI cost
  const { data: accountCheck, error: accountErr } = await supabase
    .from("sub_accounts")
    .select("id")
    .eq("id", subAccountId)
    .single();

  if (accountErr || !accountCheck) {
    console.error("[chat] Sub-account not found or not accessible", { subAccountId, userId: user.id, err: accountErr?.message });
    return NextResponse.json({ error: "Sub-account not found in your workspace" }, { status: 403 });
  }

  const found = findModel(model);
  if (!found) {
    console.error("[chat] Unknown model requested", { model });
    return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 });
  }

  const { provider, model: modelDef } = found;
  // Use the real API model ID (virtual entries like "claude-code" map to a real model)
  const apiModel = modelDef.apiModelId ?? model;
  // System prompt: request overrides model default, which overrides the global default
  const systemPrompt = reqSystemPrompt ?? modelDef.systemPrompt;

  const creds = await getProviderKey(supabase, workspaceId, provider.key);
  if (!creds) {
    console.error("[chat] No API key for provider", { provider: provider.key, workspaceId });
    return NextResponse.json(
      { error: `No API key configured for ${provider.label}. Add one in Settings → AI Providers.` },
      { status: 503 },
    );
  }

  let reply = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    if (provider.key === "anthropic") {
      ({ reply, inputTokens, outputTokens } = await callAnthropic(creds.apiKey, apiModel, messages, systemPrompt));
    } else if (provider.key === "openai" || provider.key === "custom") {
      ({ reply, inputTokens, outputTokens } = await callOpenAI(creds.apiKey, creds.baseUrl, apiModel, messages, systemPrompt));
    } else if (provider.key === "google") {
      ({ reply, inputTokens, outputTokens } = await callGoogle(creds.apiKey, apiModel, messages, systemPrompt));
    } else {
      console.error("[chat] Unsupported provider", { provider: provider.key });
      return NextResponse.json({ error: `Unsupported provider: ${provider.key}` }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request to AI provider failed";
    console.error("[chat] AI provider call failed", { provider: provider.key, model: apiModel, error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const total = inputTokens + outputTokens;
  const { error: rpcError } = await supabase.rpc("use_tokens", {
    p_sub_account: subAccountId,
    p_amount: total,
    p_provider: provider.key,
    p_detail: `Chat · ${modelDef.label}`,
  });

  if (rpcError) {
    console.error("[chat] use_tokens RPC failed", { subAccountId, total, error: rpcError.message });
  }

  return NextResponse.json({
    reply,
    usage: { input: inputTokens, output: outputTokens, total },
    deducted: !rpcError,
    deductError: rpcError?.message ?? null,
  });
}
