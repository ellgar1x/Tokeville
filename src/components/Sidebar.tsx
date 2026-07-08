"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemo } from "@/store/demo";
import { tok } from "@/lib/format";
import { CoinsIcon, SettingsIcon, ShieldIcon, TokevilleMark } from "./icons";
import { NAV_ITEMS } from "./navItems";
import { isSuperAdmin } from "@/lib/superAdmin";

export function Sidebar() {
  const { state, unallocated } = useDemo();
  const pathname = usePathname();
  const superAdmin = isSuperAdmin(state.profile.email);
  const initials = (state.profile.displayName || state.profile.email || "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <TokevilleMark className="h-7 w-7" />
        <span className="font-semibold tracking-tight text-[15px]">Tokeville</span>
      </div>

      <nav className="flex-1 px-3 py-4">
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
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 cursor-pointer ${
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
          {superAdmin && (
            <li>
              <Link
                href="/admin"
                aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 cursor-pointer ${
                  pathname.startsWith("/admin")
                    ? "bg-gold-soft text-gold font-medium"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <ShieldIcon className="h-[18px] w-[18px]" />
                Console
              </Link>
            </li>
          )}
        </ul>
      </nav>

      <div className="px-3 pb-3">
        <div className="rounded-xl border border-border bg-surface-2 p-3">
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
      </div>

      <div className="px-3 pb-4">
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 cursor-pointer ${
            pathname.startsWith("/settings")
              ? "bg-gold-soft text-gold font-medium"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          <SettingsIcon className="h-[18px] w-[18px]" />
          Settings
        </Link>
        <Link
          href="/settings"
          className="mt-2 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors duration-200 hover:bg-surface-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-bright to-gold-deep text-[11px] font-semibold text-[#0a0a0b]">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">
              {state.profile.displayName || "Account"}
            </p>
            <p className="truncate text-xs text-subtle leading-tight">
              {state.profile.orgName}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
