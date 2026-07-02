"use client";

import { useEffect, useState } from "react";
import { useDemo } from "@/store/demo";
import { ChatWorkspace } from "@/components/ChatWorkspace";

export default function ChatPage() {
  const { state, workspaceId } = useDemo();
  const [availableProviders, setAvailableProviders] = useState<string[]>(["anthropic"]);

  useEffect(() => {
    fetch("/api/provider-keys")
      .then((r) => r.json())
      .then((d) => {
        const providers: string[] = (d.keys ?? []).map((k: { provider: string }) => k.provider);
        if (!providers.includes("anthropic")) providers.push("anthropic");
        setAvailableProviders(providers);
      })
      .catch(() => setAvailableProviders(["anthropic"]));
  }, []);

  return (
    <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 120px)" }}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI Workspace</h1>
        <p className="mt-0.5 text-sm text-muted">
          All your AI providers in one place. Each conversation is saved locally and billed to its own budget.
        </p>
      </div>
      <ChatWorkspace
        accounts={state.accounts.map((a) => ({ id: a.id, name: a.name }))}
        availableProviders={availableProviders}
        storageKey={`admin-${workspaceId}`}
        allowPersonal
      />
    </div>
  );
}
