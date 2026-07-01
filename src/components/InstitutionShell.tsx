"use client";

import { InstitutionProvider, useInstitution } from "@/store/institution";
import type { InstitutionData } from "@/lib/data";
import { ToastStack } from "./Toaster";
import { TokevilleMark } from "./icons";
import { ThemeProvider, ThemeToggle } from "./ThemeProvider";

export function InstitutionShell({
  initial,
  userId,
  children,
}: {
  initial: InstitutionData;
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <InstitutionProvider initial={initial} userId={userId}>
      <ThemedInstitutionShell>{children}</ThemedInstitutionShell>
    </InstitutionProvider>
  );
}

function ThemedInstitutionShell({ children }: { children: React.ReactNode }) {
  const { state } = useInstitution();
  return (
    <ThemeProvider
      primaryColor={state.primaryColor ?? "#e8b85f"}
      secondaryColor={state.secondaryColor ?? "#c79a45"}
    >
      <div className="flex min-h-screen flex-col">
        <InstitutionHeader />
        <AlertsBanner />
        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
      <InstitutionToaster />
    </ThemeProvider>
  );
}

function InstitutionHeader() {
  const { state, signOut } = useInstitution();
  const initials = (state.profile.displayName || state.profile.email || "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-5 backdrop-blur-md sm:px-8">
      <TokevilleMark className="h-7 w-7" />
      <span className="font-semibold tracking-tight">Tokeville</span>
      <span className="rounded-full border border-gold/30 bg-gold-soft px-2 py-0.5 text-[11px] font-medium text-gold">
        Institution
      </span>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">
            {state.profile.displayName || "Admin"}
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

function AlertsBanner() {
  const { state, markAlertsRead } = useInstitution();
  const unread = state.alerts.filter((a) => !a.read);
  if (unread.length === 0) return null;

  return (
    <div className="border-b border-warning/30 bg-warning-soft">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 sm:px-8">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning">
          <WarnIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-warning">
            {unread.length === 1
              ? unread[0].title
              : `${unread.length} departments are near or over budget`}
          </p>
          <p className="truncate text-xs text-muted">
            {unread.length === 1
              ? `${unread[0].detail} · emailed ${unread[0].emailTo || "the admin"}`
              : unread.map((a) => a.title.split(" is at")[0]).join(", ")}
          </p>
        </div>
        <button
          onClick={() => markAlertsRead()}
          className="shrink-0 rounded-lg border border-warning/40 px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/10 cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function InstitutionToaster() {
  const { state, dismissToast } = useInstitution();
  return <ToastStack toasts={state.toasts} onDismiss={dismissToast} />;
}

function WarnIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M8 1.5 15 14H1L8 1.5Z" />
      <path d="M8 6.5v3.5" />
      <circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
