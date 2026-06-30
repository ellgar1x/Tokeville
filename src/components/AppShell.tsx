"use client";

import { DemoProvider, useDemo } from "@/store/demo";
import type { DashboardData } from "@/lib/data";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ModalManager } from "./Modals";
import { Toaster } from "./Toaster";
import { ThemeProvider } from "./ThemeProvider";

export function AppShell({
  initial,
  userId,
  workspaceId,
  children,
}: {
  initial: DashboardData;
  userId: string;
  workspaceId: string;
  children: React.ReactNode;
}) {
  return (
    <DemoProvider initial={initial} userId={userId} workspaceId={workspaceId}>
      <ThemedShell initial={initial}>{children}</ThemedShell>
    </DemoProvider>
  );
}

function ThemedShell({ initial, children }: { initial: DashboardData; children: React.ReactNode }) {
  const { state } = useDemo();
  // Use live workspace colors from the store (updated when user changes them in Settings)
  const primaryColor = state.workspace.primaryColor ?? initial.workspace.primaryColor;
  const secondaryColor = state.workspace.secondaryColor ?? initial.workspace.secondaryColor;

  return (
    <ThemeProvider primaryColor={primaryColor} secondaryColor={secondaryColor}>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-6 py-6 sm:px-10 sm:py-8">
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
      <ModalManager />
      <Toaster />
    </ThemeProvider>
  );
}
