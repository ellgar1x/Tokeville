import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServiceClient } from "@/lib/supabase/service";
import { findModel } from "@/lib/models";
import { getPlatformKey } from "@/lib/platformKeys";
import { tokensFromUsd } from "@/lib/format";
import { hashKey } from "@/lib/apiKeys";

/**
 * OpenAI-compatible gateway. Point any OpenAI SDK/tool at
 *   POST /api/gateway/chat/completions
 * with `Authorization: Bearer sk-tok-…` (a per-admin Tokeville key). The call is
 * fulfilled on Tokeville's own provider keys and metered against the workspace's
 * deposited tokens — the customer never touches a raw provider key.
 */

interface Msg { role: string; content: string }

function err(status: number, message: string, type = "invalid_request_error") {
  return NextResponse.json({ error: { message, type } }, { status });
}

export async function POST(request: Request) {
  // ── Authenticate the Tokeville key ──────────────────────────────
  const authz = request.headers.get("authorization") ?? "";
  const token = authz.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("sk-tok-")) {
    return err(401, "Missing or malformed API key. Pass 'Authorization: Bearer sk-tok-…'.", "authentication_error");
  }

  const service = createServiceClient();
  const { data: keyRow } = await service
    .from("tokeville_keys")
    .select("id, workspace_id, revoked_at")
    .eq("key_hash", hashKey(token))
    .single();
  if (!keyRow || keyRow.revoked_at) {
    return err(401, "Invalid or revoked API key.", "authentication_error");
  }
  const workspaceId = keyRow.workspace_id as string;

  // ── Parse the OpenAI-style request ──────────────────────────────
  let body: { model?: string; messages?: Msg[]; max_tokens?: number };
  try { body = await request.json(); } catch { return err(400, "Invalid JSON body."); }
  const { model, messages } = body;
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return err(400, "'model' and a non-empty 'messages' array are required.");
  }

  const found = findModel(model);
  if (!found) return err(400, `Unknown model: ${model}. See Tokeville's model list.`, "model_not_found");
  const { provider, model: modelDef } = found;
  const apiModel = modelDef.apiModelId ?? model;

  // ── Balance gate BEFORE any provider cost ───────────────────────
  const [{ data: wallet }, { data: accts }] = await Promise.all([
    service.from("wallets").select("balance_tokens").eq("workspace_id", workspaceId).single(),
    service.from("sub_accounts").select("token_budget").eq("workspace_id", workspaceId),
  ]);
  const unalloc = Number(wallet?.balance_tokens ?? 0) - (accts ?? []).reduce((s, a) => s + Number(a.token_budget), 0);
  if (unalloc <= 0) {
    return err(402, "No unallocated tokens left. Buy tokens or free up an allocation in Tokeville.", "insufficient_quota");
  }

  // Tokeville's own funded key for this provider (never the customer's).
  const creds = getPlatformKey(provider.key);
  if (!creds) return err(503, `${provider.label} isn't enabled on Tokeville yet.`, "service_unavailable");

  // Split out a system prompt (Anthropic/Google want it separate).
  const system = messages.find((m) => m.role === "system")?.content;
  const convo = messages.filter((m) => m.role !== "system");

  let text = "";
  let input = 0;
  let output = 0;
  try {
    if (provider.key === "anthropic") {
      const client = new Anthropic({ apiKey: creds.apiKey });
      const res = await client.messages.create({
        model: apiModel,
        max_tokens: Math.min(body.max_tokens ?? 1024, 8192),
        system,
        messages: convo.map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: String(m.content) })),
      });
      text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      input = res.usage.input_tokens;
      output = res.usage.output_tokens;
    } else if (provider.key === "google") {
      const client = new GoogleGenerativeAI(creds.apiKey);
      const gm = client.getGenerativeModel({ model: apiModel, systemInstruction: system });
      const res = await gm.generateContent({
        contents: convo.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] })),
      });
      text = res.response.text();
      input = res.response.usageMetadata?.promptTokenCount ?? 0;
      output = res.response.usageMetadata?.candidatesTokenCount ?? 0;
    } else {
      // openai / mistral / custom — all OpenAI wire-compatible.
      const client = new OpenAI({ apiKey: creds.apiKey, ...(creds.baseUrl ? { baseURL: creds.baseUrl } : {}) });
      const oaiMsgs = [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        ...convo.map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) })),
      ];
      const res = await client.chat.completions.create({ model: apiModel, messages: oaiMsgs, max_completion_tokens: Math.min(body.max_tokens ?? 1024, 8192) });
      text = res.choices[0]?.message?.content ?? "";
      input = res.usage?.prompt_tokens ?? 0;
      output = res.usage?.completion_tokens ?? 0;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upstream provider request failed";
    console.error("[gateway] provider call failed", { provider: provider.key, model: apiModel, error: message });
    return err(502, message, "upstream_error");
  }

  // ── Meter: exact USD → TOK, deducted from the treasury ──────────
  const costUsd = (input / 1_000_000) * modelDef.inputPer1M + (output / 1_000_000) * modelDef.outputPer1M;
  const costTok = Math.max(1, Math.round(tokensFromUsd(costUsd)));
  const { error: rpcError } = await service.rpc("gateway_use_tokens", {
    p_workspace_id: workspaceId,
    p_amount: costTok,
    p_provider: provider.key,
    p_detail: `API · ${modelDef.label}`,
  });
  if (rpcError) console.error("[gateway] gateway_use_tokens failed", { workspaceId, costTok, error: rpcError.message });
  await service.from("tokeville_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

  // ── OpenAI-shaped response ──────────────────────────────────────
  return NextResponse.json({
    id: `chatcmpl-${keyRow.id.slice(0, 8)}-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: {
      prompt_tokens: input,
      completion_tokens: output,
      total_tokens: input + output,
      tokeville_tok: costTok,
      tokeville_cost_usd: costUsd,
    },
  });
}
