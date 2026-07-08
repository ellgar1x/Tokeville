"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-gold/30 bg-gold-soft p-6 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-gold">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        </div>
        <p className="mt-3 text-base font-semibold">You&apos;re on the list</p>
        <p className="mt-1 text-sm text-muted">We&apos;ll email you the moment your spot opens up. Thanks for your interest in Tokeville.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          placeholder="you@company.com"
          className="h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
        />
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-bright to-gold text-sm font-bold text-[#0a0a0b] shadow-[0_2px_24px_var(--gold-soft)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Joining…" : "Join the waiting list"}
      </button>
      <p className="mt-2.5 text-center text-[11px] text-subtle">
        No spam — we&apos;ll only email you about your Tokeville access.
      </p>
    </form>
  );
}
