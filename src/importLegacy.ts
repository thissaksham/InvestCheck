import { supabase } from "./supabase";

// One-time import of the JSON produced by /export-firebase.html.
// Intended for an empty Supabase account; importing twice duplicates assets.

const isoDate = (d: string | undefined) => (d || new Date().toISOString()).slice(0, 10);

// Legacy docs stored transactions inline; synthesize one BUY if none exist.
function legacyTransactions(item: any, units: number, price: number) {
  const txs = Array.isArray(item.transactions) ? item.transactions : [];
  if (txs.length === 0 && units > 0) {
    return [{ date: item.date || item.lastUpdated, units, price, type: "BUY" }];
  }
  return txs;
}

async function insertAssetWithTxs(
  table: "mutual_funds" | "stocks",
  assetType: "MF" | "STOCK",
  row: Record<string, unknown>,
  txs: any[]
) {
  const { data, error } = await supabase.from(table).insert(row).select("id").single();
  if (error) throw error;
  if (txs.length > 0) {
    const { error: txError } = await supabase.from("transactions").insert(
      txs.map((t) => ({
        asset_type: assetType,
        asset_id: data.id,
        date: isoDate(t.date),
        units: Number(t.units),
        price: Number(t.price),
        type: t.type === "SELL" ? "SELL" : "BUY",
      }))
    );
    if (txError) throw txError;
  }
}

export async function importLegacyData(json: any): Promise<string> {
  const mfs = json.mutual_funds || [];
  const stocks = json.stocks || [];
  const fds = json.fixed_deposits || [];

  for (const mf of mfs) {
    await insertAssetWithTxs(
      "mutual_funds",
      "MF",
      {
        amc: mf.amc || "Unknown",
        scheme: mf.scheme || "Unknown",
        scheme_code: mf.schemeCode || null,
        isin: mf.isin || null,
        folio: mf.folio || null,
        type: mf.type || "Equity",
      },
      legacyTransactions(mf, Number(mf.units) || 0, Number(mf.avgNav) || 0)
    );
  }

  for (const stock of stocks) {
    await insertAssetWithTxs(
      "stocks",
      "STOCK",
      {
        symbol: stock.symbol || "UNKNOWN",
        name: stock.name || stock.symbol || "Unknown",
        isin: stock.isin || null,
      },
      legacyTransactions(stock, Number(stock.quantity) || 0, Number(stock.avgPrice) || 0)
    );
  }

  if (fds.length > 0) {
    const { error } = await supabase.from("fixed_deposits").insert(
      fds.map((fd: any) => ({
        bank_name: fd.bankName || "Unknown",
        principal: Number(fd.principal),
        interest_rate: Number(fd.interestRate) || 0,
        start_date: isoDate(fd.startDate),
        maturity_date: isoDate(fd.maturityDate),
        compounding_frequency: fd.compoundingFrequency || "Quarterly",
      }))
    );
    if (error) throw error;
  }

  const legacyKey = json.user_settings?.casparserApiKey;
  if (legacyKey) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("user_settings").upsert({ user_id: data.user.id, casparser_api_key: legacyKey });
    }
  }

  return `Imported ${mfs.length} mutual funds, ${stocks.length} stocks, ${fds.length} fixed deposits.`;
}
