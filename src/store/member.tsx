"use client";

/**
 * Member data store. A member holds only their own slice — the projects they're
 * assigned to, their connected AI accounts, usage, and budget requests. Usage is
 * metered through the `use_tokens` RPC (standing in for Tokeville's gateway);
 * a realtime subscription keeps budgets, requests, and usage in sync.
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
import { loadMemberDashboard } from "@/lib/db";
import {
  type BudgetRequest,
  type ConnectedAccount,
  type ActivityEntry,
  type MemberData,
  type Profile,
  type ProviderId,
  type ProviderOption,
  type SubAccount,
} from "@/lib/data";
import { tok } from "@/lib/format";

interface Toast {
  id: string;
  title: string;
  detail: string;
  tone: "gold" | "positive" | "danger";
}

interface State {
  workspaceName: string;
  projects: SubAccount[];
  connectedAccounts: ConnectedAccount[];
  internalProviders: ProviderOption[];
  requests: BudgetRequest[];
  activity: ActivityEntry[];
  profile: Profile;
  toasts: Toast[];
  primaryColor: string;
  secondaryColor: string;
}

type Action =
  | { type: "HYDRATE"; data: MemberData }
  | { type: "TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; id: string }
  | { type: "SET_COLORS"; primaryColor: string; secondaryColor: string };

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        workspaceName: action.data.workspaceName,
        projects: action.data.projects,
        connectedAccounts: action.data.connectedAccounts,
        internalProviders: action.data.internalProviders,
        requests: action.data.requests,
        activity: action.data.activity,
      };
    case "TOAST":
      return { ...state, toasts: [action.toast, ...state.toasts] };
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "SET_COLORS":
      return { ...state, primaryColor: action.primaryColor, secondaryColor: action.secondaryColor };
    default:
      return state;
  }
}

interface MemberContext {
  state: State;
  /** Current member's user id — used to scope per-user client storage. */
  userId: string;
  updateColors: (args: { primaryColor: string; secondaryColor: string }) => void;
  useAI: (args: {
    subAccountId: string;
    provider: string;
    label: string;
    amount: number;
  }) => Promise<void>;
  connectAccount: (provider: ProviderId) => Promise<void>;
  requestBudget: (args: {
    subAccountId: string;
    amount: number;
    message: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  dismissToast: (id: string) => void;
}

const Ctx = createContext<MemberContext | null>(null);

export function MemberProvider({
  initial,
  userId,
  workspaceId,
  children,
}: {
  initial: MemberData;
  userId: string;
  workspaceId: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    workspaceName: initial.workspaceName,
    projects: initial.projects,
    connectedAccounts: initial.connectedAccounts,
    internalProviders: initial.internalProviders,
    requests: initial.requests,
    activity: initial.activity,
    profile: initial.profile,
    toasts: [],
    primaryColor: initial.primaryColor ?? "#e8b85f",
    secondaryColor: initial.secondaryColor ?? "#c79a45",
  });

  const supabase = useMemo(() => createClient(), []);
  const email = initial.profile.email;

  const refetch = useMemo(
    () => async () => {
      const data = await loadMemberDashboard(supabase, email);
      dispatch({ type: "HYDRATE", data });
    },
    [supabase, email],
  );

  // Realtime: RLS limits delivery to this member's own rows.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const debounced = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refetch, 250);
    };
    const channel = supabase
      .channel(`member-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sub_accounts" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_requests" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "providers" }, debounced)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, refetch]);

  // Load member color preference from localStorage on mount
  useEffect(() => {
    const primary = localStorage.getItem("tokeville-member-primary");
    const secondary = localStorage.getItem("tokeville-member-secondary");
    if (primary && secondary) {
      dispatch({ type: "SET_COLORS", primaryColor: primary, secondaryColor: secondary });
    }
  }, []);

  const value = useMemo<MemberContext>(() => {
    const toast = (t: Toast) => dispatch({ type: "TOAST", toast: t });

    return {
      state,
      userId,
      updateColors: ({ primaryColor, secondaryColor }) => {
        localStorage.setItem("tokeville-member-primary", primaryColor);
        localStorage.setItem("tokeville-member-secondary", secondaryColor);
        dispatch({ type: "SET_COLORS", primaryColor, secondaryColor });
      },
      useAI: async ({ subAccountId, provider, label, amount }) => {
        const project = state.projects.find((p) => p.id === subAccountId);
        if (!project) return;
        const remaining = project.tokenBudget - project.tokensUsed;
        if (amount > remaining) {
          toast({
            id: uid("toast"),
            title: "Not enough budget",
            detail: `Only ${tok(remaining)} left on ${project.name}`,
            tone: "danger",
          });
          return;
        }
        const { error } = await supabase.rpc("use_tokens", {
          p_sub_account: subAccountId,
          p_amount: amount,
          p_provider: provider,
          p_detail: `${label} · metered via Tokeville`,
        });
        if (error) {
          toast({ id: uid("toast"), title: "Request failed", detail: error.message, tone: "danger" });
          return;
        }
        toast({
          id: uid("toast"),
          title: `${tok(amount)} metered`,
          detail: `${label} · ${project.name}`,
          tone: "gold",
        });
        refetch();
      },

      connectAccount: async (provider) => {
        const { error } = await supabase.from("connected_accounts").insert({
          workspace_id: workspaceId,
          user_id: userId,
          provider_key: provider,
          account_email: email,
        });
        if (error) {
          toast({ id: uid("toast"), title: "Couldn't connect", detail: error.message, tone: "danger" });
          return;
        }
        toast({
          id: uid("toast"),
          title: "Account connected",
          detail: `${email} linked — usage now meters through Tokeville`,
          tone: "positive",
        });
        refetch();
      },

      requestBudget: async ({ subAccountId, amount, message }) => {
        const { error } = await supabase.from("budget_requests").insert({
          workspace_id: workspaceId,
          sub_account_id: subAccountId,
          member_id: userId,
          amount_tokens: amount,
          message,
        });
        if (error) {
          toast({ id: uid("toast"), title: "Couldn't send request", detail: error.message, tone: "danger" });
          return;
        }
        toast({
          id: uid("toast"),
          title: "Request sent to admin",
          detail: `Asked for ${tok(amount)} more`,
          tone: "gold",
        });
        refetch();
      },

      signOut: async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      },
      dismissToast: (id) => dispatch({ type: "DISMISS_TOAST", id }),
    };
  }, [state, supabase, email, userId, workspaceId, refetch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMember(): MemberContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMember must be used within MemberProvider");
  return ctx;
}
