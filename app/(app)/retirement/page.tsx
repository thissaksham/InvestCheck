import { redirect } from "next/navigation";
import { RetirementView, type NpsRow } from "@/components/retirement/retirement-view";
import { getPortfolioCached } from "@/lib/data-cached";
import { getSessionUser } from "@/lib/supabase/server";
import type { EpfRecurring } from "@/lib/types";

export default async function RetirementPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const { add } = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/login");
  const portfolio = (await getPortfolioCached())!;

  const { data: recurring } = await supabase
    .from("epf_recurring")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at");

  const nps: NpsRow[] = portfolio.positions
    .filter((p) => p.instrument.type === "nps" && p.instrument.is_active)
    .map((p) => ({
      id: p.instrument.id,
      name: p.instrument.name,
      units: p.units,
      nav: p.price,
      navDate: p.priceDate,
      value: p.value,
      invested: p.invested,
    }));

  const npsIds = new Set(nps.map((n) => n.id));
  const npsTxns = portfolio.transactions
    .filter((t) => npsIds.has(t.instrument_id))
    .map((t) => ({
      id: t.id,
      instrument_id: t.instrument_id,
      date: t.date,
      type: t.type,
      units: Number(t.units),
      amount: Number(t.amount),
      amount_usd: t.amount_usd != null ? Number(t.amount_usd) : null,
      contributor: t.contributor,
      note: t.note,
    }));

  return (
    <RetirementView
      epfEntries={portfolio.epfEntries}
      epf={portfolio.epf}
      nps={nps}
      npsTxns={npsTxns}
      recurring={(recurring ?? []) as EpfRecurring[]}
      initialAddOpen={add === "1"}
    />
  );
}
