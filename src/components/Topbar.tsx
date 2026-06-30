"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/store/demo";
import { tok, usd, USD_PER_MILLION_TOKENS } from "@/lib/format";
import {
  ArrowUpIcon,
  BellIcon,
  CoinsIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TokevilleMark,
} from "./icons";
import { ThemeToggle } from "./ThemeProvider";

const TITLES: Record<string, { title: string; sub: string }> = {
  "/": { title: "Treasury", sub: "June 2026 cycle · live balances" },
  "/spend": { title: "Spend", sub: "Token consumption by model & account" },
  "/sub-accounts": { title: "Sub-accounts", sub: "Budgets across teams, projects & clients" },
  "/activity": { title: "Activity", sub: "Your full token ledger" },
  "/exchange": { title: "Exchange", sub: "Buy, value & convert TOK" },
  "/cards": { title: "Cards & Keys", sub: "Virtual cards & API access" },
  "/settings": { title: "Settings", sub: "Profile & workspace" },
};

export function Topbar() {
  const { state, openModal, signOut } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [openPanel, setOpenPanel] = useState<"none" | "bell" | "profile">("none");

  const meta =
    TITLES[pathname] ??
    (pathname.startsWith("/settings") ? TITLES["/settings"] : TITLES["/"]);

  const initials = (state.profile.displayName || state.profile.email || "U")
    .slice(0, 2)
    .toUpperCase();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/sub-accounts?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-surface/80 px-5 backdrop-blur-md sm:px-8">
      <div className="flex items-center gap-2 lg:hidden">
        <TokevilleMark className="h-7 w-7" />
      </div>

      <div className="hidden flex-1 sm:block">
        <h1 className="text-[15px] font-semibold tracking-tight">{meta.title}</h1>
        <p className="text-xs text-subtle">{meta.sub}</p>
      </div>

      <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 xl:flex">
        <CoinsIcon className="h-4 w-4 text-gold" />
        <div className="leading-tight">
          <p className="tnum font-mono text-xs font-medium">
            1M Ŧ = {usd(USD_PER_MILLION_TOKENS, { cents: true })}
          </p>
          <p className="flex items-center gap-0.5 text-[10px] text-positive">
            <ArrowUpIcon className="h-2.5 w-2.5" /> 0.4% 24h
          </p>
        </div>
      </div>

      <form onSubmit={submitSearch} className="relative hidden md:block">
        <span className="sr-only">Search accounts</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search accounts"
          className="h-9 w-40 rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
        />
      </form>

      <ThemeToggle />

      {/* Notifications */}
      <div className="relative">
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setOpenPanel(openPanel === "bell" ? "none" : "bell")}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          <BellIcon className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gold ring-2 ring-surface" />
        </button>
        {openPanel === "bell" && (
          <Popover onClose={() => setOpenPanel("none")}>
            <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-subtle">
              Recent activity
            </p>
            <ul className="space-y-0.5">
              {state.activity.slice(0, 5).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-subtle">{a.time}</p>
                  </div>
                  <span
                    className={`tnum shrink-0 font-mono text-xs font-semibold ${a.type === "spend" ? "text-muted" : "text-gold"}`}
                  >
                    {a.tokens > 0 ? "+" : "−"}
                    {tok(Math.abs(a.tokens))}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/activity"
              onClick={() => setOpenPanel("none")}
              className="mt-1 block rounded-lg px-3 py-2 text-center text-xs font-medium text-gold hover:bg-surface-2"
            >
              View full ledger
            </Link>
          </Popover>
        )}
      </div>

      <button
        type="button"
        onClick={() => openModal({ type: "buy" })}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3.5 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
      >
        <PlusIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Buy TOK</span>
      </button>

      {/* Profile */}
      <div className="relative">
        <button
          type="button"
          aria-label="Account menu"
          onClick={() => setOpenPanel(openPanel === "profile" ? "none" : "profile")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold-bright to-gold-deep text-[11px] font-semibold text-[#0a0a0b] transition-transform duration-200 hover:brightness-105 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        >
          {initials}
        </button>
        {openPanel === "profile" && (
          <Popover onClose={() => setOpenPanel("none")}>
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium">
                {state.profile.displayName || "Account"}
              </p>
              <p className="truncate text-xs text-subtle">{state.profile.email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/settings"
              onClick={() => setOpenPanel("none")}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-danger cursor-pointer"
            >
              <SignOutIcon className="h-4 w-4" />
              Sign out
            </button>
          </Popover>
        )}
      </div>
    </header>
  );
}

function Popover({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div className="anim-toast absolute right-0 top-11 z-50 w-72 rounded-xl border border-border-strong bg-elevated p-1.5 shadow-2xl">
        {children}
      </div>
    </>
  );
}

function SignOutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
