"use client";

import { useEffect, useRef, useState } from "react";
import { tok } from "@/lib/format";
import { CoinsIcon, PlusIcon, SendIcon, ShieldIcon, TrashIcon } from "./icons";
import { PROVIDERS } from "@/lib/models";
import { streamChat, type ChatUsage } from "@/lib/chatStream";

interface Msg {
  role: "user" | "assistant";
  content: string;
  usage?: ChatUsage;
}

interface Conversation {
  id: string;
  name: string;
  model: string;
  accountId: string;
  messages: Msg[];
  createdAt: number;
  updatedAt: number;
}

const ALL_MODELS = PROVIDERS.flatMap((p) =>
  p.models.map((m) => ({ ...m, providerKey: p.key, providerLabel: p.label, providerColor: p.color })),
);

const DEFAULT_MODEL = "claude-sonnet-4-6";

function newConv(accountId: string): Conversation {
  return {
    id: crypto.randomUUID(),
    name: "New chat",
    model: DEFAULT_MODEL,
    accountId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ChatWorkspace({
  accounts,
  availableProviders,
  storageKey,
}: {
  accounts: { id: string; name: string }[];
  availableProviders?: string[];
  storageKey: string;
}) {
  const lsKey = `tokeville-workspace-${storageKey}`;
  const defaultAccountId = accounts[0]?.id ?? "";

  const [convs, setConvs] = useState<Conversation[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Conversation[];
        if (parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [newConv(defaultAccountId)];
  });

  const [activeId, setActiveId] = useState<string>(() => convs[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist whenever conversations change
  useEffect(() => {
    try { localStorage.setItem(lsKey, JSON.stringify(convs)); } catch { /* quota */ }
  }, [lsKey, convs]);

  const active = convs.find((c) => c.id === activeId) ?? convs[0];

  function updateActive(patch: Partial<Conversation>) {
    setConvs((prev) =>
      prev.map((c) => (c.id === active?.id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
    );
  }

  function createConversation() {
    const conv = newConv(defaultAccountId);
    setConvs((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setInput("");
    setError(null);
  }

  function deleteConversation(id: string) {
    setConvs((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = newConv(defaultAccountId);
        if (activeId === id) setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  }

  function startRename(conv: Conversation) {
    setEditingName(conv.id);
    setEditingValue(conv.name);
  }

  function commitRename() {
    if (!editingName) return;
    const name = editingValue.trim() || "Untitled";
    setConvs((prev) => prev.map((c) => (c.id === editingName ? { ...c, name } : c)));
    setEditingName(null);
  }

  const hasKey = (providerKey: string) =>
    !availableProviders || availableProviders.includes(providerKey);

  const selectedModel = ALL_MODELS.find((m) => m.id === active?.model);
  const sessionTotal = active?.messages.reduce((s, m) => s + (m.usage?.total ?? 0), 0) ?? 0;

  async function send() {
    const text = input.trim();
    if (!text || loading || !active?.accountId) return;
    setError(null);

    const history: Msg[] = [...(active.messages), { role: "user", content: text }];

    // Auto-name from first user message
    const isFirstMessage = active.messages.length === 0;
    const autoName = isFirstMessage ? text.slice(0, 42).trim() + (text.length > 42 ? "…" : "") : undefined;

    updateActive({ messages: history, ...(autoName ? { name: autoName } : {}) });
    setInput("");
    setLoading(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9 }));

    const convId = active.id;
    const reqAccount = active.accountId;
    const reqModel = active.model;

    // Append an empty assistant message to the active conversation, then stream into it.
    setConvs((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...history, { role: "assistant", content: "" }], updatedAt: Date.now() }
          : c,
      ),
    );
    const setLastMessage = (fn: (m: Msg) => Msg) =>
      setConvs((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const msgs = [...c.messages];
          msgs[msgs.length - 1] = fn(msgs[msgs.length - 1]);
          return { ...c, messages: msgs, updatedAt: Date.now() };
        }),
      );

    try {
      await streamChat(
        {
          subAccountId: reqAccount,
          model: reqModel,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        },
        {
          onDelta: (text) => {
            setLastMessage((m) => ({ ...m, content: m.content + text }));
            requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9 }));
          },
          onDone: (usage, _deducted, deductError) => {
            setLastMessage((m) => ({ ...m, usage }));
            if (deductError) setError(`Reply delivered, but metering failed: ${deductError}`);
          },
        },
      );
    } catch (e) {
      // Remove the empty assistant placeholder and surface the error (e.g. top-up).
      setConvs((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const last = c.messages[c.messages.length - 1];
          return last && last.role === "assistant" && !last.content
            ? { ...c, messages: c.messages.slice(0, -1) }
            : c;
        }),
      );
      setError(e instanceof Error ? e.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9 }));
    }
  }

  const selectClass =
    "h-8 rounded-lg border border-border-strong bg-surface-2 px-2.5 text-xs outline-none transition-colors duration-200 focus:border-gold/50 cursor-pointer";

  if (!active) return null;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      {/* ── Left sidebar ── */}
      <div className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Chats</span>
          <button
            onClick={createConversation}
            title="New chat"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-strong bg-surface-2 text-muted transition-colors hover:border-gold/40 hover:text-gold cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {convs
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((conv) => {
              const isActive = conv.id === activeId;
              const modelMeta = ALL_MODELS.find((m) => m.id === conv.model);
              return (
                <div
                  key={conv.id}
                  className={`group relative flex flex-col gap-0.5 px-3 py-2.5 cursor-pointer transition-colors ${
                    isActive ? "bg-surface-2 border-l-2 border-l-gold" : "hover:bg-surface-2/60 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => { setActiveId(conv.id); setError(null); }}
                >
                  {editingName === conv.id ? (
                    <input
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingName(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded bg-surface px-1 text-xs outline-none ring-1 ring-gold/50"
                    />
                  ) : (
                    <p
                      className="truncate text-xs font-medium leading-snug"
                      onDoubleClick={(e) => { e.stopPropagation(); startRename(conv); }}
                    >
                      {conv.name}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    {modelMeta && (
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: modelMeta.providerColor }}
                      />
                    )}
                    <span className="truncate text-[10px] text-subtle">
                      {modelMeta?.label ?? conv.model}
                    </span>
                    {modelMeta?.badge && (
                      <span className="rounded border border-border px-1 py-0.5 text-[9px] font-medium text-subtle">
                        {modelMeta.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-subtle/60">{timeAgo(conv.updatedAt)}</span>

                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    className="absolute right-2 top-2 hidden h-5 w-5 items-center justify-center rounded text-subtle hover:text-danger group-hover:flex cursor-pointer"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-gold" />
            <span className="text-xs text-subtle truncate">History saved locally · tokens metered exactly</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={active.model}
              onChange={(e) => updateActive({ model: e.target.value, messages: active.messages })}
              className={selectClass}
              style={{ minWidth: 180 }}
            >
              {PROVIDERS.map((p) => (
                <optgroup key={p.key} label={p.label}>
                  {p.models.map((m) => (
                    <option key={m.id} value={m.id} disabled={!hasKey(p.key)}>
                      {m.label}{m.badge ? ` · ${m.badge}` : ""}{!hasKey(p.key) ? " (no key)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              value={active.accountId}
              onChange={(e) => updateActive({ accountId: e.target.value })}
              className={selectClass}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>Bill: {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Model info strip */}
        {selectedModel && (
          <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-1.5 text-xs text-subtle">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: selectedModel.providerColor }} />
            <span className="font-medium" style={{ color: selectedModel.providerColor }}>{selectedModel.providerLabel}</span>
            <span className="text-border-strong">·</span>
            <span>{selectedModel.description}</span>
            <span className="ml-auto shrink-0 font-mono">{selectedModel.contextK}K ctx</span>
            {selectedModel.supportsVision && <span className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">vision</span>}
            {selectedModel.supportsTools && <span className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">tools</span>}
            {selectedModel.badge && (
              <span className="rounded border border-gold/30 bg-gold-soft px-1.5 py-0.5 font-mono text-[10px] text-gold">{selectedModel.badge}</span>
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 px-6 py-5 scroll-thin">
          {active.messages.length === 0 && (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
              <CoinsIcon className="h-7 w-7 text-gold" />
              <p className="mt-3 text-sm font-medium">Start a conversation</p>
              <p className="mt-1 max-w-xs text-xs text-subtle">
                Tokens are deducted from your selected budget automatically on every reply.
              </p>
            </div>
          )}
          {active.messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-b from-gold-bright to-gold text-[#0a0a0b]"
                      : "border border-border bg-surface-2 text-foreground"
                  }`}
                >
                  {m.content || (loading && i === active.messages.length - 1 ? "…" : "")}
                </div>
                {m.usage && (
                  <p className="tnum mt-1 px-1 text-[11px] text-subtle">
                    ↑ {m.usage.input.toLocaleString()} in · ↓ {m.usage.output.toLocaleString()} out ·{" "}
                    <span className="font-medium text-gold">{tok(m.usage.total)}</span> metered
                  </p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-subtle">Thinking…</div>
            </div>
          )}
        </div>

        {error && (
          <p className="mx-4 mb-1 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</p>
        )}

        {/* Input bar */}
        <div className="flex items-end gap-2 border-t border-border px-4 py-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder={`Message ${selectedModel?.providerLabel ?? "AI"}…`}
            className="scroll-thin max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || !active.accountId}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none cursor-pointer"
          >
            <SendIcon className="h-4 w-4" />
            Send
          </button>
        </div>

        {sessionTotal > 0 && (
          <p className="border-t border-border px-4 py-2 text-xs text-subtle">
            This session: <span className="tnum font-medium text-gold">{tok(sessionTotal)}</span> metered across {active.messages.filter((m) => m.usage).length} replies
          </p>
        )}
      </div>
    </div>
  );
}
