/**
 * Supabase row shapes and mappers to the UI's domain types. Bigints are coerced
 * with Number() — every Tokeville figure stays well within JS's safe range.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountType,
  ActivityEntry,
  ActivityType,
  Alert,
  BudgetRequest,
  DashboardData,
  Department,
  InstitutionAlert,
  InstitutionData,
  MemberData,
  ProviderSpend,
  SpendEntry,
  SubAccount,
  Wallet,
} from "./data";
import { relativeTime } from "./relative-time";

export interface WalletRow {
  balance_tokens: number;
  deposited_tokens: number;
  projected_month_tokens: number;
  change_24h: number;
  daily_spend: (number | string)[];
}
export interface ProviderRow {
  id: string;
  provider_key: string;
  name: string;
  models: string;
  tokens: number | string;
  change_mom: number;
  is_custom?: boolean;
  color?: string | null;
}

const FALLBACK_COLOR: Record<string, string> = {
  anthropic: "#e08a63",
  openai: "#2bbd95",
  google: "#6c9bff",
  other: "#9aa0ac",
};

export function providerColor(key: string, color?: string | null): string {
  return color ?? FALLBACK_COLOR[key] ?? "#818cf8";
}
export interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  owner: string;
  initials: string;
  token_budget: number | string;
  tokens_used: number | string;
  auto_topup?: boolean;
  auto_topup_amount?: number | string;
}
export interface ActivityRow {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  tokens: number | string;
  provider: string | null;
  created_at: string;
}

export function mapProvider(r: ProviderRow): ProviderSpend {
  return {
    id: r.id,
    key: r.provider_key,
    name: r.name,
    models: r.models,
    tokens: Number(r.tokens),
    changeMoM: Number(r.change_mom),
    isCustom: r.is_custom ?? false,
    color: providerColor(r.provider_key, r.color),
  };
}

export function mapAccount(r: AccountRow): SubAccount {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    owner: r.owner,
    initials: r.initials,
    tokenBudget: Number(r.token_budget),
    tokensUsed: Number(r.tokens_used),
    autoTopup: r.auto_topup ?? false,
    autoTopupAmount: Number(r.auto_topup_amount ?? 0),
  };
}

export function mapActivity(r: ActivityRow): ActivityEntry {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    detail: r.detail,
    tokens: Number(r.tokens),
    provider: r.provider,
    time: relativeTime(r.created_at),
    createdAt: r.created_at,
  };
}

export function buildWallet(
  row: WalletRow,
  providers: ProviderSpend[],
  accounts: SubAccount[],
): Wallet {
  return {
    balanceTokens: Number(row.balance_tokens),
    depositedTokens: Number(row.deposited_tokens),
    projectedMonthTokens: Number(row.projected_month_tokens),
    change24h: Number(row.change_24h),
    dailySpend: row.daily_spend.map(Number),
    monthToDateTokens: providers.reduce((s, p) => s + p.tokens, 0),
    allocatedTokens: accounts.reduce((s, a) => s + a.tokenBudget, 0),
  };
}

interface AlertRow {
  id: string;
  sub_account_id: string | null;
  type: Alert["type"];
  title: string;
  detail: string;
  email_sent: boolean;
  email_to: string;
  read: boolean;
  created_at: string;
}

export function mapAlert(r: AlertRow): Alert {
  return {
    id: r.id,
    subAccountId: r.sub_account_id,
    type: r.type,
    title: r.title,
    detail: r.detail,
    emailSent: r.email_sent,
    emailTo: r.email_to,
    read: r.read,
    time: relativeTime(r.created_at),
  };
}

/** Load an Admin's full workspace dashboard. RLS scopes everything to their workspace. */
export async function loadDashboard(
  supabase: SupabaseClient,
  email: string,
): Promise<DashboardData> {
  const [walletRes, providersRes, accountsRes, activityRes, profileRes, wsRes, alertsRes] =
    await Promise.all([
      supabase.from("wallets").select("*").single(),
      supabase.from("providers").select("*").order("sort"),
      supabase.from("sub_accounts").select("*").order("created_at"),
      supabase.from("activity").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").single(),
      supabase.from("workspaces").select("id, name, primary_color, secondary_color").single(),
      supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

  for (const [name, res] of Object.entries({ walletRes, providersRes, accountsRes, activityRes, profileRes, wsRes, alertsRes })) {
    if ((res as { error?: { message: string } | null }).error) {
      console.error(`[db] loadDashboard: ${name} failed`, { error: (res as { error: { message: string } }).error.message, email });
    }
  }

  const providers = (providersRes.data ?? []).map(mapProvider);
  const accounts = (accountsRes.data ?? []).map(mapAccount);
  const activity = (activityRes.data ?? []).map(mapActivity);
  const alerts = (alertsRes.data ?? []).map(mapAlert);
  const wallet = buildWallet(walletRes.data as WalletRow, providers, accounts);

  return {
    workspace: {
      id: wsRes.data?.id ?? "",
      name: wsRes.data?.name ?? "My Workspace",
      primaryColor: wsRes.data?.primary_color ?? null,
      secondaryColor: wsRes.data?.secondary_color ?? null,
    },
    wallet,
    providers,
    accounts,
    activity,
    alerts,
    profile: {
      displayName: profileRes.data?.display_name ?? "",
      orgName: profileRes.data?.org_name ?? "My Workspace",
      email,
    },
  };
}

/** Load a Member's slice — only their projects, usage, accounts, and requests. */
export async function loadMemberDashboard(
  supabase: SupabaseClient,
  email: string,
): Promise<MemberData> {
  const [projectsRes, activityRes, profileRes, wsRes, accountsRes, requestsRes, providersRes] =
    await Promise.all([
      // RLS returns only the member's assigned projects.
      supabase.from("sub_accounts").select("*").order("name"),
      supabase.from("activity").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").single(),
      supabase.from("workspaces").select("name, primary_color, secondary_color").single(),
      supabase.from("connected_accounts").select("*").order("created_at"),
      supabase.from("budget_requests").select("*").order("created_at", { ascending: false }),
      // RLS returns only custom/internal providers to members.
      supabase.from("providers").select("*").order("sort"),
    ]);

  for (const [name, res] of Object.entries({ projectsRes, activityRes, profileRes, wsRes, accountsRes, requestsRes, providersRes })) {
    if ((res as { error?: { message: string } | null }).error) {
      console.error(`[db] loadMemberDashboard: ${name} failed`, { error: (res as { error: { message: string } }).error.message, email });
    }
  }

  const projects = (projectsRes.data ?? []).map(mapAccount);
  const nameOf = (id: string) => projects.find((p) => p.id === id)?.name ?? "Project";

  return {
    workspaceName: wsRes.data?.name ?? "Workspace",
    primaryColor: wsRes.data?.primary_color ?? null,
    secondaryColor: wsRes.data?.secondary_color ?? null,
    projects,
    internalProviders: (providersRes.data ?? []).map((r) => ({
      key: r.provider_key as string,
      name: r.name as string,
      models: r.models as string,
      color: providerColor(r.provider_key as string, r.color as string | null),
      isCustom: true,
    })),
    activity: (activityRes.data ?? []).map(mapActivity),
    connectedAccounts: (accountsRes.data ?? []).map((r) => ({
      id: r.id as string,
      providerKey: r.provider_key as MemberData["connectedAccounts"][number]["providerKey"],
      accountEmail: r.account_email as string,
      status: r.status as string,
    })),
    requests: (requestsRes.data ?? []).map((r) => ({
      id: r.id as string,
      subAccountId: r.sub_account_id as string,
      subAccountName: nameOf(r.sub_account_id as string),
      amountTokens: Number(r.amount_tokens),
      message: r.message as string,
      status: r.status as BudgetRequest["status"],
      adminResponse: r.admin_response as string,
      time: relativeTime(r.created_at as string),
    })),
    profile: {
      displayName: profileRes.data?.display_name ?? "",
      orgName: profileRes.data?.org_name ?? "",
      email,
    },
  };
}

// ─── Institution dashboard ───────────────────────────────────────────────────
export async function loadInstitution(
  supabase: SupabaseClient,
  email: string,
): Promise<InstitutionData> {
  const [wsRes, profileRes, deptRes, spendRes, alertRes] = await Promise.all([
    supabase.from("workspaces").select("id, name, primary_color, secondary_color, subscription_status, subscription_current_period_end").single(),
    supabase.from("profiles").select("*").single(),
    supabase.from("departments").select("*").order("name"),
    supabase.from("spend_entries").select("*").order("spent_on", { ascending: false }),
    supabase.from("alerts").select("*").eq("type", "budget_80").order("created_at", { ascending: false }),
  ]);

  for (const [name, res] of Object.entries({ wsRes, profileRes, deptRes, spendRes, alertRes })) {
    if ((res as { error?: { message: string } | null }).error) {
      console.error(`[db] loadInstitution: ${name} failed`, { error: (res as { error: { message: string } }).error.message, email });
    }
  }

  const departments: Department[] = (deptRes.data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    monthlyBudgetUsd: Number(r.monthly_budget_usd),
  }));

  const spend: SpendEntry[] = (spendRes.data ?? []).map((r) => ({
    id: r.id as string,
    departmentId: r.department_id as string,
    tool: r.tool as string,
    amountUsd: Number(r.amount_usd),
    spentOn: r.spent_on as string,
    note: (r.note as string | null) ?? null,
    source: r.source as string,
  }));

  const alerts: InstitutionAlert[] = (alertRes.data ?? []).map((r) => ({
    id: r.id as string,
    departmentId: (r.department_id as string | null) ?? null,
    title: r.title as string,
    detail: r.detail as string,
    emailTo: r.email_to as string,
    read: Boolean(r.read),
    createdAt: r.created_at as string,
  }));

  return {
    workspaceId: (wsRes.data?.id as string) ?? "",
    workspaceName: wsRes.data?.name ?? "Workspace",
    primaryColor: wsRes.data?.primary_color ?? null,
    secondaryColor: wsRes.data?.secondary_color ?? null,
    subscriptionStatus: (wsRes.data?.subscription_status as InstitutionData["subscriptionStatus"]) ?? "inactive",
    subscriptionCurrentPeriodEnd: (wsRes.data?.subscription_current_period_end as string | null) ?? null,
    profile: {
      displayName: profileRes.data?.display_name ?? "",
      orgName: profileRes.data?.org_name ?? "",
      email,
    },
    departments,
    spend,
    alerts,
  };
}
