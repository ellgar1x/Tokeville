"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TokevilleMark } from "@/components/icons";
import { usernameToEmail } from "@/lib/members";

type Audience = "admin" | "member";
type AdminMode = "signin" | "signup";

function LoginInner() {
  const params = useSearchParams();
  const invitedEmail = params.get("email") ?? "";

  const [audience, setAudience] = useState<Audience>("admin");
  const [adminMode, setAdminMode] = useState<AdminMode>(invitedEmail ? "signup" : "signin");

  const [email, setEmail] = useState(invitedEmail);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [adminType, setAdminType] = useState<"team" | "institution">("team");

  const [mfa, setMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchAudience(next: Audience) {
    setAudience(next);
    setError(null);
  }

  // Returns true if an MFA challenge was started (caller should stop).
  async function maybeStartMfa(supabase: ReturnType<typeof createClient>) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factor = factorsData?.totp?.[0];
      if (factor) {
        const { data: chal } = await supabase.auth.mfa.challenge({ factorId: factor.id });
        setMfaFactorId(factor.id);
        setMfaChallengeId(chal?.id ?? null);
        setMfa(true);
        return true;
      }
    }
    return false;
  }

  async function handleAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      if (adminMode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || email.split("@")[0], workspace_type: adminType } },
        });
        if (signUpError) throw signUpError;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      if (await maybeStartMfa(supabase)) {
        setLoading(false);
        return;
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  }

  async function handleMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      const memberEmail = usernameToEmail(username);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: memberEmail,
        password,
      });
      if (signInError) {
        throw new Error("Incorrect username or password.");
      }

      // Safety: only admin-provisioned member accounts may use this entrance.
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.app_metadata?.role !== "member") {
        await supabase.auth.signOut();
        throw new Error("That isn't a member account. Use the Admin tab.");
      }

      if (await maybeStartMfa(supabase)) {
        setLoading(false);
        return;
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
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

  const heading = mfa
    ? "Two-factor check"
    : audience === "member"
      ? "Member sign-in"
      : adminMode === "signin"
        ? "Welcome back"
        : "Create your treasury";

  const subheading = mfa
    ? "Enter the 6-digit code from your authenticator app"
    : audience === "member"
      ? "Sign in with the username your workspace admin gave you"
      : adminMode === "signin"
        ? "Sign in to manage your AI token spend"
        : "Start managing AI tokens as currency";

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
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-1 text-sm text-muted">{subheading}</p>
        </div>

        {/* Audience switch — hidden during the MFA step */}
        {!mfa && (
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1">
            {(["admin", "member"] as Audience[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => switchAudience(a)}
                className={`h-9 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  audience === a
                    ? "bg-surface text-foreground shadow-sm border border-border"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {a === "admin" ? "Admin" : "Member"}
              </button>
            ))}
          </div>
        )}

        {mfa ? (
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
        ) : audience === "member" ? (
          <form
            onSubmit={handleMember}
            className="rounded-2xl border border-border bg-surface p-6 shadow-[0_2px_24px_rgba(0,0,0,0.4)]"
          >
            <div className="mb-4">
              <label htmlFor="username" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                autoCapitalize="none"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="taylor.r"
                className={inputClass}
              />
            </div>
            <div className="mb-5">
              <label htmlFor="member-password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
                Password
              </label>
              <input
                id="member-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
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
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-b from-gold-bright to-gold text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {loading ? "Just a moment…" : "Sign in"}
            </button>
            <p className="mt-5 text-center text-xs text-subtle">
              Member accounts are created by your workspace admin.
            </p>
          </form>
        ) : (
          <>
            <form
              onSubmit={handleAdmin}
              className="rounded-2xl border border-border bg-surface p-6 shadow-[0_2px_24px_rgba(0,0,0,0.4)]"
            >
              {adminMode === "signup" && (
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
              {adminMode === "signup" && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
                    Account type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: "team", title: "Managed", desc: "Pay all your AI through Tokeville — deposit funds, and your tokens run on Tokeville's own keys. Metered per call" },
                      { key: "institution", title: "Institutional", desc: "Budget your own/contracted AI by department. Subscription-based" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setAdminType(opt.key)}
                        className={`rounded-lg border p-3 text-left transition-colors duration-200 cursor-pointer ${
                          adminType === opt.key
                            ? "border-gold/50 bg-gold-soft"
                            : "border-border-strong bg-surface hover:border-gold/30"
                        }`}
                      >
                        <span className={`block text-sm font-semibold ${adminType === opt.key ? "text-gold" : ""}`}>
                          {opt.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-subtle">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
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
                  autoComplete={adminMode === "signin" ? "current-password" : "new-password"}
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
                {loading ? "Just a moment…" : adminMode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-muted">
              {adminMode === "signin" ? "New to Tokeville?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => { setAdminMode(adminMode === "signin" ? "signup" : "signin"); setError(null); }}
                className="font-medium text-gold transition-colors duration-200 hover:text-gold-bright cursor-pointer"
              >
                {adminMode === "signin" ? "Create an account" : "Sign in"}
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
