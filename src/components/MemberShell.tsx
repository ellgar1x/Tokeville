"use client";

import { useState } from "react";
import { MemberProvider, useMember } from "@/store/member";
import type { MemberData } from "@/lib/data";
import { ToastStack } from "./Toaster";
import { TokevilleMark, ChatIcon, CoinsIcon, ActivityIcon } from "./icons";
import { ThemeProvider, ThemeToggle } from "./ThemeProvider";

export function MemberShell({
  initial,
  userId,
  workspaceId,
  children,
}: {
  initial: MemberData;
  userId: string;
  workspaceId: string;
  children: React.ReactNode;
}) {
  return (
    <MemberProvider initial={initial} userId={userId} workspaceId={workspaceId}>
      <ThemedMemberShell>{children}</ThemedMemberShell>
    </MemberProvider>
  );
}

function ThemedMemberShell({ children }: { children: React.ReactNode }) {
  const { state } = useMember();
  return (
    <ThemeProvider primaryColor={state.primaryColor} secondaryColor={state.secondaryColor}>
      <div className="flex min-h-screen flex-col">
        <MemberHeader />
        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
          <div className="w-full">{children}</div>
        </main>
      </div>
      <MemberToaster />
    </ThemeProvider>
  );
}

export type MemberTab = "overview" | "chat" | "activity";

const TABS: { id: MemberTab; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
  { id: "overview", label: "Overview", Icon: CoinsIcon },
  { id: "chat", label: "Chat", Icon: ChatIcon },
  { id: "activity", label: "Activity", Icon: ActivityIcon },
];

export function useMemberTab() {
  return useState<MemberTab>("overview");
}

export function MemberTabBar({
  active,
  onChange,
}: {
  active: MemberTab;
  onChange: (t: MemberTab) => void;
}) {
  return (
    <nav className="flex gap-1 rounded-xl border border-border bg-surface-2 p-1">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer ${
            active === id
              ? "bg-surface text-foreground shadow-sm border border-border"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </nav>
  );
}

function MemberHeader() {
  const { state, signOut } = useMember();
  const initials = (state.profile.displayName || state.profile.email || "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-5 backdrop-blur-md sm:px-8">
      <TokevilleMark className="h-7 w-7" />
      <span className="font-semibold tracking-tight">Tokeville</span>
      <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
        Member
      </span>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">
            {state.profile.displayName || "Member"}
          </p>
          <p className="text-xs text-subtle leading-tight">{state.workspaceName}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold-bright to-gold-deep text-[11px] font-semibold text-[#0a0a0b]">
          {initials}
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="h-9 rounded-lg border border-border-strong bg-surface-2 px-3 text-sm font-medium text-muted transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

function MemberToaster() {
  const { state, dismissToast } = useMember();
  return <ToastStack toasts={state.toasts} onDismiss={dismissToast} />;
}
