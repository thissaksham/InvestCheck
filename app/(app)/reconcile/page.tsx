import { ReconcileView } from "@/components/reconcile/reconcile-view";
import { getPortfolioCached } from "@/lib/data-cached";
import type { AppHolding } from "@/lib/cas";

export default async function ReconcilePage() {
  const portfolio = (await getPortfolioCached())!;
  const holdings: AppHolding[] = portfolio.positions
    .filter((p) => p.instrument.is_active)
    .map((p) => ({ id: p.instrument.id, name: p.instrument.name, units: p.units, value: p.value }));

  return <ReconcileView holdings={holdings} />;
}
