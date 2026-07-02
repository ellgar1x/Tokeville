import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { findModel, type ModelDef, type ProviderDef } from "@/lib/models";
import { decryptSecret } from "@/lib/crypto";
import { tokensFromUsd } from "@/lib/format";

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

/** Mutable usage accumulator filled by the provider streamers. */
interface Usage {
  input: number;
  output: number;
}

const DEFAULT_SYSTEM =
  "You are a helpful assistant accessed through Tokeville, an AI spend-management platform. Be clear and concise.";

interface ResolvedKey {
  apiKey: string;
  baseUrl?: string | null;
  /** DB provider_api_keys.id when a stored key is used; null for the platform key. */
  keyId: string | null;
  /** Per-key budget in TOK (null = no cap); undefined for the platform key. */
  budgetTokens?: number | null;
  spentTokens?: number;
}

/**
 * Resolve which key serves this request. Preference: the caller's OWN stored key
 * for the provider → any workspace key → Tokeville's platform Anthropic key.
 * Returning the row id lets the caller enforce + record that key's budget.
 */
async function getProviderKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
  provider: string,
): Promise<ResolvedKey | null> {
  const { data: keys } = await supabase
    .from("provider_api_keys")
    .select("id, api_key, base_url, budget_tokens, spent_tokens, owner_user_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .order("created_at");

  const chosen = keys?.find((k) => k.owner_user_id === userId) ?? keys?.[0];
  if (chosen) {
    return {
      apiKey: decryptSecret(chosen.api_key),
      baseUrl: chosen.base_url,
      keyId: chosen.id as string,
      budgetTokens: chosen.budget_tokens === null ? null : Number(chosen.budget_tokens),
      spentTokens: Number(chosen.spent_tokens),
    };
  }

  // No stored key — fall back to Tokeville's own Anthropic key.
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return { apiKey: process.env.ANTHROPIC_API_KEY, keyId: null };
  }
  return null;
}

/** Stream text deltas from Anthropic, recording exact token usage as it arrives. */
async function* streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  usage: Usage,
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey });
  const stream = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt ?? DEFAULT_SYSTEM,
    messages: messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content),
    })),
    stream: true,
  });
  for await (const event of stream) {
    if (event.type === "message_start") {
      usage.input = event.message.usage.input_tokens;
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    } else if (event.type === "message_delta") {
      usage.output = event.usage.output_tokens;
    }
  }
}

/** Stream text deltas from an OpenAI-compatible endpoint. */
async function* streamOpenAI(
  apiKey: string,
  baseUrl: string | null | undefined,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  usage: Usage,
): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) });
  const isReasoning = model.startsWith("o1") || model.startsWith("o3");
  const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(!isReasoning ? [{ role: "system" as const, content: systemPrompt ?? DEFAULT_SYSTEM }] : []),
    ...messages.slice(-20).map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) })),
  ];

  // Some reasoning models don't support streaming — fall back to a single chunk.
  if (isReasoning) {
    const res = await client.chat.completions.create({ model, messages: oaiMessages, max_completion_tokens: 4096 });
    usage.input = res.usage?.prompt_tokens ?? 0;
    usage.output = res.usage?.completion_tokens ?? 0;
    yield res.choices[0]?.message?.content ?? "";
    return;
  }

  const stream = await client.chat.completions.create({
    model,
    messages: oaiMessages,
    max_completion_tokens: 4096,
    stream: true,
    stream_options: { include_usage: true },
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
    if (chunk.usage) {
      usage.input = chunk.usage.prompt_tokens;
      usage.output = chunk.usage.completion_tokens;
    }
  }
}

/** Stream text deltas from Google Gemini. */
async function* streamGoogle(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  usage: Usage,
): AsyncGenerator<string> {
  const client = new GoogleGenerativeAI(apiKey);
  const genModel = client.getGenerativeModel({ model, systemInstruction: systemPrompt ?? DEFAULT_SYSTEM });
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const last = messages[messages.length - 1];
  const chat = genModel.startChat({ history });
  const result = await chat.sendMessageStream(last.content);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
  const final = await result.response;
  usage.input = final.usageMetadata?.promptTokenCount ?? 0;
  usage.output = final.usageMetadata?.candidatesTokenCount ?? 0;
}

function runStream(
  provider: ProviderDef,
  creds: { apiKey: string; baseUrl?: string | null },
  apiModel: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  usage: Usage,
): AsyncGenerator<string> {
  if (provider.key === "anthropic") return streamAnthropic(creds.apiKey, apiModel, messages, systemPrompt, usage);
  if (provider.key === "openai" || provider.key === "custom")
    return streamOpenAI(creds.apiKey, creds.baseUrl, apiModel, messages, systemPrompt, usage);
  return streamGoogle(creds.apiKey, apiModel, messages, systemPrompt, usage);
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
    return NextResponse.json({ error: "Missing subAccountId, model, or messages" }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return NextResponse.json({ error: `Too many messages (max ${MAX_MESSAGES})` }, { status: 400 });
  }
  for (const msg of messages) {
    if (typeof msg.content === "string" && msg.content.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_CHARS} chars)` }, { status: 400 });
    }
  }

  // "personal" bills straight to the treasury's unallocated funds (no project).
  const isPersonal = subAccountId === "personal";

  if (isPersonal) {
    // Check there's unallocated treasury BEFORE incurring any AI cost.
    const [{ data: wallet }, { data: accts }] = await Promise.all([
      supabase.from("wallets").select("balance_tokens").single(),
      supabase.from("sub_accounts").select("token_budget"),
    ]);
    const balance = Number(wallet?.balance_tokens ?? 0);
    const allocated = (accts ?? []).reduce((s, a) => s + Number(a.token_budget), 0);
    if (balance - allocated <= 0) {
      console.error("[chat] No unallocated treasury for personal chat", { workspaceId, balance, allocated });
      return NextResponse.json(
        { error: "No unallocated treasury left. Top up your wallet or free up an allocation to keep chatting." },
        { status: 402 },
      );
    }
  } else {
    // Validate ownership AND check the balance BEFORE incurring any AI cost. RLS scopes
    // this to the caller's workspace, so a foreign sub-account simply isn't found.
    const { data: account, error: accountErr } = await supabase
      .from("sub_accounts")
      .select("id, token_budget, tokens_used")
      .eq("id", subAccountId)
      .single();

    if (accountErr || !account) {
      console.error("[chat] Sub-account not found", { subAccountId, userId: user.id, err: accountErr?.message });
      return NextResponse.json({ error: "Sub-account not found in your workspace" }, { status: 403 });
    }

    const remaining = Number(account.token_budget) - Number(account.tokens_used);
    if (remaining <= 0) {
      console.error("[chat] Insufficient balance", { subAccountId, remaining });
      return NextResponse.json(
        { error: "Insufficient balance on this budget. Please top up your wallet to keep chatting." },
        { status: 402 },
      );
    }
  }

  const found = findModel(model);
  if (!found) {
    return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 });
  }
  const { provider, model: modelDef } = found as { provider: ProviderDef; model: ModelDef };
  const apiModel = modelDef.apiModelId ?? model;
  const systemPrompt = reqSystemPrompt ?? modelDef.systemPrompt;

  const creds = await getProviderKey(supabase, workspaceId, user.id, provider.key);
  if (!creds) {
    return NextResponse.json(
      { error: `No API key configured for ${provider.label}. Add one in Settings → AI Providers.` },
      { status: 503 },
    );
  }

  // Enforce the specific key's own budget (when it has one), before any AI cost.
  if (creds.keyId && creds.budgetTokens != null && (creds.spentTokens ?? 0) >= creds.budgetTokens) {
    return NextResponse.json(
      { error: "This API key's budget is used up. Raise its budget in Settings → AI Providers, or use another key." },
      { status: 402 },
    );
  }

  const encoder = new TextEncoder();
  const usage: Usage = { input: 0, output: 0 };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const text of runStream(provider, creds, apiModel, messages, systemPrompt, usage)) {
          if (text) send({ type: "delta", text });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Request to AI provider failed";
        console.error("[chat] streaming failed", { provider: provider.key, model: apiModel, error: message });
        send({ type: "error", error: message });
        controller.close();
        return;
      }

      // Exact cost using the model's published per-million input/output pricing,
      // converted to TOK at the treasury rate, then deducted from the budget.
      const costUsd =
        (usage.input / 1_000_000) * modelDef.inputPer1M +
        (usage.output / 1_000_000) * modelDef.outputPer1M;
      const costTok = Math.max(1, Math.round(tokensFromUsd(costUsd)));

      const { error: rpcError } = isPersonal
        ? await supabase.rpc("use_tokens_personal", {
            p_workspace_id: workspaceId,
            p_amount: costTok,
            p_provider: provider.key,
            p_detail: `Personal · ${modelDef.label}`,
          })
        : await supabase.rpc("use_tokens", {
            p_sub_account: subAccountId,
            p_amount: costTok,
            p_provider: provider.key,
            p_detail: `Chat · ${modelDef.label}`,
          });
      if (rpcError) {
        console.error("[chat] token deduction RPC failed", { subAccountId, costTok, isPersonal, error: rpcError.message });
      }

      // Also record the spend against the specific API key used (per-key budget view).
      if (creds.keyId) {
        const { error: keyErr } = await supabase.rpc("record_key_spend", {
          p_key_id: creds.keyId,
          p_amount: costTok,
        });
        if (keyErr) console.error("[chat] record_key_spend failed", { keyId: creds.keyId, error: keyErr.message });
      }

      send({
        type: "done",
        usage: { input: usage.input, output: usage.output, total: costTok, costUsd },
        deducted: !rpcError,
        deductError: rpcError?.message ?? null,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
