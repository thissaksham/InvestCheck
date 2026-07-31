import { ReconcileView } from "@/components/reconcile/reconcile-view";
import { getPortfolioCached } from "@/lib/data-cached";
import type { LedgerTxn } from "@/lib/cas";

export default async function ReconcilePage() {
  const portfolio = (await getPortfolioCached())!;

  // The CAS date isn't known until the paste is parsed, so ship the ledger and
  // rebuild the position for whatever date the statement covers.
  const instruments = portfolio.instruments
    .filter((i) => i.is_active)
    .map((i) => ({ id: i.id, name: i.name }));
  const txns: LedgerTxn[] = portfolio.transactions.map((t) => ({
    instrument_id: t.instrument_id,
    date: t.date,
    type: t.type,
    units: Number(t.units),
  }));

  return <ReconcileView instruments={instruments} txns={txns} />;
}
