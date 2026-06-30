"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useDemo } from "@/store/demo";
import { type AccountType } from "@/lib/data";
import {
  CURRENCIES,
  tok,
  tokensFromCurrency,
  usd,
  usdFromTokens,
  USD_PER_MILLION_TOKENS,
} from "@/lib/format";
import { CloseIcon, CoinsIcon, PlusIcon, SendIcon, ShieldIcon } from "./icons";

/* ---------- Shared primitives ---------- */

function ModalShell({
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { closeModal } = useDemo();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  return (
    <div
      className="anim-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={closeModal}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="anim-modal w-full max-w-md rounded-t-2xl border border-border-strong bg-elevated shadow-2xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold-soft text-gold">
            {icon}
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <p className="text-xs text-subtle">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        <div className="flex gap-3 border-t border-border px-6 py-4">{footer}</div>
      </div>
    </div>
  );
}

function fieldLabel(text: string, htmlFor: string) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle"
    >
      {text}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

const chipClass =
  "rounded-lg border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer";

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium text-muted transition-colors duration-200 hover:text-foreground cursor-pointer"
    >
      {children}
    </button>
  );
}

/* ---------- Buy TOK ---------- */

function BuyForm() {
  const { closeModal } = useDemo();
  const id = useId();
  const [amount, setAmount] = useState("100");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const units = Math.max(parseFloat(amount) || 0, 0);
  const dollars = units * currency.usdPerUnit;
  const tokens = tokensFromCurrency(units, currency);
  const valid = units >= 1 && dollars <= 10_000;

  async function handleCheckout() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: Math.round(dollars * 100) / 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <ModalShell
      title="Buy TOK"
      subtitle="Fund the treasury with a real Stripe payment"
      icon={<PlusIcon className="h-5 w-5" />}
      footer={
        <>
          <GhostButton onClick={closeModal}>Cancel</GhostButton>
          <PrimaryButton disabled={!valid || loading} onClick={handleCheckout}>
            {loading ? "Redirecting…" : `Pay ${usd(dollars, { cents: true })} →`}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex gap-2">
        <div className="flex-1">
          {fieldLabel("Amount to fund", `${id}-amt`)}
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
              {currency.symbol}
            </span>
            <input
              id={`${id}-amt`}
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setErr(null); }}
              className={`${inputClass} tnum font-mono ${currency.symbol.length > 1 ? "pl-12" : "pl-7"}`}
            />
          </div>
        </div>
        <div className="w-28">
          {fieldLabel("Currency", `${id}-cur`)}
          <select
            id={`${id}-cur`}
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value)}
            className={`${inputClass} cursor-pointer px-2`}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        {[10, 50, 100, 250].map((v) => (
          <button key={v} className={chipClass} onClick={() => { setAmount(String(v)); setErr(null); }}>
            {currency.symbol}{v.toLocaleString("en-US")}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-gold/20 bg-gold-soft p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">You receive</span>
          <span className="tnum gold-text font-mono text-lg font-semibold">{tok(tokens)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-subtle">
          <span>{currency.code !== "USD" ? `${currency.code} → USD → TOK` : "USD → TOK"}</span>
          <span className="tnum">
            {currency.code !== "USD" ? `${usd(dollars, { cents: true })} · ` : ""}
            1M TOK = {usd(USD_PER_MILLION_TOKENS, { cents: true })}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-xs text-muted">
        <StripeLockIcon />
        <span>Secured by Stripe · test mode · use card <span className="tnum font-mono text-foreground">4242 4242 4242 4242</span></span>
      </div>

      {err && (
        <p className="mt-3 text-xs font-medium text-danger">{err}</p>
      )}
    </ModalShell>
  );
}

function StripeLockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-muted">
      <path d="M4 6V4a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
    </svg>
  );
}

/* ---------- Allocate ---------- */

function AllocateForm({ presetAccountId }: { presetAccountId?: string }) {
  const { state, unallocated, allocate, closeModal } = useDemo();
  const id = useId();
  const [accountId, setAccountId] = useState(
    presetAccountId ?? state.accounts[0]?.id ?? "",
  );
  const [millions, setMillions] = useState("50");
  const tokens = Math.max((parseFloat(millions) || 0) * 1_000_000, 0);
  const over = tokens > unallocated;
  const valid = tokens > 0 && !over && accountId;
  const account = state.accounts.find((a) => a.id === accountId);

  return (
    <ModalShell
      title="Allocate tokens"
      subtitle="Move TOK from the treasury into a budget"
      icon={<SendIcon className="h-5 w-5" />}
      footer={
        <>
          <GhostButton onClick={closeModal}>Cancel</GhostButton>
          <PrimaryButton disabled={!valid} onClick={() => allocate(accountId, tokens)}>
            Allocate {tok(tokens)}
          </PrimaryButton>
        </>
      }
    >
      <div>
        {fieldLabel("Destination account", `${id}-acct`)}
        <select
          id={`${id}-acct`}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className={`${inputClass} cursor-pointer`}
        >
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.type}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        {fieldLabel("Amount (millions of TOK)", `${id}-amt`)}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-gold">
            Ŧ
          </span>
          <input
            id={`${id}-amt`}
            autoFocus
            inputMode="decimal"
            value={millions}
            onChange={(e) => setMillions(e.target.value.replace(/[^0-9.]/g, ""))}
            className={`${inputClass} pl-7 pr-10 tnum font-mono`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
            M
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[50, 100, 250].map((v) => (
            <button key={v} className={chipClass} onClick={() => setMillions(String(v))}>
              Ŧ{v}M
            </button>
          ))}
          <button
            className={chipClass}
            onClick={() => setMillions(String(Math.floor(unallocated / 1_000_000)))}
          >
            Max
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-1.5 rounded-xl border border-border bg-surface p-4 text-sm">
        <Row label="≈ USD value" value={usd(usdFromTokens(tokens), { cents: true })} />
        <Row label="Unallocated after" value={tok(unallocated - tokens)} />
        {account && (
          <Row
            label={`${account.name} budget after`}
            value={tok(account.tokenBudget + tokens)}
            gold
          />
        )}
      </div>
      {over && (
        <p className="mt-3 text-xs font-medium text-danger">
          Exceeds unallocated balance of {tok(unallocated)}. Buy more TOK or lower
          the amount.
        </p>
      )}
    </ModalShell>
  );
}

/* ---------- New account ---------- */

const TYPES: AccountType[] = ["Team", "Project", "Client", "Contractor"];

function NewAccountForm() {
  const { unallocated, createAccount, closeModal } = useDemo();
  const id = useId();
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("Team");
  const [owner, setOwner] = useState("");
  const [millions, setMillions] = useState("100");
  const tokens = Math.max((parseFloat(millions) || 0) * 1_000_000, 0);
  const over = tokens > unallocated;
  const valid = name.trim().length > 0 && tokens > 0 && !over;

  return (
    <ModalShell
      title="New sub-account"
      subtitle="Create a budget and allocate its first tokens"
      icon={<CoinsIcon className="h-5 w-5" />}
      footer={
        <>
          <GhostButton onClick={closeModal}>Cancel</GhostButton>
          <PrimaryButton
            disabled={!valid}
            onClick={() => createAccount({ name: name.trim(), accountType, owner: owner.trim(), tokens })}
          >
            Create account
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          {fieldLabel("Account name", `${id}-name`)}
          <input
            id={`${id}-name`}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Partnerships"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            {fieldLabel("Type", `${id}-type`)}
            <select
              id={`${id}-type`}
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className={`${inputClass} cursor-pointer`}
            >
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            {fieldLabel("Owner", `${id}-owner`)}
            <input
              id={`${id}-owner`}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          {fieldLabel("Initial budget (millions of TOK)", `${id}-amt`)}
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-gold">
              Ŧ
            </span>
            <input
              id={`${id}-amt`}
              inputMode="decimal"
              value={millions}
              onChange={(e) => setMillions(e.target.value.replace(/[^0-9.]/g, ""))}
              className={`${inputClass} pl-7 pr-10 tnum font-mono`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
              M
            </span>
          </div>
          <p className="mt-1.5 text-xs text-subtle">
            ≈ {usd(usdFromTokens(tokens), { cents: true })} · {tok(unallocated)}{" "}
            unallocated available
          </p>
          {over && (
            <p className="mt-1.5 text-xs font-medium text-danger">
              Exceeds unallocated balance.
            </p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`tnum font-mono font-medium ${gold ? "text-gold" : ""}`}>
        {value}
      </span>
    </div>
  );
}

/* ---------- Add company AI (admin only) ---------- */

const PROVIDER_COLORS = ["#818cf8", "#2dd4bf", "#f472b6", "#c084fc", "#fbbf24"];

function AddProviderForm() {
  const { createProvider, closeModal } = useDemo();
  const id = useId();
  const [name, setName] = useState("");
  const [models, setModels] = useState("");
  const [color, setColor] = useState(PROVIDER_COLORS[0]);
  const valid = name.trim().length > 0;

  return (
    <ModalShell
      title="Add company AI"
      subtitle="Register an internal / private model for your workspace"
      icon={<ShieldIcon className="h-5 w-5" />}
      footer={
        <>
          <GhostButton onClick={closeModal}>Cancel</GhostButton>
          <PrimaryButton
            disabled={!valid}
            onClick={() =>
              createProvider({
                name: name.trim(),
                models: models.trim() || "Internal · self-hosted",
                color,
              })
            }
          >
            Add to workspace
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          {fieldLabel("Model name", `${id}-name`)}
          <input
            id={`${id}-name`}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Northwind Secure LLM"
            className={inputClass}
          />
        </div>
        <div>
          {fieldLabel("Description / deployment", `${id}-models`)}
          <input
            id={`${id}-models`}
            value={models}
            onChange={(e) => setModels(e.target.value)}
            placeholder="e.g. On-prem · air-gapped · 70B"
            className={inputClass}
          />
        </div>
        <div>
          {fieldLabel("Accent color", `${id}-color`)}
          <div className="flex gap-2">
            {PROVIDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={`h-8 w-8 rounded-lg border-2 transition-transform duration-200 cursor-pointer ${
                  color === c ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3 text-xs text-muted">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>
            Usage on internal models is metered like any provider but stays inside
            your workspace — ideal for sensitive data that can’t leave the company.
          </span>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Manager ---------- */

export function ModalManager() {
  const { state } = useDemo();
  const modal = state.modal;
  if (!modal) return null;
  if (modal.type === "buy") return <BuyForm />;
  if (modal.type === "allocate") return <AllocateForm presetAccountId={modal.accountId} />;
  if (modal.type === "newAccount") return <NewAccountForm />;
  if (modal.type === "addProvider") return <AddProviderForm />;
  return null;
}
