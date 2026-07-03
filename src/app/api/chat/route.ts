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

/** A file attached to the latest user message. `data` is base64 for image/pdf, raw text for text. */
interface Attachment {
  kind: "image" | "pdf" | "text";
  name: string;
  mediaType: string;
  data: string;
}

interface ChatBody {
  subAccountId?: string;
  model?: string;
  messages?: ChatMessage[];
  systemPrompt?: string;
  attachments?: Attachment[];
}

const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 8_000_000; // ~8MB decoded per file

/** Mutable usage accumulator filled by the provider streamers. */
interface Usage {
  input: number;
  output: number;
}

const DEFAULT_SYSTEM =
  "You are a helpful assistant accessed through Tokeville, an AI spend-management platform. Be clear and concise.";

/** Appended to every system prompt so the client's file/artifact features work. */
const ARTIFACT_GUIDE = `

When the user asks you to create or generate a file, PRODUCE THAT FILE in the format they asked for — never substitute a different format. Output the file as a single fenced code block; the app turns each of the block types below into a real, downloadable file.

QUALITY BAR — the file is the deliverable, so make it genuinely excellent, the same standard you'd hold in a normal answer:
- Write complete, substantive content. Real paragraphs with full sentences — never terse one-line fragments or placeholder text. If you'd write three sentences to explain something in chat, write them here too.
- Structure it like a professional would: a clear title, a short intro/overview, logical sections with descriptive headings, and a closing where it fits. Prefer well-developed prose over sparse bullet lists; use bullets only for things that are genuinely lists.
- Be specific and useful. Include concrete detail, realistic figures, and examples rather than vague generalities. Aim for the depth a real report/memo/spec would have.
- Use inline emphasis where it helps: **bold** for key terms and *italic* for emphasis (supported in document paragraphs, list items, and table cells).

Block types:
- Word document (.docx) — reports, letters, memos, essays, plans, specs. Tag \`\`\`document with ONLY a JSON object:
  {"title":"Document Title","subtitle":"optional one-line summary","body":[{"h1":"Section heading"},{"h2":"Subheading"},{"p":"A full paragraph of real prose."},{"ul":["item","item"]},{"ol":["step","step"]},{"quote":"a callout or notable quote"},{"table":{"headers":["Col A","Col B"],"rows":[["a1","b1"],["a2","b2"]]}}]}
  Items render in order. Use headings to organize, paragraphs for the substance, tables for structured comparisons.
- Spreadsheet (.xlsx) — tables, data, budgets, trackers, comparisons. Tag \`\`\`sheet with ONLY JSON:
  {"name":"Sheet1","columns":["Column A","Column B"],"rows":[["a1","b1"],["a2","b2"]]}. Put real, complete data in the rows (numbers as numbers, not strings). Add a totals row where it makes sense.
- CSV (.csv) — only if the user specifically asks for CSV: a \`\`\`csv block with raw comma-separated rows (header row first).
- PowerPoint (.pptx) — a \`\`\`slides block with ONLY a JSON array: [{"title":"...","subtitle":"...","bullets":["...","..."],"notes":"..."}]. Give each slide a focused message and 3–5 well-written bullets; subtitle and notes optional.
- Web page (.html) — ONLY when the user explicitly asks for a web page, website, or HTML. Never use HTML as a generic wrapper for a document or dataset.
- Code or plain text — for source code/config/text, a fenced block tagged with the correct language (\`\`\`python, \`\`\`json, \`\`\`md, \`\`\`txt, etc.).

If the user just says "make me a file" / "a document" without naming a format, produce a Word document (\`\`\`document). Choose the block type that matches what was asked. Output ONLY the single code block for the requested file (a brief sentence before it is fine) — do not also paste the raw JSON or repeat the contents elsewhere.`;

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
 * Resolve which key serves this request — STRICTLY within the caller's workspace.
 * Preference: the caller's OWN stored key for the provider → any key in the same
 * workspace. No cross-workspace or shared platform-key fallback (tenant isolation).
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

  // No key in THIS workspace → no chat. Never fall back to a shared/platform key:
  // every workspace uses only its own keys, so one company can never use another's.
  return null;
}

/** Stream text deltas from Anthropic, recording exact token usage as it arrives. */
async function* streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  usage: Usage,
  attachments: Attachment[] = [],
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey });
  const recent = messages.slice(-20);
  const mapped = recent.map((m, i) => {
    const isLastUser = i === recent.length - 1 && m.role === "user";
    if (isLastUser && attachments.length) {
      // Multimodal content: attachments first, then the typed text.
      const blocks: Anthropic.Messages.ContentBlockParam[] = [];
      for (const a of attachments) {
        if (a.kind === "image") {
          blocks.push({ type: "image", source: { type: "base64", media_type: a.mediaType as "image/png", data: a.data } });
        } else if (a.kind === "pdf") {
          blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } });
        } else {
          blocks.push({ type: "text", text: `Attached file "${a.name}":\n\n${a.data}` });
        }
      }
      if (m.content) blocks.push({ type: "text", text: String(m.content) });
      return { role: "user" as const, content: blocks };
    }
    return { role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: String(m.content) };
  });

  const stream = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt ?? DEFAULT_SYSTEM,
    messages: mapped,
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
  attachments: Attachment[] = [],
): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) });
  const isReasoning = model.startsWith("o1") || model.startsWith("o3");
  const recent = messages.slice(-20);
  const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(!isReasoning ? [{ role: "system" as const, content: systemPrompt ?? DEFAULT_SYSTEM }] : []),
    ...recent.map((m, i) => {
      const isLastUser = i === recent.length - 1 && m.role === "user";
      if (isLastUser && attachments.length) {
        const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
        for (const a of attachments) {
          if (a.kind === "image") {
            parts.push({ type: "image_url", image_url: { url: `data:${a.mediaType};base64,${a.data}` } });
          } else if (a.kind === "text") {
            parts.push({ type: "text", text: `Attached file "${a.name}":\n\n${a.data}` });
          } else {
            parts.push({ type: "text", text: `[Attached PDF "${a.name}" — ask the user to paste its text; PDFs aren't supported on this model.]` });
          }
        }
        if (m.content) parts.push({ type: "text", text: String(m.content) });
        return { role: "user" as const, content: parts };
      }
      return { role: m.role as "user" | "assistant", content: String(m.content) };
    }),
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
  attachments: Attachment[] = [],
): AsyncGenerator<string> {
  const client = new GoogleGenerativeAI(apiKey);
  const genModel = client.getGenerativeModel({ model, systemInstruction: systemPrompt ?? DEFAULT_SYSTEM });
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const last = messages[messages.length - 1];
  const chat = genModel.startChat({ history });

  // Build the final user turn with any attachments (images/PDF inline, text inline).
  const lastParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  for (const a of attachments) {
    if (a.kind === "image" || a.kind === "pdf") {
      lastParts.push({ inlineData: { mimeType: a.kind === "pdf" ? "application/pdf" : a.mediaType, data: a.data } });
    } else {
      lastParts.push({ text: `Attached file "${a.name}":\n\n${a.data}` });
    }
  }
  if (last.content) lastParts.push({ text: String(last.content) });
  const result = await chat.sendMessageStream(lastParts.length ? lastParts : last.content);
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
  attachments: Attachment[],
): AsyncGenerator<string> {
  if (provider.key === "anthropic") return streamAnthropic(creds.apiKey, apiModel, messages, systemPrompt, usage, attachments);
  if (provider.key === "openai" || provider.key === "custom")
    return streamOpenAI(creds.apiKey, creds.baseUrl, apiModel, messages, systemPrompt, usage, attachments);
  return streamGoogle(creds.apiKey, apiModel, messages, systemPrompt, usage, attachments);
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

  // Validate attachments (files dropped into the chat).
  const attachments: Attachment[] = Array.isArray(body.attachments) ? body.attachments : [];
  if (attachments.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ error: `Too many attachments (max ${MAX_ATTACHMENTS})` }, { status: 400 });
  }
  for (const a of attachments) {
    if (!a || !["image", "pdf", "text"].includes(a.kind) || typeof a.data !== "string") {
      return NextResponse.json({ error: "Invalid attachment" }, { status: 400 });
    }
    const bytes = a.kind === "text" ? a.data.length : Math.floor(a.data.length * 0.75);
    if (bytes > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: `Attachment "${a.name}" is too large (max 8MB).` }, { status: 400 });
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
  // Always append the artifact guide so file/pptx generation works.
  const systemPrompt = (reqSystemPrompt ?? modelDef.systemPrompt ?? DEFAULT_SYSTEM) + ARTIFACT_GUIDE;

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
        for await (const text of runStream(provider, creds, apiModel, messages, systemPrompt, usage, attachments)) {
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
