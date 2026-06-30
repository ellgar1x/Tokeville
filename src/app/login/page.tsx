"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TokevilleMark } from "@/components/icons";

type Mode = "signin" | "signup" | "mfa";

function LoginInner() {
  const params = useSearchParams();
  const invitedEmail = params.get("email") ?? "";
  const [mode, setMode] = useState<Mode>(invitedEmail ? "signup" : "signin");
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || email.split("@")[0] } },
        });
        if (signUpError) throw signUpError;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // Check if MFA is required before redirecting.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const factor = factorsData?.totp?.[0];
        if (factor) {
          const { data: chal } = await supabase.auth.mfa.challenge({ factorId: factor.id });
          setMfaFactorId(factor.id);
          setMfaChallengeId(chal?.id ?? null);
          setMode("mfa");
          setLoading(false);
          return;
        }
      }

      // Full navigation so the server layout picks up the fresh session cookie.
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode.replace(/\s+/g, ""),
      });
      if (error) throw error;
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setLoading(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(680px 320px at 50% -40px, rgba(232,184,95,0.12), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <TokevilleMark className="h-12 w-12" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {mode === "mfa" ? "Two-factor check" : mode === "signin" ? "Welcome back" : "Create your treasury"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "mfa"
              ? "Enter the 6-digit code from your authenticator app"
              : mode === "signin"
                ? "Sign in to manage your AI token spend"
                : "Start managing AI tokens as currency"}
          </p>
        </div>

        {mode === "mfa" ? (
          <form
            onSubmit={handleMfa}
            className="rounded-2xl border border-border bg-surface p-6 shadow-[0_2px_24px_rgba(0,0,0,0.4)]"
          >
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
              Authenticator code
            </label>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={7}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000 000"
              className={`${inputClass} mb-5 tnum text-center font-mono text-2xl tracking-[0.4em]`}
            />
            {error && (
              <p className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || mfaCode.length < 6}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-b from-gold-bright to-gold text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-border bg-surface p-6 shadow-[0_2px_24px_rgba(0,0,0,0.4)]"
            >
              {mode === "signup" && (
                <div className="mb-4">
                  <label htmlFor="name" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Elliot Garcia"
                    className={inputClass}
                  />
                </div>
              )}
              <div className="mb-4">
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={inputClass}
                />
              </div>
              <div className="mb-5">
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={inputClass}
                />
              </div>
              {error && (
                <p className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
              >
                {loading ? "Just a moment…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-muted">
              {mode === "signin" ? "New to Tokeville?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
                className="font-medium text-gold transition-colors duration-200 hover:text-gold-bright cursor-pointer"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
