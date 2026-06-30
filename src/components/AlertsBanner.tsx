"use client";

import { useDemo } from "@/store/demo";
import { AlertTriangleIcon, CheckIcon, CloseIcon, MailIcon } from "./icons";

export function AlertsBanner() {
  const { state, dismissAlert } = useDemo();
  const alerts = state.alerts.filter((a) => !a.read);
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const low = a.type === "low_balance";
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              low
                ? "border-warning/30 bg-warning-soft"
                : "border-positive/30 bg-positive-soft"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                low ? "bg-warning/15 text-warning" : "bg-positive/15 text-positive"
              }`}
            >
              {low ? (
                <AlertTriangleIcon className="h-4 w-4" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted">{a.detail}</p>
              {a.emailSent && a.emailTo && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-subtle">
                  <MailIcon className="h-3 w-3" />
                  Email sent to {a.emailTo}
                </p>
              )}
            </div>
            <span className="shrink-0 text-[11px] text-subtle">{a.time}</span>
            <button
              type="button"
              onClick={() => dismissAlert(a.id)}
              aria-label="Dismiss alert"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-subtle transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
