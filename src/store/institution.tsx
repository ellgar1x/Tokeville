"use client";

/**
 * Institution data store. Institution workspaces don't route AI through Tokeville —
 * admins log spend by department in USD, set monthly budgets, and watch a
 * consolidated dashboard. A realtime subscription keeps departments, spend, and
 * budget alerts in sync.
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
import { loadInstitution } from "@/lib/db";
import type {
  Department,
  InstitutionAlert,
  InstitutionData,
  Profile,
  SpendEntry,
} from "@/lib/data";

interface Toast {
  id: string;
  title: string;
  detail: string;
  tone: "gold" | "positive" | "danger";
}

interface State {
  workspaceId: string;
  workspaceName: string;
  profile: Profile;
  departments: Department[];
  spend: SpendEntry[];
  alerts: InstitutionAlert[];
  primaryColor: string | null;
  secondaryColor: string | null;
  toasts: Toast[];
}

type Action =
  | { type: "HYDRATE"; data: InstitutionData }
  | { type: "TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; id: string };

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        workspaceName: action.data.workspaceName,
        departments: action.data.departments,
        spend: action.data.spend,
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

export interface SpendInput {
  departmentId: string;
  tool: string;
  amountUsd: number;
  spentOn: string;
  note?: string;
  source?: string;
}

interface InstitutionContext {
  state: State;
  addDepartment: (name: string, monthlyBudgetUsd: number) => Promise<void>;
  updateDepartment: (id: string, patch: { name?: string; monthlyBudgetUsd?: number }) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  recordSpend: (input: SpendInput) => Promise<boolean>;
  importSpend: (rows: SpendInput[]) => Promise<{ ok: number; failed: number }>;
  markAlertsRead: () => Promise<void>;
  setWorkspaceType: (type: "standard" | "institution") => Promise<void>;
  signOut: () => Promise<void>;
  dismissToast: (id: string) => void;
}

const Ctx = createContext<InstitutionContext | null>(null);

export function InstitutionProvider({
  initial,
  userId,
  children,
}: {
  initial: InstitutionData;
  userId: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    workspaceId: initial.workspaceId,
    workspaceName: initial.workspaceName,
    profile: initial.profile,
    departments: initial.departments,
    spend: initial.spend,
    alerts: initial.alerts,
    primaryColor: initial.primaryColor,
    secondaryColor: initial.secondaryColor,
    toasts: [],
  });

  const supabase = useMemo(() => createClient(), []);
  const email = initial.profile.email;
  const workspaceId = initial.workspaceId;

  const refetch = useMemo(
    () => async () => {
      const data = await loadInstitution(supabase, email);
      dispatch({ type: "HYDRATE", data });
    },
    [supabase, email],
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const debounced = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refetch, 250);
    };
    const channel = supabase
      .channel(`institution-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "spend_entries" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, debounced)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, refetch]);

  const value = useMemo<InstitutionContext>(() => {
    const toast = (t: Omit<Toast, "id">) => dispatch({ type: "TOAST", toast: { id: uid("toast"), ...t } });

    return {
      state,

      addDepartment: async (name, monthlyBudgetUsd) => {
        const { error } = await supabase.from("departments").insert({
          workspace_id: workspaceId,
          name,
          monthly_budget_usd: monthlyBudgetUsd,
        });
        if (error) {
          toast({ title: "Couldn't add department", detail: error.message, tone: "danger" });
          return;
        }
        toast({ title: "Department added", detail: name, tone: "positive" });
        refetch();
      },

      updateDepartment: async (id, patch) => {
        const row: Record<string, unknown> = {};
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.monthlyBudgetUsd !== undefined) row.monthly_budget_usd = patch.monthlyBudgetUsd;
        const { error } = await supabase.from("departments").update(row).eq("id", id);
        if (error) {
          toast({ title: "Couldn't update", detail: error.message, tone: "danger" });
          return;
        }
        refetch();
      },

      deleteDepartment: async (id) => {
        const { error } = await supabase.from("departments").delete().eq("id", id);
        if (error) {
          toast({ title: "Couldn't remove", detail: error.message, tone: "danger" });
          return;
        }
        toast({ title: "Department removed", detail: "Its spend history was cleared too", tone: "gold" });
        refetch();
      },

      recordSpend: async ({ departmentId, tool, amountUsd, spentOn, note, source }) => {
        const { error } = await supabase.rpc("record_spend", {
          p_department_id: departmentId,
          p_tool: tool,
          p_amount_usd: amountUsd,
          p_spent_on: spentOn,
          p_note: note ?? "",
          p_source: source ?? "manual",
        });
        if (error) {
          toast({ title: "Couldn't log spend", detail: error.message, tone: "danger" });
          return false;
        }
        refetch();
        return true;
      },

      importSpend: async (rows) => {
        let ok = 0;
        let failed = 0;
        for (const r of rows) {
          const { error } = await supabase.rpc("record_spend", {
            p_department_id: r.departmentId,
            p_tool: r.tool,
            p_amount_usd: r.amountUsd,
            p_spent_on: r.spentOn,
            p_note: r.note ?? "",
            p_source: "csv",
          });
          if (error) failed += 1;
          else ok += 1;
        }
        await refetch();
        if (ok) toast({ title: `Imported ${ok} ${ok === 1 ? "row" : "rows"}`, detail: failed ? `${failed} skipped` : "All rows logged", tone: failed ? "gold" : "positive" });
        else toast({ title: "Nothing imported", detail: `${failed} rows could not be matched`, tone: "danger" });
        return { ok, failed };
      },

      markAlertsRead: async () => {
        await supabase.from("alerts").update({ read: true }).eq("workspace_id", workspaceId).eq("read", false);
        refetch();
      },

      setWorkspaceType: async (type) => {
        const { error } = await supabase.rpc("set_workspace_type", { p_type: type });
        if (error) {
          toast({ title: "Couldn't switch type", detail: error.message, tone: "danger" });
          return;
        }
        // Full reload so the proxy + server layout pick up the new app_metadata.
        window.location.href = "/";
      },

      signOut: async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      },

      dismissToast: (id) => dispatch({ type: "DISMISS_TOAST", id }),
    };
  }, [state, supabase, workspaceId, userId, refetch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInstitution(): InstitutionContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInstitution must be used within InstitutionProvider");
  return ctx;
}
