"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export function DepositBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const rawStatus = params.get("deposit");
  // Snapshot status into state so it survives router.replace() clearing the URL param.
  const [status, setStatus] = useState<string | null>(rawStatus);
  const [visible, setVisible] = useState(!!rawStatus);

  useEffect(() => {
    if (!rawStatus) return;
    setStatus(rawStatus);
    setVisible(true);
    // Remove the query param from the URL without a reload.
    const url = new URL(window.location.href);
    url.searchParams.delete("deposit");
    router.replace(url.pathname + (url.search || ""), { scroll: false });

    // Cancelled deposits auto-dismiss; a successful one stays until the user
    // acts on the "create a key" CTA or dismisses it themselves.
    if (rawStatus !== "success") {
      const t = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(t);
    }
  }, [rawStatus, router]);

  if (!visible || !status) return null;

  const isSuccess = status === "success";

  return (
    <div
      className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        isSuccess
          ? "border-positive/30 bg-positive/10 text-positive"
          : "border-border bg-surface text-muted"
      }`}
    >
      <span className="mt-0.5 text-base leading-none">{isSuccess ? "✓" : "×"}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {isSuccess ? "Payment received" : "Payment cancelled"}
        </p>
        <p className="mt-0.5 text-xs opacity-80">
          {isSuccess
            ? "Your tokens are minted and ready. Create a free API key to start spending them."
            : "No charge was made. Your treasury balance is unchanged."}
        </p>
      </div>
      {isSuccess && (
        <Link
          href="/cards"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3 text-xs font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep"
        >
          Create your API key →
        </Link>
      )}
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 opacity-50 hover:opacity-100 cursor-pointer"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
