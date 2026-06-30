import { Suspense } from "react";
import { WalletCard } from "@/components/WalletCard";
import { Kpis } from "@/components/Kpis";
import { SpendByModel } from "@/components/SpendByModel";
import { SubAccounts } from "@/components/SubAccounts";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AlertsBanner } from "@/components/AlertsBanner";
import { DepositBanner } from "@/components/DepositBanner";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <Suspense>
        <DepositBanner />
      </Suspense>
      <AlertsBanner />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <WalletCard />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <SpendByModel />
        </div>
      </div>

      <Kpis />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <SubAccounts compact />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
