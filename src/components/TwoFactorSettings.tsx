"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; status: string };

export function TwoFactorSettings() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"idle" | "scan" | "verify">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);

  useEffect(() => { loadFactors(); }, []);

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }

  async function startEnroll() {
    setError(null);
    setStep("scan");
    const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (e || !data) { setError(e?.message ?? "Enrollment failed"); setStep("idle"); return; }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    const { data: chal } = await supabase.auth.mfa.challenge({ factorId: data.id });
    setChallengeId(chal?.id ?? null);
  }

  async function verify() {
    if (!factorId || !challengeId) return;
    setError(null);
    const { error: e } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.replace(/\s+/g, ""),
    });
    if (e) { setError(e.message); return; }
    setSuccess("Two-factor authentication enabled.");
    setStep("idle");
    setCode("");
    setQrCode(null);
    loadFactors();
    setTimeout(() => setSuccess(null), 5000);
  }

  async function unenroll(id: string) {
    setError(null);
    setUnenrolling(id);
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId: id });
    setUnenrolling(null);
    if (e) { setError(e.message); return; }
    setSuccess("Two-factor authentication removed.");
    loadFactors();
    setTimeout(() => setSuccess(null), 5000);
  }

  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const isEnabled = verifiedFactors.length > 0;

  const inputClass =
    "h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Two-factor authentication</h2>
          <p className="mt-0.5 text-xs text-subtle">
            Require a one-time code from your authenticator app on every sign-in.
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isEnabled
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-surface-2 text-subtle"
          }`}
        >
          {loading ? "…" : isEnabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
          {success}
        </p>
      )}

      {/* Enrolled factors */}
      {verifiedFactors.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {verifiedFactors.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <div className="flex-1">
                <p className="text-sm font-medium">Authenticator app</p>
                <p className="text-xs text-subtle">TOTP · enrolled</p>
              </div>
              <button
                onClick={() => unenroll(f.id)}
                disabled={unenrolling === f.id}
                className="text-xs text-danger opacity-60 hover:opacity-100 disabled:opacity-30 cursor-pointer"
              >
                {unenrolling === f.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Enroll flow */}
      {step === "idle" && !isEnabled && (
        <button
          onClick={startEnroll}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-4 text-xs font-medium text-foreground transition-colors hover:border-gold/40 hover:text-gold cursor-pointer"
        >
          <ShieldCheckIcon />
          Enable 2FA
        </button>
      )}

      {step === "scan" && qrCode && (
        <div className="mt-4 space-y-4 rounded-xl border border-border-strong bg-surface-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
            Step 1 — Scan with your authenticator app
          </p>
          <div className="flex gap-6">
            {/* QR code — Supabase returns an SVG data URL */}
            <div className="shrink-0 rounded-lg border border-border bg-white p-2">
              <img src={qrCode} alt="TOTP QR code" width={120} height={120} />
            </div>
            <div className="space-y-2 text-xs text-muted">
              <p>Scan this code with <strong className="text-foreground">Google Authenticator</strong>, <strong className="text-foreground">Authy</strong>, or any TOTP app.</p>
              {secret && (
                <div>
                  <p className="mb-1 text-subtle">Or enter manually:</p>
                  <code className="block rounded bg-surface px-2 py-1.5 font-mono text-[11px] tracking-widest text-gold break-all">
                    {secret}
                  </code>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setStep("verify")}
            className="inline-flex h-9 items-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-xs font-semibold text-[#0a0a0b] cursor-pointer"
          >
            I've scanned it →
          </button>
        </div>
      )}

      {step === "verify" && (
        <div className="mt-4 space-y-3 rounded-xl border border-border-strong bg-surface-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
            Step 2 — Enter the 6-digit code
          </p>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
            placeholder="000 000"
            inputMode="numeric"
            maxLength={7}
            className={`${inputClass} tnum text-center font-mono text-lg tracking-[0.3em]`}
          />
          <div className="flex gap-2">
            <button
              onClick={verify}
              disabled={code.length < 6}
              className="inline-flex h-9 items-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-xs font-semibold text-[#0a0a0b] disabled:opacity-40 cursor-pointer"
            >
              Confirm
            </button>
            <button
              onClick={() => { setStep("idle"); setCode(""); setError(null); }}
              className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-xs text-muted hover:bg-surface cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L2 3.5V8c0 3.3 2.4 6.1 6 7 3.6-.9 6-3.7 6-7V3.5L8 1Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
