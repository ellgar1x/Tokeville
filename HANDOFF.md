# Tokeville — Context Handoff

Paste this whole file into a fresh chat to bring a new AI up to speed. It explains
**what Tokeville is**, **how it's built**, **what's done**, and **what's still open**.

---

## 1. What Tokeville is

An **AI spend-management platform where tokens are the currency**. Companies fund a
treasury, allocate token budgets across teams/projects, and meter real AI usage against
those budgets — across providers (Anthropic, OpenAI, Google), through one chat interface.

- Unit of value: a **Tokeville token (Ŧ / TOK)**, priced at **$10 per 1M TOK** (`USD_PER_MILLION_TOKENS`).
- Aesthetic: premium **black & gold**, monospaced/tabular figures, dependency-free SVG charts.
- Live on Vercel, GitHub repo `ellgar1x/Tokeville`. Deploys on push to `main`.

### Two product tiers (chosen at admin sign-up, switchable in Settings)
- **Team** (default): pay ALL your AI spend through Tokeville — deposit/buy tokens, budget
  them, meter every call. Tokeville earns via a **5% platform fee** on deposits.
- **Institutional**: for orgs with their own/contracted (fixed-cost) AI. Budget & track that
  spend **by department** in USD; log manually or via CSV; 80% budget alerts. Monetized by a
  **$99/mo Stripe subscription** — the institution dashboard is paywall-gated until active.

### Roles
- **Admin** — full workspace (treasury, spend, sub-accounts, team, chat, settings).
- **Member** — provisioned by an admin with a **username + password** (no self-signup);
  scoped `/member` dashboard for their assigned projects only. Members map to a synthetic
  email `<username>@members.tokeville.app` (see `src/lib/members.ts`).

---

## 2. Tech stack & structure

- **Next.js 16** (App Router, `src/` dir, Turbopack). BREAKING vs older Next: Middleware is
  **Proxy** (`src/proxy.ts`), `cookies()` is async. Read `node_modules/next/dist/docs/`
  before touching framework code. See `AGENTS.md`.
- **React 19**, **TypeScript**, **Tailwind CSS v4** (`@theme` tokens in `src/app/globals.css`;
  changing `@theme` needs a dev restart + `rm -rf .next`).
- **Supabase** — Postgres + Auth + RLS + Realtime. Project ref `qvpgwaluxztxazzebglc`.
- **Stripe** (test mode) — deposits (`/api/stripe/checkout` + `/webhook`) and the institutional
  subscription (`/api/stripe/subscribe`).
- AI SDKs: `@anthropic-ai/sdk`, `openai`, `@google/generative-ai` — **server-side only**.
- Markdown chat rendering: `react-markdown` + `remark-gfm` + `rehype-highlight`. `.pptx` via `pptxgenjs`.

Key files:
- `src/app/api/chat/route.ts` — the metered streaming chat endpoint (see §3).
- `src/lib/models.ts` — model registry + **prices** (the rate card).
- `src/lib/db.ts` — `loadDashboard`, `loadMemberDashboard`, `loadInstitution`.
- `src/store/{demo,member,institution}.tsx` — client stores (useReducer + realtime).
- `src/components/` — AppShell, MemberShell, InstitutionShell, ChatWorkspace, WalletCard,
  AIProviderSettings, MarkdownMessage (file/artifact/pptx), Sidebar/MobileNav, Modals, etc.
- `CLAUDE.md` — living project doc (keep it updated).

Run: `cd tokeville && npm run dev`. Build check: `npm run build`.

---

## 3. How metering works (this is the core; get it right)

Chat flow (`/api/chat`): authenticate → resolve which **provider API key** to use (STRICT to
the caller's workspace — see security note) → **pre-flight balance/budget gate** → stream from
the provider → read **exact input/output tokens** from the response → compute
`costUsd = in/1e6*inputPer1M + out/1e6*outputPer1M` → `costTok = round(costUsd * 100000)` →
deduct.

Billing target (`subAccountId` in the request body):
- a **sub-account** id → `use_tokens` RPC (deduct budget + burn treasury + log activity + dynamic top-up/alerts).
- `"personal"` → `use_tokens_personal` RPC (draw from **unallocated treasury**, admin-only, no project).
- Insufficient funds → **402**; the chat UI shows a prominent "Insufficient balance → Deposit funds" banner.

**Per-key budgets:** each row in `provider_api_keys` can have `owner_user_id`, `budget_tokens`
(null = no cap), `spent_tokens`. Chat prefers the **caller's own key** → any key in the same
workspace. It enforces the key's budget (402 when used up) and records per-key spend via
`record_key_spend`. UI: `AIProviderSettings` shows a per-key budget bar + an **Edit/Reconcile**
form (set budget; enter "balance remaining now" to sync a key to the provider dashboard).

**Pricing is a hardcoded rate card** (`models.ts`), because providers bill deterministically
(`tokens × published price`, same for everyone). So a correct table = exact match, universally,
free, no API calls. Providers expose **no** "remaining balance" API for a standard key (only an
`sk-ant-admin…` admin key can read cost, and the user's plan doesn't offer admin keys). So
accuracy = keeping the rate card correct + the manual Reconcile control as a safety net.
Rates verified correct as of this session; the two that had been stale are now fixed:
**Anthropic Opus 4.8 = $5/$25**, **OpenAI o3 = $2/$8** (per 1M in/out).

---

## 4. Supabase specifics

Everything scoped by `workspace_id` + RLS. SECURITY DEFINER helpers back policies:
`is_workspace_admin(ws)`, `is_workspace_member(ws)`, `is_my_project(...)` — all correctly
workspace-scoped.

Important RPCs/triggers:
- `handle_new_user()` (AFTER INSERT on auth.users): provisioned-member branch → invite branch →
  new-admin branch. **New admins now start EMPTY** via `init_empty_workspace` (zeroed wallet,
  no sub-accounts/providers/activity/departments). Honors `workspace_type` (team/institution).
- `seed_user_data` / `seed_institution_data` — demo seeds. `reset_user_data()` seeds demo ONLY
  for `elliot@thegarcias.us`; every other admin's "Reset" clears to empty.
- `use_tokens`, `use_tokens_personal`, `record_key_spend`, `mint_tokens` (deposits, sets
  `activity.user_id` = workspace owner), `set_workspace_type`, `record_spend` (institution 80% alerts).

Tables: workspaces (`type`, `subscription_*`), wallets, providers, sub_accounts, activity
(the ledger), alerts, provider_api_keys (`owner_user_id`,`budget_tokens`,`spent_tokens`),
departments + spend_entries (institution), workspace_members, project_members, budget_requests,
connected_accounts, profiles.

---

## 5. Demo account & test data

- **`elliot@thegarcias.us` / `tokeville123`** — the ONE demo account (workspace "Northwind Labs",
  populated). It has a **real Anthropic key** stored (label "Anthropic — $5 test key", $5 budget,
  reconciled to the real dashboard remaining). Everyone else starts empty.
- Institution demo: convert in Settings → paywall → (Stripe test card `4242 4242 4242 4242`).

---

## 6. What's DONE (this session)

Streaming metered chat; markdown + syntax-highlighted code blocks; **file downloads, website
preview, .pptx generation, file drag-drop attachments** (see `MarkdownMessage.tsx`); model
registry accuracy; member accounts (username/password, admin/member login split); Team vs
Institutional tiers + Stripe subscription + paywall; landing page redesign (bento, scroll
reveal, "Two ways to use Tokeville" plans); mobile viewport + nav drawer; deposit page with
transparent 5% fee; **Personal chat** (bill to treasury); **per-key budgets + ownership +
Reconcile control**; rate-card audit (Opus/o3 fixed); **new accounts start empty** (only elliot
has demo); **cross-tenant key-leak fix** (removed shared platform-key fallback).

---

## 7. OPEN ITEMS / watch-outs

1. **Vercel env `ANTHROPIC_API_KEY`** is now UNUSED by chat (shared-key fallback removed). It's
   the user's personal $5 key set as a "platform" key — consider removing it from Vercel to avoid
   confusion. Chat now requires each workspace to add its **own** key in Settings → AI Providers.
2. **Provider prices can drift** if a provider changes rates — the rate card in `models.ts` is
   the single source of truth; update it (and re-verify with web search) when needed. The manual
   **Reconcile** control on each key is the per-user safety net.
3. ~~elliot's stored Anthropic key is plaintext~~ — DONE (re-encrypted 2026-07-02; verified
   via live chat). NOTE: production (Vercel) must have the same `ENCRYPTION_KEY` env set or
   prod chat can't decrypt stored keys — verify in the Vercel dashboard.
4. **Members can't self-serve API keys yet** — data model/API/RLS support member-owned keys, but
   the key UI lives in admin Settings (`/member` has no keys panel). Easy follow-up if wanted.
5. **Anthropic admin cost sync** was explored and dropped — the user's plan has no admin key.
   Rate card + manual reconcile is the chosen path.
6. **RPC grants locked down (2026-07-02)** — `mint_tokens`, `init_empty_workspace`, and
   `seed_institution_data` had NO internal auth check yet were executable by `anon` +
   `authenticated` via PostgREST (unlimited free minting / workspace wipe). Migrations
   `lock_down_privileged_rpcs` + `revoke_public_execute_on_mutation_rpcs` revoked them
   (service_role only) and removed anon EXECUTE from all mutation RPCs. Verified: anon
   calls now return 401; authenticated chat/metering still works end-to-end.

---

## 8. Working conventions the user expects

- **No silent "demo patches."** Fixes must be real and universal (work for any user), verified
  (build + live preview), and honest about limits. The user reacts strongly to metering being
  even slightly off — it's "the whole backing of Tokeville."
- After changes: `npm run build`, verify in preview, then **commit + push to `main`** (the user
  deploys from GitHub). Commit style ends with a `Co-Authored-By` trailer.
- Supabase changes via migrations (MCP `apply_migration`). Verify with `execute_sql`.
- Preview sessions drop often; re-login as elliot when testing.
