"use client";

import { useState } from "react";
import { useDemo } from "@/store/demo";
import { usd, USD_PER_MILLION_TOKENS } from "@/lib/format";
import { AIProviderSettings } from "@/components/AIProviderSettings";
import { TwoFactorSettings } from "@/components/TwoFactorSettings";

const PRESET_PALETTES = [
  { label: "Gold (default)", primary: "#e8b85f", secondary: "#c79a45" },
  { label: "Midnight Blue", primary: "#3b82f6", secondary: "#1d4ed8" },
  { label: "Emerald", primary: "#10b981", secondary: "#059669" },
  { label: "Violet", primary: "#8b5cf6", secondary: "#6d28d9" },
  { label: "Rose", primary: "#f43f5e", secondary: "#be123c" },
  { label: "Amber", primary: "#f59e0b", secondary: "#b45309" },
  { label: "Cyan", primary: "#06b6d4", secondary: "#0e7490" },
  { label: "Slate", primary: "#64748b", secondary: "#334155" },
];

export default function SettingsPage() {
  const { state, updateProfile, updateWorkspaceColors, resetData, signOut } = useDemo();
  const [displayName, setDisplayName] = useState(state.profile.displayName);
  const [orgName, setOrgName] = useState(state.profile.orgName);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [primaryColor, setPrimaryColor] = useState(state.workspace.primaryColor ?? "#e8b85f");
  const [secondaryColor, setSecondaryColor] = useState(state.workspace.secondaryColor ?? "#c79a45");
  const [savingColors, setSavingColors] = useState(false);

  const dirty =
    displayName !== state.profile.displayName || orgName !== state.profile.orgName;

  const colorsDirty =
    primaryColor !== (state.workspace.primaryColor ?? "#e8b85f") ||
    secondaryColor !== (state.workspace.secondaryColor ?? "#c79a45");

  const inputClass =
    "h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

  async function save() {
    setSaving(true);
    await updateProfile({ displayName, orgName });
    setSaving(false);
  }

  async function saveColors() {
    setSavingColors(true);
    await updateWorkspaceColors({ primaryColor, secondaryColor });
    setSavingColors(false);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
        <h2 className="text-sm font-semibold tracking-tight">Profile</h2>
        <p className="mt-0.5 text-xs text-subtle">
          Your name and workspace, shown across Tokeville
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Workspace</label>
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Email</label>
            <input value={state.profile.email} disabled className={`${inputClass} cursor-not-allowed text-subtle`} />
          </div>
        </div>
        <button onClick={save} disabled={!dirty || saving}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-5 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none cursor-pointer">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </section>

      {/* Workspace theme */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
        <h2 className="text-sm font-semibold tracking-tight">Workspace theme</h2>
        <p className="mt-0.5 text-xs text-subtle">
          Customize your accent colors. Changes apply live across the whole workspace.
        </p>

        {/* Preset swatches */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-subtle">Presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_PALETTES.map((p) => (
              <button
                key={p.label}
                title={p.label}
                onClick={() => { setPrimaryColor(p.primary); setSecondaryColor(p.secondary); }}
                className={`group relative h-8 w-8 rounded-full border-2 transition-all duration-150 cursor-pointer ${
                  primaryColor === p.primary ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                }`}
                style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}
              >
                <span className="sr-only">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom pickers */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-subtle">Primary color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-lg border border-border-strong bg-surface p-0.5"
              />
              <input
                value={primaryColor}
                onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setPrimaryColor(e.target.value); }}
                className="h-10 flex-1 rounded-lg border border-border-strong bg-surface px-3 font-mono text-sm outline-none focus:border-gold/50"
                maxLength={7}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-subtle">Secondary color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-lg border border-border-strong bg-surface p-0.5"
              />
              <input
                value={secondaryColor}
                onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setSecondaryColor(e.target.value); }}
                className="h-10 flex-1 rounded-lg border border-border-strong bg-surface px-3 font-mono text-sm outline-none focus:border-gold/50"
                maxLength={7}
              />
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
          <div
            className="h-9 w-9 rounded-full"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
          />
          <div>
            <p className="text-sm font-semibold" style={{ color: primaryColor }}>
              {state.profile.orgName || "Your Workspace"}
            </p>
            <p className="text-xs text-subtle">Live preview of accent color</p>
          </div>
          <button
            className="ml-auto h-8 rounded-lg px-4 text-xs font-semibold text-[#0a0a0b] cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
          >
            Button
          </button>
        </div>

        <button onClick={saveColors} disabled={!colorsDirty || savingColors}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-5 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none cursor-pointer">
          {savingColors ? "Saving…" : "Apply theme"}
        </button>
      </section>

      {/* Treasury */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
        <h2 className="text-sm font-semibold tracking-tight">Treasury</h2>
        <dl className="mt-4 divide-y divide-border text-sm">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">Base currency</dt>
            <dd className="font-medium">TOK · Tokeville Token (Ŧ)</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">Exchange rate</dt>
            <dd className="tnum font-mono">{usd(USD_PER_MILLION_TOKENS, { cents: true })} / 1M TOK</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">Connected providers</dt>
            <dd className="font-medium">{state.providers.length}</dd>
          </div>
        </dl>
      </section>

      {/* AI Providers */}
      <AIProviderSettings />

      {/* Security / 2FA */}
      <TwoFactorSettings />

      {/* Danger zone */}
      <section className="rounded-2xl border border-danger/25 bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
        <h2 className="text-sm font-semibold tracking-tight text-danger">Danger zone</h2>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Reset demo data</p>
              <p className="text-xs text-subtle">Restore the treasury, accounts, and ledger to their seeded state</p>
            </div>
            <button onClick={async () => { setResetting(true); await resetData(); }} disabled={resetting}
              className="h-9 rounded-lg border border-border-strong bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors duration-200 hover:border-danger/40 hover:text-danger disabled:opacity-50 cursor-pointer">
              {resetting ? "Resetting…" : "Reset data"}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-subtle">End your session on this device</p>
            </div>
            <button onClick={() => signOut()}
              className="h-9 rounded-lg border border-border-strong bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer">
              Sign out
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
