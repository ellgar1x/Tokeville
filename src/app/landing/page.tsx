import Link from "next/link";
import { TokevilleMark } from "@/components/icons";
import { ScrollReveal } from "@/components/ScrollReveal";
import { WaitlistForm } from "@/components/WaitlistForm";
import { INSTITUTIONAL_TIERS } from "@/lib/plans";

export const metadata = {
  title: "Tokeville — AI spend, under control",
  description:
    "Turn AI tokens into real currency. Fund a treasury, set budgets per team, and meter every model call in real time across providers.",
};

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <ScrollReveal />
      <BackgroundDecor />

      {/* ─── Floating nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 px-4 pt-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-border/80 bg-surface/70 px-4 py-2.5 backdrop-blur-xl sm:px-5">
          <Link href="/landing" className="flex items-center gap-2.5">
            <TokevilleMark className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-tight">Tokeville</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#plans" className="transition-colors hover:text-foreground">Plans</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-lg px-3.5 text-sm font-medium text-muted transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <a
              href="#waitlist"
              className="inline-flex h-9 items-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_var(--gold-soft)] transition-all duration-200 hover:from-gold hover:to-gold-deep"
            >
              Join waitlist
            </a>
          </div>
        </nav>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Copy */}
          <div className="text-center lg:text-left">
            <div className="reveal-on-scroll inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
              </span>
              Multi-model treasury · live metering
            </div>

            <h1 className="reveal-on-scroll reveal-d1 mt-6 text-balance text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl">
              AI spend,
              <br />
              <span className="gold-shimmer">under control.</span>
            </h1>

            <p className="reveal-on-scroll reveal-d2 mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted lg:mx-0">
              Tokeville turns AI usage into a currency you actually govern. Fund a
              central treasury, allocate token budgets across teams and projects, and
              meter every model call in real time — across every provider, through one
              interface.
            </p>

            <div className="reveal-on-scroll reveal-d3 mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start">
              <a
                href="#waitlist"
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-bright to-gold px-7 text-sm font-bold text-[#0a0a0b] shadow-[0_2px_24px_var(--gold-soft)] transition-all duration-200 hover:from-gold hover:to-gold-deep sm:w-auto"
              >
                Join the waiting list
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
              <a
                href="#how"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border-strong bg-surface/60 px-7 text-sm font-medium text-foreground backdrop-blur transition-colors duration-200 hover:border-gold/40 hover:text-gold sm:w-auto"
              >
                See how it works
              </a>
            </div>

            <dl className="reveal-on-scroll reveal-d4 mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6 lg:mx-0">
              {[
                ["$10", "per 1M tokens"],
                ["4+", "providers, one view"],
                ["<250ms", "live budget sync"],
              ].map(([stat, label]) => (
                <div key={label}>
                  <dt className="tnum gold-text font-mono text-2xl font-bold">{stat}</dt>
                  <dd className="mt-0.5 text-xs leading-snug text-subtle">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Product mockup */}
          <div className="reveal-on-scroll reveal-d2 relative lg:pl-4">
            <TreasuryMockup />
          </div>
        </div>
      </section>

      {/* ─── Live ledger ticker ───────────────────────────────────── */}
      <section aria-label="Example of the live token ledger" className="border-y border-border/60 bg-surface/30 py-3">
        <LedgerTicker />
      </section>

      {/* ─── Logos / trust strip ──────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-10">
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-subtle">
          Meters usage across the models your teams already use
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
          {["Anthropic", "OpenAI", "Google", "Mistral", "Custom / on-prem"].map((p) => (
            <span key={p} className="text-sm font-semibold tracking-tight text-muted">
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* ─── Bento feature grid ───────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="reveal-on-scroll mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            A treasury desk for your AI budget
          </h2>
          <p className="mt-4 text-pretty text-muted">
            Everything finance needs to fund, allocate, and account for AI usage — without
            chasing per-vendor dashboards or surprise invoices.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Large feature */}
          <BentoCard className="sm:col-span-2 lg:row-span-2 lg:flex lg:flex-col">
            <FeatureIcon><CoinsGlyph /></FeatureIcon>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">Tokens as currency</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              Fund a central treasury in USD and hold value in TOK. Allocate budgets to
              people, projects, and clients, then watch every spend settle against them in
              real time — a true ledger, not a monthly guess.
            </p>
            <div className="mt-6 lg:mt-auto">
              <AllocationViz />
            </div>
          </BentoCard>

          <BentoCard>
            <FeatureIcon><BoltGlyph /></FeatureIcon>
            <h3 className="mt-5 text-base font-semibold tracking-tight">Live multi-model metering</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Connect Anthropic, OpenAI, Google, or any OpenAI-compatible endpoint. The
              exact input + output tokens are deducted the instant a call returns.
            </p>
          </BentoCard>

          <BentoCard>
            <FeatureIcon><GaugeGlyph /></FeatureIcon>
            <h3 className="mt-5 text-base font-semibold tracking-tight">Dynamic budgeting</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Auto top-up from unallocated treasury when an account runs low, or fire a
              low-balance alert. Burn-rate projection tells you if a budget lasts the cycle.
            </p>
          </BentoCard>

          <BentoCard className="sm:col-span-2 lg:col-span-1">
            <FeatureIcon><UsersGlyph /></FeatureIcon>
            <h3 className="mt-5 text-base font-semibold tracking-tight">Roles &amp; approvals</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Admins run the treasury; members get a scoped view of just their projects.
              Budget-raise requests flow to admins and resolve — allocations included — live.
            </p>
          </BentoCard>
        </div>
      </section>

      {/* ─── Plans ────────────────────────────────────────────────── */}
      <section id="plans" className="mx-auto max-w-6xl px-5 py-20">
        <div className="reveal-on-scroll mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Two ways to use Tokeville
          </h2>
          <p className="mt-4 text-pretty text-muted">
            Pick the model that matches how your organization pays for AI.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {/* Managed */}
          <div className="reveal-on-scroll gold-border relative flex flex-col rounded-3xl border border-border bg-surface/70 p-7 backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">Managed</h3>
              <span className="rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 text-[11px] font-medium text-gold">
                Most popular
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              For teams with constant API bills. <strong className="text-foreground">Buy tokens from Tokeville</strong> and
              spend them across every model — all running on <strong className="text-foreground">Tokeville&apos;s own keys</strong>.
              No provider accounts, no API keys, nothing to set up. Budget across teams and meter every call in real time.
            </p>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="tnum gold-text font-mono text-3xl font-bold">Pay-as-you-go</span>
            </div>
            <p className="mt-1 text-xs text-subtle">A small platform fee per transaction — no subscription.</p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                "Buy tokens; they run on Tokeville's keys — nothing to configure",
                "One chat for Claude, GPT, Gemini & Mistral",
                "Per-team & per-project budgets with live metering",
                "Automatic top-ups and low-balance alerts",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-muted">
                  <CheckGlyph className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#waitlist"
              className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-gold-bright to-gold text-sm font-bold text-[#0a0a0b] shadow-[0_1px_12px_var(--gold-soft)] transition-all duration-200 hover:from-gold hover:to-gold-deep"
            >
              Join the waiting list
            </a>
          </div>

          {/* Institutional — bring your own keys */}
          <div className="reveal-on-scroll relative flex flex-col rounded-3xl border border-border bg-surface/60 p-7 backdrop-blur">
            <h3 className="text-lg font-semibold tracking-tight">Institutional</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              <strong className="text-foreground">Bring your own API keys.</strong> Your keys pay your providers
              directly — Tokeville sits on top to budget, meter, and govern. Chat runs on your keys and each call is
              logged as spend against a department, so you keep full control and one clean view of it all.
            </p>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="tnum gold-text font-mono text-3xl font-bold">From $49</span>
              <span className="text-sm text-subtle">/ month</span>
            </div>
            <p className="mt-1 text-xs text-subtle">Per-seat plans — billing scales with your active users, not departments.</p>

            {/* Per-seat tiers */}
            <div className="mt-4 divide-y divide-border/60 rounded-xl border border-border bg-background/40">
              {INSTITUTIONAL_TIERS.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-3.5 py-2">
                  <span className="text-sm">
                    <span className="font-semibold">{t.label}</span>
                    <span className="ml-2 text-xs text-subtle">
                      {t.seatLimit != null ? `up to ${t.seatLimit} active users` : "100+ users, contact us"}
                    </span>
                  </span>
                  <span className="tnum font-mono text-sm font-semibold text-gold">
                    {t.priceUsd != null ? <>${t.priceUsd}<span className="text-[11px] font-normal text-subtle">/mo</span></> : "Custom"}
                  </span>
                </div>
              ))}
            </div>

            <ul className="mt-5 space-y-2 text-sm">
              {[
                "Bring your own Anthropic, OpenAI, Google or Mistral keys",
                "Metered chat on your keys — logged in USD by department",
                "Delegate a key to a department; monthly budgets + 80% alerts",
                "Log other spend manually or import via CSV — one console",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-muted">
                  <CheckGlyph className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#waitlist"
              className="mt-7 inline-flex h-11 items-center justify-center rounded-xl border border-border-strong bg-surface px-6 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-gold/40 hover:text-gold"
            >
              Join the waiting list
            </a>
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <div className="reveal-on-scroll mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            From dollars to deployed, in three moves
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Fund the treasury",
              d: "Deposit via Stripe. Funds mint into TOK at a fixed treasury rate and land in your wallet instantly.",
            },
            {
              n: "02",
              t: "Allocate budgets",
              d: "Split the treasury into sub-accounts for teams, projects, or clients. Set top-up rules and alerts.",
            },
            {
              n: "03",
              t: "Meter every call",
              d: "Route AI through one interface. Each request burns the exact token cost and logs to the ledger.",
            },
          ].map((s, i) => (
            <div
              key={s.n}
              className={`reveal-on-scroll reveal-d${i + 1} relative rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur`}
            >
              <span className="tnum gold-text font-mono text-sm font-bold">{s.n}</span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
              {i < 2 && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-border-strong md:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Security band ────────────────────────────────────────── */}
      <section id="security" className="mx-auto max-w-6xl px-5 py-20">
        <div className="reveal-on-scroll gold-border relative overflow-hidden rounded-3xl border border-border bg-surface/70 p-8 backdrop-blur sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-gold">
                <ShieldGlyph className="h-3.5 w-3.5" />
                Built for institutions
              </div>
              <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight">
                Enterprise controls, on by default
              </h2>
              <p className="mt-4 text-pretty text-muted">
                Row-level security isolates every workspace. Provider keys are encrypted at
                rest, AI runs server-side so credentials never reach the browser, and
                two-factor authentication locks down every sign-in.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                ["Two-factor auth", "TOTP enrollment for every account"],
                ["Encrypted keys", "AES-256-GCM at rest, never client-side"],
                ["Row-level security", "Workspace isolation enforced in Postgres"],
                ["Full audit ledger", "Every token movement, permanently logged"],
              ].map(([t, d]) => (
                <li
                  key={t}
                  className="rounded-xl border border-border bg-background/50 p-4"
                >
                  <div className="flex items-center gap-2">
                    <CheckGlyph className="h-4 w-4 text-gold" />
                    <p className="text-sm font-semibold">{t}</p>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-subtle">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Final CTA — waiting list ─────────────────────────────── */}
      <section id="waitlist" className="mx-auto max-w-4xl scroll-mt-24 px-5 pb-24 pt-6">
        <div className="reveal-on-scroll relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-b from-surface to-background p-8 text-center sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-[36rem] max-w-full rounded-full"
            style={{ background: "radial-gradient(closest-side, var(--gold-soft), transparent)" }}
          />
          <TokevilleMark className="mx-auto h-11 w-11" />
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-soft px-3 py-1 text-[11px] font-medium text-gold">
            Invite-only · currently in private access
          </span>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Join the Tokeville waiting list
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-muted">
            We&apos;re onboarding teams in small batches. Leave your email and we&apos;ll reach out the
            moment your spot is ready.
          </p>
          <div className="mx-auto mt-8 max-w-md">
            <WaitlistForm />
          </div>
          <p className="mt-5 text-center text-xs text-subtle">
            Already have access?{" "}
            <Link href="/login" className="font-medium text-gold transition-colors hover:text-gold-bright">Sign in</Link>
          </p>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <TokevilleMark className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-tight">Tokeville</span>
            <span className="text-xs text-subtle">· AI tokens as currency</span>
          </div>
          <nav className="flex items-center gap-6 text-xs text-muted">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#plans" className="transition-colors hover:text-foreground">Plans</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
            <Link href="/login" className="transition-colors hover:text-gold">Sign in</Link>
          </nav>
          <p className="text-xs text-subtle">
            Built for teams managing multi-model AI spend.
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ───────────────────────── Background ───────────────────────── */

function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(720px 360px at 50% -80px, var(--gold-soft), transparent 70%), radial-gradient(520px 520px at 88% 8%, rgba(232,184,95,0.05), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--gold) 1px, transparent 1px), linear-gradient(90deg, var(--gold) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(900px 600px at 50% 0%, #000 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(900px 600px at 50% 0%, #000 30%, transparent 75%)",
        }}
      />
    </>
  );
}

/* ───────────────────────── Ledger ticker ────────────────────── */

const TICKER_ENTRIES: Array<{ label: string; amount: string; spend: boolean }> = [
  { label: "Engineering · Claude Opus 4.8", amount: "−Ŧ8,420", spend: true },
  { label: "Deposit · Stripe ••4242", amount: "+Ŧ500M", spend: false },
  { label: "Growth Team · GPT-5.1", amount: "−Ŧ5,120", spend: true },
  { label: "Auto top-up · Design", amount: "+Ŧ40M", spend: false },
  { label: "Acme Corp · Gemini 2.5 Pro", amount: "−Ŧ3,300", spend: true },
  { label: "Allocated · Sasha Kim", amount: "+Ŧ120M", spend: false },
  { label: "Research · Claude Sonnet 4.6", amount: "−Ŧ1,284", spend: true },
  { label: "Budget raise approved · Growth", amount: "+Ŧ60M", spend: false },
];

function LedgerTicker() {
  // The list is rendered twice so the -50% translate loops seamlessly.
  const row = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {TICKER_ENTRIES.map((e) => (
        <span key={e.label} className="flex items-center gap-2.5 px-6 text-xs whitespace-nowrap">
          <span className={`h-1.5 w-1.5 rounded-full ${e.spend ? "bg-gold" : "bg-positive"}`} />
          <span className="text-muted">{e.label}</span>
          <span className={`tnum font-mono font-semibold ${e.spend ? "text-foreground" : "text-positive"}`}>
            {e.amount}
          </span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="ticker-mask">
      <div className="ticker-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/* ───────────────────────── Product mockup ───────────────────── */

function TreasuryMockup() {
  // Hand-rolled sparkline (matches the app's dependency-free SVG charts).
  const pts = [18, 22, 19, 28, 25, 34, 31, 42, 38, 49, 46, 58];
  const w = 260;
  const h = 56;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * (h - 6) - 3;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="gold-border relative rounded-3xl border border-border bg-surface/80 p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1">
      <div className="gold-edge rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TokevilleMark className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-tight">Treasury</span>
          </div>
          <span className="rounded-full border border-positive/30 bg-positive-soft px-2 py-0.5 text-[10px] font-semibold text-positive">
            +12.4% · 24h
          </span>
        </div>

        {/* Balance */}
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wide text-subtle">Treasury balance</p>
          <p className="tnum mt-1 font-mono text-3xl font-bold">
            <span className="gold-text">Ŧ</span> 4,820,000
          </p>
          <p className="tnum mt-0.5 text-xs text-muted">≈ $48,200.00 USD</p>
        </div>

        {/* Sparkline */}
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L${w},${h} L0,${h} Z`} fill="url(#spark-fill)" />
          <path className="spark-draw" d={path} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Sub-account rows */}
        <div className="mt-4 space-y-2.5">
          {[
            ["Engineering", "#e08a63", 72],
            ["Research", "#6c9bff", 48],
            ["Growth", "#2bbd95", 34],
          ].map(([name, color, pct]) => (
            <div key={name as string} className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color as string }} />
              <span className="w-24 shrink-0 text-xs text-muted">{name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: color as string }}
                />
              </div>
              <span className="tnum w-9 shrink-0 text-right font-mono text-[11px] text-subtle">{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating activity chip */}
      <div className="absolute -bottom-5 -left-5 hidden items-center gap-2.5 rounded-xl border border-border bg-elevated/90 px-3.5 py-2.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold-soft">
          <BoltGlyph className="h-3.5 w-3.5 text-gold" />
        </span>
        <div>
          <p className="text-[11px] font-medium leading-tight">Chat · Claude Sonnet</p>
          <p className="tnum text-[11px] leading-tight text-subtle">−Ŧ 1,284 metered</p>
        </div>
      </div>
    </div>
  );
}

function AllocationViz() {
  return (
    <div className="rounded-2xl border border-border bg-background/50 p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-subtle">Allocated</p>
          <p className="tnum font-mono text-lg font-semibold">
            <span className="gold-text">Ŧ</span> 3.6M <span className="text-xs font-normal text-subtle">/ 4.8M</span>
          </p>
        </div>
        <span className="tnum rounded-md bg-gold-soft px-2 py-0.5 font-mono text-xs font-semibold text-gold">75%</span>
      </div>
      <div className="mt-3 flex h-2.5 gap-1 overflow-hidden rounded-full">
        <span className="h-full" style={{ width: "38%", background: "var(--anthropic)" }} />
        <span className="h-full" style={{ width: "25%", background: "var(--google)" }} />
        <span className="h-full" style={{ width: "12%", background: "var(--openai)" }} />
        <span className="h-full flex-1 bg-surface-2" />
      </div>
    </div>
  );
}

/* ───────────────────────── Bento primitives ─────────────────── */

function BentoCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`reveal-on-scroll group relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur hover:border-gold/30 ${className}`}
    >
      {children}
    </div>
  );
}

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold-soft text-gold">
      {children}
    </span>
  );
}

/* ───────────────────────── SVG icons (no emoji) ─────────────── */

function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CoinsGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <ellipse cx="9" cy="7" rx="6" ry="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 7v5c0 1.66 2.69 3 6 3s6-1.34 6-3V7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5c0-1.66-2.69-3-6-3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BoltGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function GaugeGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M4 18a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 18l4-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="18" r="1.4" fill="currentColor" />
    </svg>
  );
}

function UsersGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 19a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6M17 19a6 6 0 0 0-2.4-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ShieldGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 12l2.5 2.5L15.5 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
