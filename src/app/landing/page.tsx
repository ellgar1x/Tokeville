import Link from "next/link";
import { TokevilleMark } from "@/components/icons";

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0b] px-5 py-16 text-[#f0ece4]">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(800px 400px at 50% -60px, rgba(232,184,95,0.10), transparent 70%), radial-gradient(400px 400px at 80% 80%, rgba(232,184,95,0.04), transparent 70%)",
        }}
      />

      {/* Grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(232,184,95,1) 1px, transparent 1px), linear-gradient(90deg, rgba(232,184,95,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-3">
          <TokevilleMark className="h-10 w-10" />
          <span className="text-lg font-semibold tracking-tight text-[#e8b85f]">
            Tokeville
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          AI spend,{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #e8b85f, #c79a45)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            under control
          </span>
        </h1>

        <p className="mt-4 max-w-lg text-base text-[#a09880] sm:text-lg">
          Tokeville turns AI tokens into real currency — fund a treasury, set
          budgets per team or project, and meter every model call in real time.
        </p>

        {/* Feature bullets */}
        <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-[#2a2618] bg-[#111008] p-5 text-left"
            >
              <div className="mb-3 text-2xl">{f.icon}</div>
              <p className="text-sm font-semibold text-[#f0ece4]">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#7a7060]">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-[#f0c96a] to-[#c79a45] px-8 text-sm font-bold text-[#0a0a0b] shadow-[0_2px_20px_rgba(232,184,95,0.30)] transition-all duration-200 hover:shadow-[0_2px_28px_rgba(232,184,95,0.45)] hover:from-[#f5d47a] hover:to-[#d4a84e]"
          >
            Get started →
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-xl border border-[#2a2618] bg-[#111008] px-8 text-sm font-medium text-[#a09880] transition-colors hover:border-[#e8b85f]/30 hover:text-[#e8b85f]"
          >
            Sign in
          </Link>
        </div>

        {/* Footer note */}
        <p className="mt-10 text-xs text-[#4a4438]">
          Built for finance teams, agencies, and enterprises managing multi-model AI budgets.
        </p>
      </div>
    </main>
  );
}

const FEATURES = [
  {
    icon: "Ŧ",
    title: "Tokens as currency",
    body: "Fund a central treasury in USD, allocate TOK budgets to teams and projects, and track every spend in real time.",
  },
  {
    icon: "⚡",
    title: "Multi-model metering",
    body: "Connect Anthropic, OpenAI, Google, or any OpenAI-compatible provider. Every token deducted automatically.",
  },
  {
    icon: "🔒",
    title: "Enterprise controls",
    body: "Role-based access, budget alerts, auto top-up rules, and two-factor authentication out of the box.",
  },
];
