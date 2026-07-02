"use client";

/**
 * Admin data store. Hydrated from Supabase on the server, mutations applied
 * optimistically + persisted, and a realtime subscription keeps the workspace
 * in sync — so when a member spends tokens, the admin sees it live.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { loadDashboard } from "@/lib/db";
import {
  type AccountType,
  type ActivityEntry,
  type Alert,
  type DashboardData,
  type Profile,
  type ProviderSpend,
  type SubAccount,
  type Workspace,
} from "@/lib/data";
import { tok, usd, usdFromTokens } from "@/lib/format";

export type ModalState =
  | { type: "buy" }
  | { type: "allocate"; accountId?: string }
  | { type: "newAccount" }
  | { type: "addProvider" }
  | { type: "invite" }
  | null;

interface Toast {
  id: string;
  title: string;
  detail: string;
  tone: "gold" | "positive" | "danger";
}

interface WalletBase {
  balanceTokens: number;
  depositedTokens: number;
  projectedMonthTokens: number;
  change24h: number;
  dailySpend: number[];
}

interface State {
  workspace: Workspace;
  wallet: WalletBase;
  providers: ProviderSpend[];
  accounts: SubAccount[];
  activity: ActivityEntry[];
  alerts: Alert[];
  profile: Profile;
  modal: ModalState;
  toasts: Toast[];
}

type Action =
  | { type: "OPEN_MODAL"; modal: ModalState }
  | { type: "CLOSE_MODAL" }
  | { type: "FUND"; tokens: number; entry: ActivityEntry }
  | { type: "ALLOCATE"; accountId: string; tokens: number; entry: ActivityEntry }
  | { type: "ADD_ACCOUNT"; account: SubAccount; entry: ActivityEntry }
  | { type: "ADD_PROVIDER"; provider: ProviderSpend }
  | { type: "SET_PROFILE"; displayName: string; orgName: string }
  | { type: "SET_WORKSPACE_COLORS"; primaryColor: string; secondaryColor: string }
  | { type: "SET_AUTOTOPUP"; accountId: string; enabled: boolean; amount: number }
  | { type: "DISMISS_ALERT"; id: string }
  | { type: "HYDRATE"; data: DashboardData }
  | { type: "TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; id: string };

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "OPEN_MODAL":
      return { ...state, modal: action.modal };
    case "CLOSE_MODAL":
      return { ...state, modal: null };
    case "FUND":
      return {
        ...state,
        modal: null,
        wallet: {
          ...state.wallet,
          balanceTokens: state.wallet.balanceTokens + action.tokens,
          depositedTokens: state.wallet.depositedTokens + action.tokens,
        },
        activity: [action.entry, ...state.activity],
      };
    case "ALLOCATE":
      return {
        ...state,
        modal: null,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId
            ? { ...a, tokenBudget: a.tokenBudget + action.tokens }
            : a,
        ),
        activity: [action.entry, ...state.activity],
      };
    case "ADD_ACCOUNT":
      return {
        ...state,
        modal: null,
        accounts: [action.account, ...state.accounts],
        activity: [action.entry, ...state.activity],
      };
    case "ADD_PROVIDER":
      return {
        ...state,
        modal: null,
        providers: [...state.providers, action.provider],
      };
    case "SET_PROFILE":
      return {
        ...state,
        profile: {
          ...state.profile,
          displayName: action.displayName,
          orgName: action.orgName,
        },
      };
    case "SET_WORKSPACE_COLORS":
      return {
        ...state,
        workspace: { ...state.workspace, primaryColor: action.primaryColor, secondaryColor: action.secondaryColor },
      };
    case "SET_AUTOTOPUP":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId
            ? { ...a, autoTopup: action.enabled, autoTopupAmount: action.amount }
            : a,
        ),
      };
    case "DISMISS_ALERT":
      return { ...state, alerts: state.alerts.filter((a) => a.id !== action.id) };
    case "HYDRATE":
      return {
        ...state,
        wallet: {
          balanceTokens: action.data.wallet.balanceTokens,
          depositedTokens: action.data.wallet.depositedTokens,
          projectedMonthTokens: action.data.wallet.projectedMonthTokens,
          change24h: action.data.wallet.change24h,
          dailySpend: action.data.wallet.dailySpend,
        },
        providers: action.data.providers,
        accounts: action.data.accounts,
        activity: action.data.activity,
        alerts: action.data.alerts,
      };
    case "TOAST":
      return { ...state, toasts: [action.toast, ...state.toasts] };
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

interface DerivedWallet extends WalletBase {
  monthToDateTokens: number;
  allocatedTokens: number;
}

interface DemoContext {
  state: Omit<State, "wallet"> & { wallet: DerivedWallet };
  /** Current admin's workspace id — used to scope per-workspace client storage. */
  workspaceId: string;
  unallocated: number;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  buy: (args: { tokens: number; usd: number; method: string }) => Promise<void>;
  allocate: (accountId: string, tokens: number) => Promise<void>;
  createAccount: (args: {
    name: string;
    accountType: AccountType;
    owner: string;
    tokens: number;
  }) => Promise<void>;
  invite: (email: string, subAccountId: string) => Promise<boolean>;
  createProvider: (args: { name: string; models: string; color: string }) => Promise<void>;
  assignProject: (memberUserId: string, subAccountId: string) => Promise<boolean>;
  unassignProject: (memberUserId: string, subAccountId: string) => Promise<void>;
  resolveRequest: (id: string, approve: boolean, response: string) => Promise<void>;
  setAutoTopup: (accountId: string, enabled: boolean, amount: number) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  updateProfile: (args: { displayName: string; orgName: string }) => Promise<void>;
  updateWorkspaceColors: (args: { primaryColor: string; secondaryColor: string }) => Promise<void>;
  resetData: () => Promise<void>;
  signOut: () => Promise<void>;
  notify: (title: string, detail: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
}

const Ctx = createContext<DemoContext | null>(null);

export function DemoProvider({
  initial,
  userId,
  workspaceId,
  children,
}: {
  initial: DashboardData;
  userId: string;
  workspaceId: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    workspace: initial.workspace,
    wallet: {
      balanceTokens: initial.wallet.balanceTokens,
      depositedTokens: initial.wallet.depositedTokens,
      projectedMonthTokens: initial.wallet.projectedMonthTokens,
      change24h: initial.wallet.change24h,
      dailySpend: initial.wallet.dailySpend,
    },
    providers: initial.providers,
    accounts: initial.accounts,
    activity: initial.activity,
    alerts: initial.alerts,
    profile: initial.profile,
    modal: null,
    toasts: [],
  });

  const supabase = useMemo(() => createClient(), []);
  const email = initial.profile.email;

  // Realtime: refetch the workspace whenever its tables change (e.g. a member
  // spends tokens), so the admin's view updates live.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const refetch = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const data = await loadDashboard(supabase, email);
        dispatch({ type: "HYDRATE", data });
      }, 250);
    };
    const channel = supabase
      .channel(`ws-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sub_accounts", filter: `workspace_id=eq.${workspaceId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity", filter: `workspace_id=eq.${workspaceId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `workspace_id=eq.${workspaceId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `workspace_id=eq.${workspaceId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "providers", filter: `workspace_id=eq.${workspaceId}` }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, workspaceId, email]);

  const value = useMemo<DemoContext>(() => {
    const allocatedTokens = state.accounts.reduce((s, a) => s + a.tokenBudget, 0);
    const monthToDateTokens = state.providers.reduce((s, p) => s + p.tokens, 0);
    const balance = state.wallet.balanceTokens;

    const toast = (toast: Toast) => dispatch({ type: "TOAST", toast });
    const errToast = (detail: string) =>
      toast({ id: uid("toast"), title: "Something went wrong", detail, tone: "danger" });

    return {
      state: {
        ...state,
        wallet: { ...state.wallet, monthToDateTokens, allocatedTokens },
      },
      workspaceId,
      unallocated: balance - allocatedTokens,
      openModal: (modal) => dispatch({ type: "OPEN_MODAL", modal }),
      closeModal: () => dispatch({ type: "CLOSE_MODAL" }),

      buy: async ({ tokens, usd: dollars, method }) => {
        const entry: ActivityEntry = {
          id: uid("act"),
          type: "deposit",
          title: "Purchased TOK",
          detail: `Funded with ${method}`,
          tokens,
          provider: null,
          time: "Just now",
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "FUND", tokens, entry });
        toast({
          id: uid("toast"),
          title: `${tok(tokens)} added to treasury`,
          detail: `Purchased for ${usd(dollars, { cents: true })}`,
          tone: "gold",
        });
        const { error: e1 } = await supabase
          .from("wallets")
          .update({
            balance_tokens: balance + tokens,
            deposited_tokens: state.wallet.depositedTokens + tokens,
            updated_at: new Date().toISOString(),
          })
          .eq("workspace_id", workspaceId);
        const { error: e2 } = await supabase.from("activity").insert({
          user_id: userId,
          workspace_id: workspaceId,
          type: "deposit",
          title: entry.title,
          detail: entry.detail,
          tokens,
          provider: null,
        });
        if (e1 || e2) errToast("Your purchase may not have saved. Refresh to check.");
      },

      allocate: async (accountId, tokens) => {
        const account = state.accounts.find((a) => a.id === accountId);
        if (!account) return;
        const entry: ActivityEntry = {
          id: uid("act"),
          type: "allocation",
          title: `Allocated to ${account.name}`,
          detail: `${account.type} budget · ≈ ${usd(usdFromTokens(tokens))}`,
          tokens,
          provider: null,
          time: "Just now",
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "ALLOCATE", accountId, tokens, entry });
        toast({
          id: uid("toast"),
          title: `${tok(tokens)} allocated`,
          detail: `To ${account.name}`,
          tone: "positive",
        });
        const { error: e1 } = await supabase
          .from("sub_accounts")
          .update({ token_budget: account.tokenBudget + tokens })
          .eq("id", accountId);
        const { error: e2 } = await supabase.from("activity").insert({
          user_id: userId,
          workspace_id: workspaceId,
          type: "allocation",
          title: entry.title,
          detail: entry.detail,
          tokens,
          provider: null,
          sub_account_id: accountId,
        });
        if (e1 || e2) errToast("Allocation may not have saved. Refresh to check.");
      },

      createAccount: async ({ name, accountType, owner, tokens }) => {
        const { data, error } = await supabase
          .from("sub_accounts")
          .insert({
            user_id: userId,
            workspace_id: workspaceId,
            name,
            type: accountType,
            owner: owner || "—",
            initials: initials(name),
            token_budget: tokens,
            tokens_used: 0,
          })
          .select()
          .single();
        if (error || !data) {
          errToast("Could not create the account.");
          dispatch({ type: "CLOSE_MODAL" });
          return;
        }
        const account: SubAccount = {
          id: data.id,
          name,
          type: accountType,
          owner: owner || "—",
          initials: initials(name),
          tokenBudget: tokens,
          tokensUsed: 0,
          autoTopup: false,
          autoTopupAmount: 0,
        };
        const entry: ActivityEntry = {
          id: uid("act"),
          type: "allocation",
          title: `Created ${name}`,
          detail: `New ${accountType.toLowerCase()} · ${tok(tokens)} budget`,
          tokens,
          provider: null,
          time: "Just now",
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "ADD_ACCOUNT", account, entry });
        toast({
          id: uid("toast"),
          title: `${name} created`,
          detail: `${tok(tokens)} budget allocated`,
          tone: "positive",
        });
        await supabase.from("activity").insert({
          user_id: userId,
          workspace_id: workspaceId,
          type: "allocation",
          title: entry.title,
          detail: entry.detail,
          tokens,
          provider: null,
          sub_account_id: data.id,
        });
      },

      invite: async (inviteEmail, subAccountId) => {
        const { error } = await supabase.from("invites").insert({
          workspace_id: workspaceId,
          email: inviteEmail,
          sub_account_id: subAccountId,
          role: "member",
        });
        if (error) {
          errToast("Could not create the invite.");
          return false;
        }
        toast({
          id: uid("toast"),
          title: "Invite sent",
          detail: `${inviteEmail} can now sign up as a member`,
          tone: "gold",
        });
        return true;
      },

      createProvider: async ({ name, models, color }) => {
        const key = `custom_${Math.random().toString(36).slice(2, 10)}`;
        const { data, error } = await supabase
          .from("providers")
          .insert({
            user_id: userId,
            workspace_id: workspaceId,
            provider_key: key,
            name,
            models,
            tokens: 0,
            change_mom: 0,
            sort: 100,
            is_custom: true,
            color,
          })
          .select()
          .single();
        if (error || !data) {
          errToast("Could not add the company AI.");
          dispatch({ type: "CLOSE_MODAL" });
          return;
        }
        dispatch({
          type: "ADD_PROVIDER",
          provider: {
            id: data.id,
            key,
            name,
            models,
            tokens: 0,
            changeMoM: 0,
            isCustom: true,
            color,
          },
        });
        toast({
          id: uid("toast"),
          title: "Company AI added",
          detail: `${name} is now available to your team`,
          tone: "gold",
        });
      },

      assignProject: async (memberUserId, subAccountId) => {
        const { error } = await supabase.from("project_members").insert({
          workspace_id: workspaceId,
          user_id: memberUserId,
          sub_account_id: subAccountId,
        });
        if (error) {
          errToast("Could not add to project.");
          return false;
        }
        const name = state.accounts.find((a) => a.id === subAccountId)?.name ?? "project";
        toast({
          id: uid("toast"),
          title: "Added to project",
          detail: `Member can now spend from ${name}`,
          tone: "positive",
        });
        return true;
      },

      unassignProject: async (memberUserId, subAccountId) => {
        const { error } = await supabase
          .from("project_members")
          .delete()
          .eq("user_id", memberUserId)
          .eq("sub_account_id", subAccountId);
        if (error) errToast("Could not remove from project.");
        else
          toast({
            id: uid("toast"),
            title: "Removed from project",
            detail: "Access revoked",
            tone: "positive",
          });
      },

      resolveRequest: async (id, approve, response) => {
        const { error } = await supabase.rpc("resolve_budget_request", {
          p_id: id,
          p_approve: approve,
          p_response: response,
        });
        if (error) {
          errToast("Could not resolve the request.");
          return;
        }
        toast({
          id: uid("toast"),
          title: approve ? "Budget approved" : "Request declined",
          detail: approve ? "Tokens allocated to the project" : "The member was notified",
          tone: approve ? "gold" : "positive",
        });
      },

      setAutoTopup: async (accountId, enabled, amount) => {
        dispatch({ type: "SET_AUTOTOPUP", accountId, enabled, amount });
        const account = state.accounts.find((a) => a.id === accountId);
        toast({
          id: uid("toast"),
          title: enabled ? "Auto top-up on" : "Auto top-up off",
          detail: enabled
            ? `${account?.name ?? "Account"} refills ${tok(amount)} from treasury at 20%`
            : `${account?.name ?? "Account"} won't auto-refill`,
          tone: enabled ? "gold" : "positive",
        });
        const { error } = await supabase
          .from("sub_accounts")
          .update({ auto_topup: enabled, auto_topup_amount: amount })
          .eq("id", accountId);
        if (error) errToast("Auto top-up setting may not have saved.");
      },

      dismissAlert: async (id) => {
        dispatch({ type: "DISMISS_ALERT", id });
        await supabase.from("alerts").update({ read: true }).eq("id", id);
      },

      updateProfile: async ({ displayName, orgName }) => {
        dispatch({ type: "SET_PROFILE", displayName, orgName });
        toast({
          id: uid("toast"),
          title: "Profile updated",
          detail: "Your changes have been saved",
          tone: "positive",
        });
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: displayName, org_name: orgName })
          .eq("id", userId);
        if (error) errToast("Profile may not have saved.");
      },

      updateWorkspaceColors: async ({ primaryColor, secondaryColor }) => {
        dispatch({ type: "SET_WORKSPACE_COLORS", primaryColor, secondaryColor });
        const { error } = await supabase
          .from("workspaces")
          .update({ primary_color: primaryColor, secondary_color: secondaryColor })
          .eq("id", workspaceId);
        if (error) errToast("Colors may not have saved.");
        else toast({ id: uid("toast"), title: "Theme updated", detail: "Your workspace colors have been applied", tone: "positive" });
      },

      resetData: async () => {
        const { error } = await supabase.rpc("reset_user_data");
        if (error) {
          errToast("Could not reset demo data.");
          return;
        }
        window.location.reload();
      },

      signOut: async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      },

      notify: (title, detail, tone = "positive") =>
        toast({ id: uid("toast"), title, detail, tone }),

      dismissToast: (id) => dispatch({ type: "DISMISS_TOAST", id }),
    };
  }, [state, supabase, userId, workspaceId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
