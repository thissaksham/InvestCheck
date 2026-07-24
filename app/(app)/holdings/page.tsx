import { HoldingsView, type HoldingGroup, type HoldingRow } from "@/components/holdings/holdings-view";
import { getPortfolioCached } from "@/lib/data-cached";
import { isPriceStale } from "@/lib/staleness";
import { todayIST } from "@/lib/utils";
import { xirr } from "@/lib/xirr";
import type { Position } from "@/lib/valuation";
import type { Transaction } from "@/lib/types";

export default async function HoldingsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const { add } = await searchParams;
  const portfolio = (await getPortfolioCached())!;
  const today = todayIST();

  const toRow = (p: Position): HoldingRow => {
    const txns = portfolio.transactions.filter((t) => t.instrument_id === p.instrument.id);
    const dated = txns.filter((t) => t.type !== "opening");
    const instrumentXirr =
      dated.length > 0
        ? xirr([
            ...dated.map((t) => ({ amount: t.type === "sell" ? Number(t.amount) : -Number(t.amount), date: t.date })),
            { amount: p.value, date: today },
          ])
        : null;
    return {
      id: p.instrument.id,
      name: p.instrument.name,
      type: p.instrument.type,
      currency: p.instrument.currency,
      identifier: p.instrument.identifier,
      source: p.instrument.source,
      units: p.units,
      avgCost: p.avgCost,
      invested: p.invested,
      price: p.price,
      priceInr: p.instrument.currency === "USD" && p.price != null && portfolio.fx ? p.price * portfolio.fx.rate : null,
      priceDate: p.priceDate,
      priceStale: p.priceDate != null && p.priceSource != null && isPriceStale(p.priceDate, p.priceSource, today),
      fxMissing: p.fxMissing,
      value: p.value,
      unrealised: p.unrealised,
      ret: p.ret,
      weight: p.weight,
      realized: p.realized,
      instrumentXirr,
      spark: (portfolio.priceHistory.get(p.instrument.id) ?? []).map((x) => x.price),
    };
  };

  const positions = portfolio.positions.filter((p) => p.instrument.is_active);
  // groups (§4.3): the two stock groups derive from currency
  const groups: HoldingGroup[] = [
    { key: "stock", label: "Stocks · India", rows: positions.filter((p) => p.instrument.type === "stock" && p.instrument.currency === "INR").map(toRow) },
    { key: "stock-us", label: "Stocks · US", rows: positions.filter((p) => p.instrument.type === "stock" && p.instrument.currency === "USD").map(toRow) },
    { key: "etf", label: "ETFs", rows: positions.filter((p) => p.instrument.type === "etf").map(toRow) },
    { key: "mutual_fund", label: "Mutual Funds", rows: positions.filter((p) => p.instrument.type === "mutual_fund").map(toRow) },
    { key: "nps", label: "NPS", rows: positions.filter((p) => p.instrument.type === "nps").map(toRow) },
  ];

  const txns = portfolio.transactions.map((t: Transaction) => ({
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

  const epf =
    portfolio.epfEntries.length > 0
      ? { balance: portfolio.epf.combined.balance, contributions: portfolio.epf.combined.contributions }
      : null;

  return <HoldingsView groups={groups} txns={txns} epf={epf} initialAddOpen={add === "1"} />;
}
