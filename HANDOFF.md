# Tokeville — Context Handoff

Paste this whole file into a fresh chat to bring a new AI up to speed. It explains
**what Tokeville is**, **how it's built**, **what's done**, and **what's still open**.
Last major update: 2026-07-08.

---

## 1. What Tokeville is

An **AI spend-management platform where tokens are the currency**. Companies get one place
to pay for, budget, meter, and govern all their AI usage across providers.

- Unit of value: a **Tokeville token (Ŧ / TOK)**, priced at **$10 per 1M TOK** (`USD_PER_MILLION_TOKENS` in `src/lib/format.ts`).
- Aesthetic: premium **black & gold**, monospaced/tabular figures, dependency-free SVG charts.
- Deploys on push to `main` (Vercel, GitHub repo `ellgar1x/Tokeville`).
- **Access is currently invite-only / waitlisted** (see §7). Only `elliot@thegarcias.us`
  can create/use a workspace; everyone else can only join the waiting list.

### The two products (differ by `workspaces.type`)

**A) Managed** (`type='team'`, UI label **"Managed"**) — the reseller model:
- The customer **buys TOK** (Stripe deposit, 5% platform fee) → TOK is real purchasing power.
- ALL chat runs on **Tokeville's own funded provider keys** ("platform keys",
  `src/lib/platformKeys.ts`, env `PLATFORM_<PROVIDER>_API_KEY`) — the customer never supplies a
  provider key. Each call is metered and deducts TOK from their treasury.
- Each admin gets their **own Tokeville API key** (`sk-tok-…`) they can create in **Cards &
  Keys** and use against an **OpenAI-compatible gateway** (`/api/gateway/chat/completions`)
  to spend their tokens programmatically. (Internally the gateway calls the platform key;
  "each admin gets their own key" = their own Tokeville-issued credential, not a raw provider
  key. This is the standard aggregator pattern, like OpenRouter.)
- Monetization: the 5% deposit fee (genuine margin, since money really flows through Tokeville).

**B) Institutional** (`type='institution'`, UI label **"Institutional"**) — bring-your-own-key:
- The customer adds their **own** provider keys (Settings-style **"AI Keys"** tab on
  `/institution`, `InstitutionKeys.tsx` → `/api/provider-keys`). Their key pays their provider.
- A **"Chat"** tab (`ChatWorkspace billingMode="usd"`) routes chat through the **workspace's own
  key** (`getWorkspaceKey` in `api/chat/route.ts`, delegation-aware). Each reply's **exact USD
  cost is logged as a metered `spend_entries` row against the chosen department**
  (`record_spend`, source='metered') — feeding department budgets, 80% alerts, overview + CSV.
  Pre-flight blocks (402) if the department is over budget; no BYO key for the provider → 503.
- **Key delegation**: a key can be pinned to a **person** (`assigned_user_id`), **project**
  (`assigned_sub_account_id`), or **department** (`assigned_department_id`) so one key never
  serves the whole org. Resolution precedence: department-assigned → caller-assigned → shared.
- **"Any endpoint"**: a `custom` provider key (base URL + model id + the customer's own
  input/output price per 1M) works with ANY OpenAI-compatible provider (Together, Groq,
  OpenRouter, self-hosted) with exact metering. Stored in `provider_api_keys.custom_*` columns;
  resolved by `getCustomModel` in the chat route; shown under "Your models" in the chat picker.
- No deposit/treasury/TOK. Monetized by **per-seat Stripe subscription** (see below).

**Per-seat pricing (Institutional)** — `src/lib/plans.ts` is the single source of truth:
Starter $49/mo (5 active users), Team $199/mo (25), Scale $499/mo (100), Enterprise custom
(100+, sales-led). "Active user" = a member with ≥1 token-spend event in the current calendar
month (`count_active_users` SQL fn; trigger caches into `workspaces.active_user_count`).
Columns: `workspaces.institutional_tier` / `institutional_seat_limit` (null = legacy flat $99).
Adding a NEW member past the seat limit → 402 with an upgrade prompt (existing users never
blocked). Stripe prices resolve by lookup_key `tokeville_inst_*` (created in test mode);
`/api/stripe/upgrade` swaps the live subscription item with prorations. `/institution` is
paywall-gated (tier picker) until a sub is active; Account tab shows plan + seat usage +
change-plan grid; header chip: "Institutional · <Tier> plan · N/M active users".

### Roles
- **Admin** — full workspace dashboard.
- **Member** — provisioned by an admin (username + password, no self-signup); scoped `/member`
  dashboard for assigned projects. Username maps to synthetic email
  `<username>@members.tokeville.app` (`src/lib/members.ts`).
- **Super-admin** — `elliot@thegarcias.us` (`src/lib/superAdmin.ts`, `SUPER_ADMIN_EMAIL`). Only
  account that can create a workspace while waitlisted; only one that sees the **Console** (§7).

---

## 2. Tech stack & structure

- **Next.js 16** (App Router, `src/` dir, Turbopack). BREAKING vs older Next: Middleware is
  **Proxy** (`src/proxy.ts`), `cookies()` is async. Read `node_modules/next/dist/docs/` before
  touching framework code. See `AGENTS.md`.
- **React 19**, **TypeScript**, **Tailwind CSS v4** (`@theme` tokens in `src/app/globals.css`;
  changing `@theme` needs a dev restart + `rm -rf .next`).
- **Supabase** — Postgres + Auth + RLS + Realtime. Project ref `qvpgwaluxztxazzebglc` (MCP available).
- **Stripe** (test mode) — deposits + institutional per-seat subscriptions.
- AI SDKs (server-only): `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`.
- File generation: `docx` (.docx), `exceljs` (.xlsx), `pdf-lib` (.pdf via `src/lib/buildPdf.ts`),
  `pptxgenjs` (.pptx). Markdown chat: `react-markdown` + `remark-gfm` + `rehype-highlight`.

Key files:
- `src/app/api/chat/route.ts` — metered streaming chat (branches by workspace type; §3).
- `src/app/api/gateway/chat/completions/route.ts` — OpenAI-compatible gateway (Managed keys).
- `src/lib/models.ts` — provider/model registry + **rate card** (prices). Providers: anthropic,
  openai, google, mistral, custom. `ProviderDef.baseUrl` for OpenAI-compatible ones.
- `src/lib/platformKeys.ts` — Tokeville's own funded keys (Managed). `src/lib/plans.ts` — tiers.
- `src/lib/superAdmin.ts`, `src/lib/apiKeys.ts` (sk-tok hashing), `src/lib/stripeTiers.ts`.
- `src/lib/db.ts` — `loadDashboard` / `loadMemberDashboard` / `loadInstitution`.
- `src/store/{demo,member,institution}.tsx` — client stores (useReducer + realtime).
- `src/components/` — ChatWorkspace (billingMode tok|usd, extraModels), InstitutionKeys,
  AIProviderSettings (Managed, read-only provider list), WaitlistForm, MarkdownMessage
  (docx/pdf/xlsx/csv/pptx cards), Sidebar (Console link for super-admin), etc.
- `CLAUDE.md` — living project doc.

Run: `cd tokeville && npm run dev`. Build: `npm run build`.

---

## 3. How metering works (this is the core — get it exactly right)

**Rate card is hardcoded** (`src/lib/models.ts`): providers bill `tokens × published price`, so
a correct table = exact match, free, no API calls. Cost formula everywhere:
`costUsd = in/1e6*inputPer1M + out/1e6*outputPer1M`. Verify rates with web search if a provider
changes prices — since TOK/USD now back real spend, a stale rate card means over/under-collecting.

**Managed chat (`type='team'`):** authenticate → **pre-flight balance gate (before any AI call)**
→ `getPlatformKey(provider)` → stream → `costTok = round(tokensFromUsd(costUsd))` → deduct via
`use_tokens` (sub-account) or `use_tokens_personal` ("personal" = unallocated treasury).
No balance → 402; provider not funded → 503.

**Gateway (Managed, external/API use):** `POST /api/gateway/chat/completions`, OpenAI-shaped,
`Authorization: Bearer sk-tok-…`. Hash-looks-up the key (`tokeville_keys`, service client) →
workspace → balance gate → platform key → **non-streaming** provider call → meters exact
USD→TOK via `gateway_use_tokens` (service-role RPC, deducts unallocated treasury) → returns
OpenAI-shaped completion (`usage` includes `tokeville_tok` / `tokeville_cost_usd`). Revoked/
unknown keys → 401.

**Institutional chat (`type='institution'`):** pre-flight checks the **department's monthly
budget** (402 if over) → `getWorkspaceKey` (the workspace's OWN key, delegation-aware) or
`getCustomModel` (custom "any endpoint") → stream → logs exact USD via `record_spend`
(source='metered') against the department. `spend_entries.amount_usd` is **numeric(14,6)** so
sub-cent per-call costs accumulate exactly (was (12,2) → rounded to $0 — that was a real bug,
fixed). No TOK/treasury here.

**Privacy:** only token counts / costs are persisted — chat message content is never written to
the DB. **Client chat history** is in localStorage, scoped per tenant
(`tokeville-workspace-admin-<workspaceId>` / `-member-<userId>`) after an earlier cross-tenant
leak fix.

**Residual risk (disclosed):** TOK deduction happens *after* the call (need real usage counts),
so the pre-flight is "balance > 0," not "covers worst case." A near-empty workspace could incur
one small real charge slightly over their remaining TOK before the next call is blocked.
Bounded, not unbounded. Full escrow/reservation would be a bigger follow-up.

---

## 4. Supabase specifics

Everything scoped by `workspace_id` + RLS. SECURITY DEFINER helpers back policies:
`is_workspace_admin`, `is_workspace_member`, `is_my_project`.

**Key RPCs / triggers:**
- `handle_new_user()` (AFTER INSERT on auth.users): provisioned-member → invite → new-admin
  branch. New admins start EMPTY via `init_empty_workspace`. **GATED: the new-admin branch
  raises unless email = elliot's** (waitlist enforcement — member/invite branches unaffected).
- `use_tokens`, `use_tokens_personal` (Managed spend; auto top-up + low-balance alerts).
- `gateway_use_tokens` (service-role only; gateway deduction, no auth.uid()).
- `record_spend` (Institutional USD spend + 80% `budget_80` alerts).
- `ensure_provider_row` (auto-creates the `providers` row on first spend — fixed a bug where
  per-provider tracking silently no-oped on fresh workspaces).
- `count_active_users` + `refresh_active_user_count` trigger (per-seat active-user cache).
- `mint_tokens` (Stripe deposit → TOK), `set_workspace_type`, `reset_user_data` (demo seed ONLY
  for elliot; everyone else's "Reset" clears to empty).
- **Security (locked down this session):** `mint_tokens`, `init_empty_workspace`,
  `seed_institution_data`, `gateway_use_tokens` are **service_role-only**; anon EXECUTE was
  revoked from all mutation RPCs (they were anon-executable → free minting / workspace wipe).

**Tables:** workspaces (`type`, `subscription_*`, `institutional_tier`,
`institutional_seat_limit`, `active_user_count`), wallets, providers, sub_accounts, activity
(ledger), alerts, **provider_api_keys** (`owner_user_id`, `budget_tokens`, `spent_tokens`,
`assigned_user_id`, `assigned_sub_account_id`, `assigned_department_id`, `custom_model`,
`custom_model_label`, `custom_input_per_1m`, `custom_output_per_1m`), departments +
spend_entries (`amount_usd` numeric(14,6)), workspace_members, project_members, budget_requests,
connected_accounts, profiles, **tokeville_keys** (sk-tok gateway keys: `key_hash`, `key_prefix`,
`last_used_at`, `revoked_at`; RLS admin-only), **waitlist** (RLS on, no policies → service-role
only).

---

## 5. Env vars (`.env.local`; NEEDS SETTING IN VERCEL — see §7)

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY   # publishable
SUPABASE_SERVICE_ROLE_KEY                                  # server-only
ENCRYPTION_KEY            # 64-hex; AES-256-GCM for stored provider keys (src/lib/crypto.ts)
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET                  # test mode
PLATFORM_ANTHROPIC_API_KEY   # Tokeville's own funded key — powers ALL Managed chat + gateway
PLATFORM_OPENAI_API_KEY / PLATFORM_GOOGLE_API_KEY / PLATFORM_MISTRAL_API_KEY  # optional; unset = "not yet enabled"
ANTHROPIC_API_KEY            # LEGACY, unused by chat now (safe to remove)
```

---

## 6. Test accounts

- **`elliot@thegarcias.us` / `tokeville123`** — super-admin, workspace "Northwind Labs"
  (populated demo). Only account that can create a workspace while waitlisted.
- Member example: `taylor@tokeville.app` / `member123`.
- Stripe test card `4242 4242 4242 4242`.
- Convention: test users use `@tokeville.test` / `@example.com` emails; delete via service role
  after testing (scripts live in the session scratchpad).

---

## 7. What's DONE this session (2026-07-02 → 07-08), newest first

- **Waitlist + owner console + signup gating.** Landing CTAs all → "Join the waiting list"
  (`WaitlistForm` → `/api/waitlist`, public, validated, idempotent). Login: open admin signup
  removed (sign-in only + waitlist link). Server backstop: `handle_new_user` raises on new
  non-elliot admin. **Console** (`/admin`, super-admin only, `/api/admin/overview`): tabbed
  view of the waitlist (CSV export) + every admin account across all workspaces; sidebar link
  shown only to elliot. (Verified 10/10 incl. real DB-level signup block.)
- **Deposit → key flow + NaN fixes.** DepositBanner success now has a "Create your API key →"
  CTA; Cards & Keys shows a "no unallocated tokens → Deposit" nudge; fixed `NaN%`/`ŦNaN` on
  brand-new $0 workspaces (empty `dailySpend`, divide-by-zero in Kpis/WalletCard).
- **Per-admin Tokeville keys + gateway** (`sk-tok-…`, `/api/keys`, `/api/gateway/chat/completions`,
  `tokeville_keys` table, `gateway_use_tokens`). Cards & Keys rebuilt (was a fake client-only
  demo). Verified end-to-end with a REAL Anthropic call: create → gateway → exact TOK deduction
  → ledger "API" spend → revoke → 401.
- **"Any endpoint"** custom OpenAI-compatible provider with customer pricing (Institutional).
  Verified against a mock SSE endpoint: routed + metered with custom pricing exactly.
- **Mistral** added as a 4th first-class provider (OpenAI-compatible, verified pricing
  Large $2/$6, Small $0.10/$0.30 per 1M).
- **Managed rebrand** (Team → "Managed" in all customer-facing copy; enum stays `team`).
- **Managed reseller model** (platform keys; TOK deposits actually pay for usage).
- **BYO-key Institutional product** (own keys + metered chat → department USD; merged into
  Institutional; department delegation; `amount_usd` precision fix).
- **Institutional per-seat tiers** (replaced flat $99; §1). Verified end-to-end.
- **API key delegation** (person/project/department) + `ensure_provider_row` fix.
- **File generation**: docx/xlsx/pptx/pdf/csv with premium styling; the model now produces the
  format asked for (not HTML). Verified by decoding real files.
- **Landing polish** (gold shimmer headline, self-drawing sparkline, live ledger ticker).
- **Security**: locked down anon-executable SECURITY DEFINER RPCs; re-encrypted elliot's key;
  fixed cross-tenant chat-history localStorage leak.

---

## 8. OPEN ITEMS / watch-outs

1. **NEEDS ACTION IN VERCEL:** set `PLATFORM_ANTHROPIC_API_KEY` (Managed chat + gateway 503
   without it) and confirm `ENCRYPTION_KEY` matches `.env.local` (else stored BYO keys can't
   decrypt in prod). For a real launch, use Tokeville's own corporate-funded provider keys, not
   a repurposed personal one. Add `PLATFORM_OPENAI/GOOGLE/MISTRAL_API_KEY` to enable those. The
   legacy `ANTHROPIC_API_KEY` in Vercel can be removed (unused).
2. **Rate card drift** (`models.ts`) — single source of truth; re-verify with web search on
   provider price changes. Matters more now that TOK backs real spend.
3. **3 pre-existing non-elliot admin accounts** exist (`egarcia27@riverdale.edu`,
   `skg6771@gmail.com`, `tokevilletest@tokeville.com`) — created before the signup gate. The
   gate only blocks NEW signups. Delete/deactivate them if desired (user was asked, undecided).
4. **Waitlist approval flow** not built — approving a waitlisted person into an account is the
   natural next step (create their account or an allowlist the trigger checks).
5. **Gateway is non-streaming** (returns full completion). Streaming (SSE) is a clean follow-up.
6. **Members can't self-serve keys** in `/member` (Institutional keys UI is admin-only).
7. **Residual metering timing risk** (§3) — bounded post-call charge on near-empty balances.

---

## 9. Working conventions the user expects

- **No silent "demo patches."** Fixes must be real, universal (work for any user), verified
  (build + live preview + often a scripted end-to-end with a REAL provider call), and honest
  about limits. The user reacts strongly to metering being even slightly off — "the whole
  backing of Tokeville." Prove metering with exact-cost assertions.
- After changes: `npm run build`, verify in preview, then **commit + push to `main`** (deploys
  from GitHub). Commit messages end with a `Co-Authored-By` trailer.
- Supabase changes via MCP `apply_migration`; verify with `execute_sql`.
- **Dev-server gotcha:** running `rm -rf .next` (or `npm run build`) while the preview dev
  server is running corrupts its Turbopack cache → "Internal Server Error". Stop the preview
  server first, or restart it after. Preview sessions also drop often; re-login as elliot.
- Screenshots via the preview tool sometimes come back black/stale — trust DOM assertions
  (`preview_eval`) over screenshots for verification.
</content>
