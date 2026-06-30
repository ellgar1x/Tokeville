"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SubAccounts } from "@/components/SubAccounts";
import { SearchIcon } from "@/components/icons";

function SubAccountsInner() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  return (
    <div className="space-y-5">
      <label className="relative block max-w-sm">
        <span className="sr-only">Filter accounts</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, owner, or type"
          className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
        />
      </label>
      <SubAccounts query={query} />
    </div>
  );
}

export default function SubAccountsPage() {
  return (
    <Suspense>
      <SubAccountsInner />
    </Suspense>
  );
}
