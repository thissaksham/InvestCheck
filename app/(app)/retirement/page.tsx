import { RetirementView, type NpsRow } from "@/components/retirement/retirement-view";
import { getPortfolioCached } from "@/lib/data-cached";

export default async function RetirementPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const { add } = await searchParams;
  const portfolio = (await getPortfolioCached())!;

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
    <RetirementView epfEntries={portfolio.epfEntries} epf={portfolio.epf} nps={nps} initialAddOpen={add === "1"} />
  );
}
