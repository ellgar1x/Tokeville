"use client";

import { useEffect } from "react";
import { useDemo } from "@/store/demo";
import { CheckIcon, CloseIcon } from "./icons";

interface ToastData {
  id: string;
  title: string;
  detail: string;
  tone: "gold" | "positive" | "danger";
}

/** Presentational toast stack — used by both the admin and member shells. */
export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.slice(0, 4).map((t) => (
        <Toast key={t.id} {...t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

export function Toaster() {
  const { state, dismissToast } = useDemo();
  return <ToastStack toasts={state.toasts} onDismiss={dismissToast} />;
}

function Toast({
  id,
  title,
  detail,
  tone,
  onDismiss,
}: {
  id: string;
  title: string;
  detail: string;
  tone: "gold" | "positive" | "danger";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toneClass =
    tone === "gold"
      ? "bg-gold-soft text-gold"
      : tone === "danger"
        ? "bg-danger-soft text-danger"
        : "bg-positive-soft text-positive";

  return (
    <div className="anim-toast pointer-events-auto flex items-start gap-3 rounded-xl border border-border-strong bg-elevated p-3.5 shadow-2xl">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
      >
        <CheckIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-subtle">{detail}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-6 w-6 items-center justify-center rounded-md text-subtle transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
