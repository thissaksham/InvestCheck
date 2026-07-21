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

  return (
    <RetirementView
      epfEntries={portfolio.epfEntries}
      epf={portfolio.epf}
      nps={nps}
      recurring={(recurring ?? []) as EpfRecurring[]}
      initialAddOpen={add === "1"}
    />
  );
}
