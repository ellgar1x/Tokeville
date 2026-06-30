"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemo } from "@/store/demo";
import { tok } from "@/lib/format";
import { CoinsIcon, SettingsIcon, TokevilleMark } from "./icons";
import { NAV_ITEMS } from "./navItems";

export function MobileNav() {
  const { state, unallocated, signOut } = useDemo();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        <MenuIcon className="h-[18px] w-[18px]" />
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Scrim */}
          <button
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="anim-overlay absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <div className="anim-modal absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-border bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <Link href="/" className="flex items-center gap-2.5">
                <TokevilleMark className="h-7 w-7" />
                <span className="text-[15px] font-semibold tracking-tight">Tokeville</span>
              </Link>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer"
              >
                <CloseIcon className="h-[18px] w-[18px]" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-subtle">
                Workspace
              </p>
              <ul className="space-y-0.5">
                {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <li key={label}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ${
                          active
                            ? "bg-gold-soft text-gold font-medium"
                            : "text-muted hover:bg-surface-2 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">
                  <CoinsIcon className="h-3.5 w-3.5 text-gold" />
                  Unallocated
                </div>
                <p className="tnum mt-1 font-mono text-lg font-semibold text-gold">
                  {tok(unallocated)}
                </p>
                <p className="tnum text-[11px] text-subtle">
                  of {tok(state.wallet.balanceTokens)} balance
                </p>
              </div>
            </nav>

            <div className="border-t border-border px-3 py-3">
              <Link
                href="/settings"
                aria-current={pathname.startsWith("/settings") ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ${
                  pathname.startsWith("/settings")
                    ? "bg-gold-soft text-gold font-medium"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <SettingsIcon className="h-[18px] w-[18px]" />
                Settings
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-danger cursor-pointer"
              >
                <SignOutIcon className="h-[18px] w-[18px]" />
                Sign out
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SignOutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
