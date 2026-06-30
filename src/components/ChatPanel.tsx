"use client";

import { useEffect, useRef, useState } from "react";
import { tok } from "@/lib/format";
import { CoinsIcon, SendIcon, ShieldIcon } from "./icons";
import { PROVIDERS } from "@/lib/models";
import { streamChat, type ChatUsage } from "@/lib/chatStream";

interface Msg {
  role: "user" | "assistant";
  content: string;
  usage?: ChatUsage;
}

// Flat list of all models with provider metadata for the selector
const ALL_MODELS = PROVIDERS.flatMap((p) =>
  p.models.map((m) => ({ ...m, providerKey: p.key, providerLabel: p.label, providerColor: p.color })),
);

const DEFAULT_MODEL = "claude-sonnet-4-6";

export function ChatPanel({
  accounts,
  availableProviders,
  fullHeight = false,
  storageKey,
}: {
  accounts: { id: string; name: string }[];
  availableProviders?: string[];
  fullHeight?: boolean;
  /** When provided, messages persist to localStorage under this key. */
  storageKey?: string;
}) {
  const lsKey = storageKey ? `tokeville-chat-${storageKey}` : null;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load persisted messages on mount
  useEffect(() => {
    if (!lsKey) return;
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Msg[];
        setMessages(parsed);
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9 }));
      }
    } catch { /* ignore corrupt storage */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsKey]);

  // Persist messages whenever they change
  useEffect(() => {
    if (!lsKey || messages.length === 0) return;
    try { localStorage.setItem(lsKey, JSON.stringify(messages)); } catch { /* quota exceeded */ }
  }, [lsKey, messages]);

  const sessionTotal = messages.reduce((s, m) => s + (m.usage?.total ?? 0), 0);
  const selectedModel = ALL_MODELS.find((m) => m.id === model);

  // Show all models; grey out ones without a configured key
  const hasKey = (providerKey: string) =>
    !availableProviders || availableProviders.includes(providerKey);

  async function send() {
    const text = input.trim();
    if (!text || loading || !accountId) return;
    setError(null);

    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setLoading(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9 }));

    // Append an empty assistant message that fills in as the stream arrives.
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    const setLast = (fn: (m: Msg) => Msg) =>
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });

    try {
      await streamChat(
        {
          subAccountId: accountId,
          model,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        },
        {
          onDelta: (text) => {
            setLast((m) => ({ ...m, content: m.content + text }));
            requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9 }));
          },
          onDone: (usage, _deducted, deductError) => {
            setLast((m) => ({ ...m, usage }));
            if (deductError) setError(`Reply delivered, but metering failed: ${deductError}`);
          },
        },
      );
    } catch (e) {
      // Drop the empty assistant placeholder and surface the error (e.g. top-up).
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last && last.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
      });
      setError(e instanceof Error ? e.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9 }));
    }
  }

  const selectClass =
    "h-9 rounded-lg border border-border-strong bg-surface-2 px-2.5 text-xs outline-none transition-colors duration-200 focus:border-gold/50 cursor-pointer";

  function clearHistory() {
    setMessages([]);
    if (lsKey) localStorage.removeItem(lsKey);
  }

  return (
    <section className={`flex flex-col rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${fullHeight ? "flex-1 min-h-0" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Chat through Tokeville</h2>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-subtle">
            <ShieldIcon className="h-3 w-3 text-gold" />
            {lsKey ? "History saved locally · tokens metered exactly" : "Metered exactly · messages never stored"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Grouped model selector */}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={selectClass}
            style={{ minWidth: 180 }}
          >
            {PROVIDERS.map((p) => (
              <optgroup key={p.key} label={p.label}>
                {p.models.map((m) => (
                  <option key={m.id} value={m.id} disabled={!hasKey(p.key)}>
                    {m.label}{!hasKey(p.key) ? " (no key)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                Bill: {a.name}
              </option>
            ))}
          </select>
          {lsKey && messages.length > 0 && (
            <button onClick={clearHistory} className="h-9 rounded-lg border border-border-strong bg-surface-2 px-3 text-xs font-medium text-muted transition-colors hover:border-danger/40 hover:text-danger cursor-pointer">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Model info strip */}
      {selectedModel && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-6 py-2 text-xs text-subtle">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: selectedModel.providerColor }}
          />
          <span className="font-medium" style={{ color: selectedModel.providerColor }}>
            {selectedModel.providerLabel}
          </span>
          <span className="text-border-strong">·</span>
          <span>{selectedModel.description}</span>
          <span className="ml-auto shrink-0 font-mono">
            {selectedModel.contextK}K ctx
          </span>
          {selectedModel.supportsVision && (
            <span className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">vision</span>
          )}
          {selectedModel.supportsTools && (
            <span className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">tools</span>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className={`scroll-thin flex-1 space-y-4 overflow-y-auto px-6 py-5 ${fullHeight ? "min-h-0 flex-1" : "max-h-[500px] min-h-[280px]"}`}
      >
        {messages.length === 0 && (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
            <CoinsIcon className="h-7 w-7 text-gold" />
            <p className="mt-3 text-sm font-medium">Send a message to start</p>
            <p className="mt-1 max-w-xs text-xs text-subtle">
              Pick any model above. Input + output tokens are deducted from the
              selected budget automatically.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-gradient-to-b from-gold-bright to-gold text-[#0a0a0b]"
                    : "border border-border bg-surface-2 text-foreground"
                }`}
              >
                {m.content || (loading && i === messages.length - 1 ? "…" : "")}
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
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-subtle">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mx-6 mb-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-border px-4 py-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={`Message ${selectedModel?.providerLabel ?? "AI"}…`}
          className="scroll-thin max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim() || !accountId}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none cursor-pointer"
        >
          <SendIcon className="h-4 w-4" />
          Send
        </button>
      </div>

      {sessionTotal > 0 && (
        <p className="border-t border-border px-6 py-2.5 text-xs text-subtle">
          This session:{" "}
          <span className="tnum font-medium text-gold">{tok(sessionTotal)}</span> metered
          across {messages.filter((m) => m.usage).length} replies
        </p>
      )}
    </section>
  );
}
