@AGENTS.md

# Tokeville

AI spend-management platform where **tokens are the currency**. Teams fund a central
treasury (buying TOK), allocate token budgets across people/projects/clients, and meter
real AI usage against those budgets — across providers, through one interface.

The core conceptual model: a Tokeville token (glyph **Ŧ**, ticker **TOK**) is the unit of
value you hold, allocate, and spend. US dollars are only a secondary reference, derived
from a treasury exchange rate. Aesthetic: premium **black & gold**, dependency-free SVG
charts, monospaced/tabular figures.

---

## Tech stack

- **Next.js 16** (App Router, `src/` dir, Turbopack). NOTE: this is a breaking-change
  release — Middleware is renamed **Proxy** (`src/proxy.ts`), `cookies()` is async, route
  helpers differ. Read `node_modules/next/dist/docs/` before changing framework code.
- **React 19**, **TypeScript**.
- **Tailwind CSS v4** (`@theme` tokens in `src/app/globals.css`). Changing `@theme` needs a
  dev-server restart (`rm -rf .next` + restart); HMR alone serves stale CSS vars.
- **Supabase** — Postgres + Auth + Row-Level Security + Realtime (`@supabase/ssr`,
  `@supabase/supabase-js`).
- **@anthropic-ai/sdk** — real Claude chat, server-side only.
- No chart library: donut, sparkline, bars are hand-rolled SVG.

---

## Running it

```bash
cd tokeville
npm install
npm run dev        # http://localhost:3000
```

Environment (`.env.local`, git-ignored, server-trusted values never use NEXT_PUBLIC_):

```
NEXT_PUBLIC_SUPABASE_URL=https://qvpgwaluxztxazzebglc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…   # publishable key, safe for the browser
PLATFORM_ANTHROPIC_API_KEY=                       # SERVER ONLY — Tokeville's own funded key, powers ALL Team-tier chat
PLATFORM_OPENAI_API_KEY=                          # optional — unset means OpenAI shows "not yet enabled"
PLATFORM_GOOGLE_API_KEY=                          # optional — unset means Google shows "not yet enabled"
```

**Test logins** (demo data; admin Settings → "Reset demo data" restores seed):
- Admin: `elliot@thegarcias.us` / `tokeville123` — workspace "Northwind Labs".
- Member: `taylor@tokeville.app` / `member123` — 3 projects, 3 connected accounts.

---

## Auth & roles

The login page has an **Admin / Member** toggle:
- **Admin** — email + password. Open self-sign-up creates a brand-new admin workspace
  (`signUp` then `signInWithPassword`). Emails are **auto-confirmed** at the DB level.
- **Member** — username + password. Members **cannot self-register**; an admin provisions
  them on the Team page (`POST /api/members`, service-role `auth.admin.createUser`). The
  username maps to a synthetic email `<username>@members.tokeville.app` (`src/lib/members.ts`),
  so usernames are globally unique. Member login only accepts these accounts.

Two roles, stored in `auth.users.raw_app_meta_data` (`role`, `workspace_id`) so the proxy
and server layout read them without an extra query:

- **Admin** — full workspace dashboard: treasury, spend, sub-accounts, team/invites,
  exchange, cards, chat, settings.
- **Member** — a simplified `/member` dashboard scoped to their assigned projects. **Members
  never see the treasury balance, other sub-accounts, or alerts** — enforced by RLS, not
  just the UI.

`src/proxy.ts` gates routes: unauthenticated → `/login`; members → `/member`; institution
admins → `/institution`; team admins → away from those; `/api/*` is exempt (route handlers do
their own auth).

### Two workspace types

`workspaces.type` is `team` (default) or `institution`, mirrored into
`app_metadata.workspace_type` so proxy + layout branch without a query. Chosen at admin
sign-up, switchable anytime (`set_workspace_type` RPC).

- **Team** — full reseller model: Tokeville holds its own funded provider API keys
  (`src/lib/platformKeys.ts`, `PLATFORM_<PROVIDER>_API_KEY` env vars) and ALL chat routes
  through them, never a customer-supplied key. Deposited TOK is real purchasing power backing
  that spend, not just an internal counter — Tokeville earns the per-transaction **platform
  fee** as genuine margin on money actually flowing through the platform.
- **Institution** — for orgs with their own/contracted (fixed-cost) AI. Admins budget & track
  that spend by department in USD (`departments`, `spend_entries`, `record_spend` RPC → 80%
  `budget_80` alerts); lives at `/institution`. Monetized by a **Stripe subscription**
  ($99/mo, `mode:'subscription'` via `/api/stripe/subscribe`; the webhook sets
  `workspaces.subscription_status`). The dashboard is paywall-gated until the sub is active.

---

## Supabase backend

Project ref `qvpgwaluxztxazzebglc`. Everything is scoped by `workspace_id` and protected by
RLS. SECURITY DEFINER helper functions (`is_workspace_admin`, `is_workspace_member`,
`is_my_project`) back the policies.

**Tables**
- `workspaces`, `workspace_members` (role), `invites` (pending email invites).
- `wallets` (treasury, **admin-only**), `providers` (per-provider spend; includes custom
  internal AIs), `sub_accounts` (budgets + `auto_topup`/`auto_topup_amount`).
- `project_members` (many-to-many: a member can be in multiple projects).
- `connected_accounts` (a member's company-email AI accounts).
- `budget_requests` (member→admin budget-raise asks with message + admin reply).
- `activity` (the token ledger), `alerts` (low-balance / auto-top-up, admin-only).
- `profiles`.

**Key RPCs** (SECURITY DEFINER, authorize via `auth.uid()`)
- `handle_new_user()` — signup trigger. Branches: (0) admin-provisioned member — role +
  workspace_id set via the Admin API → joins that workspace as member; (1) legacy email
  invite → joins as member; (2) otherwise → creates a new admin workspace + seeds demo data.
- `seed_user_data(uid, ws)` / `reset_user_data()` — seed / re-seed a workspace.
- `use_tokens(sub_account, amount, provider, detail)` — the spend path: deducts budget,
  burns treasury, adds provider spend, logs activity. Also runs **dynamic budgeting**: if
  remaining < 20% → auto-top-up from unallocated treasury (if enabled) else a low-balance
  alert (with the admin's email recorded).
- `resolve_budget_request(id, approve, response)` — admin approves (allocates) / declines.

**Realtime** enabled on `sub_accounts`, `activity`, `wallets`, `alerts`, `providers`,
`project_members`, `connected_accounts`, `budget_requests` — both providers refetch on
change, so admin and member views stay in sync live.

---

## App structure

```
src/
  app/
    layout.tsx              root (fonts, metadata)
    login/page.tsx          auth (reads ?email= from invite links)
    (app)/
      layout.tsx            server: auth + role branch → AppShell or MemberShell
      page.tsx              Treasury (admin overview)
      chat/page.tsx         AI Chat (admin)
      spend/ sub-accounts/ team/ activity/ exchange/ cards/ settings/
      member/page.tsx       member dashboard
    api/chat/route.ts       Anthropic chat (server-only key)
  proxy.ts                  role-based routing + session refresh
  store/
    demo.tsx                admin store (useDemo) — hydrated server-side, realtime, mutations
    member.tsx              member store (useMember)
  lib/
    data.ts                 domain types
    db.ts                   Supabase row mappers + loadDashboard / loadMemberDashboard
    format.ts               token/usd formatting, CURRENCIES, exchange rate
    cycle.ts                billing-cycle + burn-rate projection math
    supabase/{client,server}.ts
  components/                AppShell, MemberShell, Sidebar, Topbar, WalletCard, Kpis,
                             SpendByModel, SubAccounts, ActivityFeed, AlertsBanner, ChatPanel,
                             Modals, Toaster, Sparkline, icons
```

State: a server component loads data via `lib/db.ts` and passes it to a client store
(`useReducer` + Supabase realtime). Mutations apply optimistically and persist to Supabase.

---

## Implemented features

**Treasury / admin**
- Treasury balance hero (TOK primary, USD derived), sparkline, KPIs (circulating supply,
  burn rate, runway, exchange rate).
- Buy TOK in the 5 largest currencies (USD/EUR/CNY/JPY/GBP) → mints tokens at the rate.
- Allocate / create sub-accounts; spend-by-model donut; full token ledger with filters.
- Spend analytics (per-provider table, spend-by-account, CSV export, range toggle).
- Exchange page (two-way TOK⇄USD converter, provider FX rates).
- Cards & Keys (virtual card freeze, API key create/copy/revoke — client-side demo).
- Settings (profile save → persists, reset demo data, sign out).

**Team / roles**
- Invite by email → shareable link → signup lands on the member dashboard.
- Many-to-many project assignment; per-member usage visible to admin.
- Budget-raise requests: member submits with a message; admin approves (auto-allocates) /
  declines with a reply — all realtime.

**Dynamic budgeting**
- Low-balance alerts (dashboard banner + recorded email) under 20%.
- Optional per-account auto-top-up from unallocated treasury.
- Burn-rate projection per sub-account vs. the billing cycle ("Lasts the cycle" /
  "Empties in ~Xd").

**Company / internal AI**
- Admins add a private/on-prem model (name, deployment, color); shows an "Internal" badge.
- Members see it under "Company AI" and can meter usage against it. Admin-only to add
  (DB-enforced: members have SELECT-only on custom providers).

**Real AI chat — full reseller model**
- `/chat` (admin) and on `/member`. Routes through **Tokeville's own platform keys**
  (`src/lib/platformKeys.ts`) **server-side only** — customers never add or connect their own
  provider keys (nothing to steal, and TOK deposits are what actually pay for the real usage).
- **Streams** the reply token-by-token (SSE: `delta` events then a final `done` event).
  `src/lib/chatStream.ts` consumes it; both ChatPanel and ChatWorkspace render incrementally.
- Assistant replies render as **markdown** (`src/components/MarkdownMessage.tsx`,
  react-markdown + remark-gfm) with syntax-highlighted, copyable code blocks (rehype-highlight).
- **Pre-flight balance gate**: if the chosen sub-account's remaining budget ≤ 0, returns 402
  with a "top up" message before any AI call.
- Computes the **exact USD cost** from the model's `inputPer1M`/`outputPer1M`, converts to TOK
  at the treasury rate (`tokensFromUsd`), deducts that from the sub-account via `use_tokens`,
  and logs a `Chat · <model>` ledger entry. The realtime subscription updates balances live.
- **Privacy: only token counts are persisted — message content is never written to the DB.**
- Requires `PLATFORM_<PROVIDER>_API_KEY` to be set per provider; an unconfigured provider
  returns a clean 503 ("isn't enabled on Tokeville yet") rather than erroring. Settings →
  "AI Models" (`AIProviderSettings`, no add-key form) shows which providers are live —
  nothing for the customer to configure.

---

## Conventions & gotchas

- Tokens are the source of truth; USD = `tokens × ($10 / 1M)` (`USD_PER_MILLION_TOKENS`).
- All money/figures use `.tnum` (tabular nums) and the `Ŧ`/`tok()` helpers.
- Provider colors come from the DB (`providers.color`) with built-in fallbacks
  (`db.ts providerColor()`).
- Most Supabase advisory warnings remaining are intentional (SECURITY DEFINER helpers must be
  executable by `authenticated` for RLS; leaked-password protection is an auth-config toggle).
- Demo data may have been hand-nudged during testing — use Settings → Reset demo data.
