"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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

    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, [rawStatus, router]);

  if (!visible || !status) return null;

  const isSuccess = status === "success";

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        isSuccess
          ? "border-positive/30 bg-positive/10 text-positive"
          : "border-border bg-surface text-muted"
      }`}
    >
      <span className="mt-0.5 text-base leading-none">{isSuccess ? "✓" : "×"}</span>
      <div>
        <p className="font-semibold">
          {isSuccess ? "Payment received" : "Payment cancelled"}
        </p>
        <p className="mt-0.5 text-xs opacity-80">
          {isSuccess
            ? "Your tokens are being minted — the treasury balance will update in a moment."
            : "No charge was made. Your treasury balance is unchanged."}
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="ml-auto shrink-0 opacity-50 hover:opacity-100 cursor-pointer"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
