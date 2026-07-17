import { TransactionsView, type LedgerTxn } from "@/components/transactions/transactions-view";
import { getPortfolioCached } from "@/lib/data-cached";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ instrument?: string }>;
}) {
  const { instrument: instrumentFilter } = await searchParams;
  const portfolio = (await getPortfolioCached())!;
  const nameById = new Map(portfolio.instruments.map((i) => [i.id, i]));

  const txns: LedgerTxn[] = portfolio.transactions.map((t) => {
    const instrument = nameById.get(t.instrument_id);
    return {
      id: t.id,
      instrument_id: t.instrument_id,
      instrument_name: instrument?.name ?? "?",
      currency: instrument?.currency ?? "INR",
      date: t.date,
      type: t.type,
      units: Number(t.units),
      amount: Number(t.amount),
      amount_usd: t.amount_usd != null ? Number(t.amount_usd) : null,
      note: t.note,
    };
  });

  return <TransactionsView txns={txns} initialInstrument={instrumentFilter ?? null} />;
}
