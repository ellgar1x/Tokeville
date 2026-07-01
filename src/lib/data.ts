/**
 * Domain types for the Tokeville app. Tokens are the currency; every figure is
 * a token amount, with USD derived from the treasury exchange rate.
 *
 * Data is per-user and persisted in Supabase (see src/lib/db.ts for the row
 * shapes and mappers). These are the normalized shapes the UI consumes.
 */

export type ProviderId = "anthropic" | "openai" | "google" | "other";

export interface ProviderSpend {
  id: string;
  /** Built-in ProviderId or a custom internal provider key. */
  key: string;
  name: string;
  models: string;
  tokens: number;
  changeMoM: number;
  isCustom: boolean;
  color: string;
}

/** A model/provider a member can meter against. */
export interface ProviderOption {
  key: string;
  name: string;
  models: string;
  color: string;
  isCustom: boolean;
}

export type AccountType = "Team" | "Project" | "Client" | "Contractor";

export interface SubAccount {
  id: string;
  name: string;
  type: AccountType;
  owner: string;
  initials: string;
  tokenBudget: number;
  tokensUsed: number;
  autoTopup: boolean;
  autoTopupAmount: number;
}

export type ActivityType = "deposit" | "allocation" | "spend" | "transfer";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  tokens: number;
  provider?: string | null;
  time: string;
  createdAt: string;
}

export interface Wallet {
  balanceTokens: number;
  depositedTokens: number;
  projectedMonthTokens: number;
  change24h: number;
  dailySpend: number[];
  /** Derived: sum of provider token spend, month to date. */
  monthToDateTokens: number;
  /** Derived: sum of sub-account budgets. */
  allocatedTokens: number;
}

export interface Profile {
  displayName: string;
  orgName: string;
  email: string;
}

// ─── Institution account type (manual AI-spend tracking, USD) ────────────────
export interface Department {
  id: string;
  name: string;
  monthlyBudgetUsd: number;
}

export interface SpendEntry {
  id: string;
  departmentId: string;
  tool: string;
  amountUsd: number;
  spentOn: string; // ISO date
  note: string | null;
  source: string; // 'manual' | 'csv'
}

export interface InstitutionAlert {
  id: string;
  departmentId: string | null;
  title: string;
  detail: string;
  emailTo: string;
  read: boolean;
  createdAt: string;
}

export interface InstitutionData {
  workspaceId: string;
  workspaceName: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  subscriptionStatus: "inactive" | "active" | "canceled";
  subscriptionCurrentPeriodEnd: string | null;
  profile: Profile;
  departments: Department[];
  spend: SpendEntry[];
  alerts: InstitutionAlert[];
}

export type Role = "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export interface WorkspaceMember {
  id: string;
  userId: string | null;
  role: Role;
  subAccountId: string | null;
  displayName: string;
  email: string;
}

export interface Invite {
  id: string;
  email: string;
  subAccountId: string | null;
  status: "pending" | "accepted";
}

export interface Alert {
  id: string;
  subAccountId: string | null;
  type: "low_balance" | "auto_topup";
  title: string;
  detail: string;
  emailSent: boolean;
  emailTo: string;
  read: boolean;
  time: string;
}

export interface DashboardData {
  workspace: Workspace;
  wallet: Wallet;
  providers: ProviderSpend[];
  accounts: SubAccount[];
  activity: ActivityEntry[];
  alerts: Alert[];
  profile: Profile;
}

export interface ConnectedAccount {
  id: string;
  providerKey: ProviderId;
  accountEmail: string;
  status: string;
}

export interface BudgetRequest {
  id: string;
  subAccountId: string;
  subAccountName: string;
  amountTokens: number;
  message: string;
  status: "pending" | "approved" | "declined";
  adminResponse: string;
  memberName?: string;
  time: string;
}

/** What a Member sees — only their projects, never the treasury. */
export interface MemberData {
  workspaceName: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  projects: SubAccount[];
  connectedAccounts: ConnectedAccount[];
  internalProviders: ProviderOption[];
  requests: BudgetRequest[];
  activity: ActivityEntry[];
  profile: Profile;
}
