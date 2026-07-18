import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getPortfolioCached } from "@/lib/data-cached";
import { getSessionUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/login");

  const [portfolio, profileRes] = await Promise.all([
    getPortfolioCached(),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);
  if (!portfolio) redirect("/login");

  // 5 most-recently-logged instruments first (§5)
  const byCreated = [...portfolio.transactions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const recentIds: string[] = [];
  for (const t of byCreated) {
    if (!recentIds.includes(t.instrument_id)) recentIds.push(t.instrument_id);
    if (recentIds.length === 5) break;
  }

  const quickAdd = {
    instruments: portfolio.instruments
      .filter((i) => i.is_active)
      .map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        currency: i.currency,
        price: portfolio.latestPrices.get(i.id)?.price ?? null,
        priceDate: portfolio.latestPrices.get(i.id)?.date ?? null,
      })),
    recentIds,
    fxRate: portfolio.fx?.rate ?? null,
    hasAnyTxn: portfolio.transactions.length > 0,
  };

  return (
    <AppShell
      displayName={profileRes.data?.display_name ?? user.email ?? null}
      lastFetchedAt={portfolio.lastFetchedAt}
      quickAdd={quickAdd}
    >
      {children}
    </AppShell>
  );
}
