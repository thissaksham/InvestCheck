import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";
import { useToast } from "./Toast";
import { MutualFund, FixedDeposit, Stock, NpsHolding, EpfAccount, Transaction, LedgerAssetType } from "./types";

// Weighted average cost from the transaction log (source of truth).
// Buys move the average, sells reduce units at the same average.
export function recalculateAsset(transactions: Transaction[]) {
  let currentUnits = 0;
  let currentAvg = 0;

  const sortedTxs = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  sortedTxs.forEach((t) => {
    if (t.type === "BUY") {
      const newTotalUnits = currentUnits + t.units;
      if (newTotalUnits > 0) {
        currentAvg = (currentUnits * currentAvg + t.units * t.price) / newTotalUnits;
      }
      currentUnits = newTotalUnits;
    } else {
      currentUnits -= t.units;
    }
  });

  return {
    units: Math.max(0, currentUnits),
    avgPrice: currentUnits > 0 ? currentAvg : 0,
  };
}

const toTransaction = (row: any): Transaction => ({
  id: row.id,
  date: row.date,
  units: Number(row.units),
  price: Number(row.price),
  type: row.type,
});

const isoDate = (d: string) => d.slice(0, 10);

const LEDGER_TABLES: Record<LedgerAssetType, { table: string; dbType: string }> = {
  MF: { table: "mutual_funds", dbType: "MF" },
  Stocks: { table: "stocks", dbType: "STOCK" },
  NPS: { table: "nps_holdings", dbType: "NPS" },
};

export function useInvestments() {
  const { user } = useAuth();
  const toast = useToast();
  const [rawMfs, setRawMfs] = useState<MutualFund[]>([]);
  const [mfs, setMfs] = useState<MutualFund[]>([]);
  const [fds, setFds] = useState<FixedDeposit[]>([]);
  const [rawStocks, setRawStocks] = useState<Stock[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [nps, setNps] = useState<NpsHolding[]>([]);
  const [epfs, setEpfs] = useState<EpfAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setRawMfs([]);
      setMfs([]);
      setFds([]);
      setRawStocks([]);
      setStocks([]);
      setNps([]);
      setEpfs([]);
      setLoading(false);
      return;
    }

    try {
      const [mfRes, stockRes, fdRes, npsRes, epfRes, txRes] = await Promise.all([
        supabase.from("mutual_funds").select("*").order("created_at"),
        supabase.from("stocks").select("*").order("created_at"),
        supabase.from("fixed_deposits").select("*").order("created_at"),
        supabase.from("nps_holdings").select("*").order("created_at"),
        supabase.from("epf_accounts").select("*").order("created_at"),
        supabase.from("transactions").select("*").order("date"),
      ]);
      const firstError = mfRes.error || stockRes.error || fdRes.error || npsRes.error || epfRes.error || txRes.error;
      if (firstError) throw firstError;

      const txsByAsset = new Map<string, Transaction[]>();
      (txRes.data || []).forEach((row) => {
        const list = txsByAsset.get(row.asset_id) || [];
        list.push(toTransaction(row));
        txsByAsset.set(row.asset_id, list);
      });

      setRawMfs(
        (mfRes.data || []).map((row) => {
          const transactions = txsByAsset.get(row.id) || [];
          const { units, avgPrice } = recalculateAsset(transactions);
          return {
            id: row.id,
            amc: row.amc,
            scheme: row.scheme,
            schemeCode: row.scheme_code || undefined,
            isin: row.isin || undefined,
            folio: row.folio || "",
            type: row.type,
            units,
            avgNav: avgPrice,
            currentNav: avgPrice,
            transactions,
          };
        })
      );

      setRawStocks(
        (stockRes.data || []).map((row) => {
          const transactions = txsByAsset.get(row.id) || [];
          const { units, avgPrice } = recalculateAsset(transactions);
          return {
            id: row.id,
            symbol: row.symbol,
            name: row.name,
            isin: row.isin || "",
            quantity: units,
            avgPrice,
            currentPrice: avgPrice,
            transactions,
          };
        })
      );

      setNps(
        (npsRes.data || []).map((row) => {
          const transactions = txsByAsset.get(row.id) || [];
          const { units, avgPrice } = recalculateAsset(transactions);
          const latestNav = row.latest_nav ? Number(row.latest_nav) : undefined;
          return {
            id: row.id,
            scheme: row.scheme,
            pran: row.pran || undefined,
            tier: row.tier,
            isin: row.isin || undefined,
            units,
            avgNav: avgPrice,
            currentNav: latestNav ?? avgPrice,
            latestNav,
            transactions,
          };
        })
      );

      setEpfs(
        (epfRes.data || []).map((row) => ({
          id: row.id,
          name: row.name,
          balance: Number(row.balance),
          contributed: row.contributed !== null ? Number(row.contributed) : undefined,
          asOf: row.as_of || undefined,
        }))
      );

      setFds(
        (fdRes.data || []).map((row) => {
          const principal = Number(row.principal);
          const interestRate = Number(row.interest_rate);
          const start = new Date(row.start_date).getTime();
          const end = new Date(row.maturity_date).getTime();
          const t = (end - start) / (1000 * 60 * 60 * 24 * 365);
          const n = row.compounding_frequency === "Monthly" ? 12 : row.compounding_frequency === "Yearly" ? 1 : 4;
          const maturityAmount = principal * Math.pow(1 + interestRate / 100 / n, n * t);
          return {
            id: row.id,
            bankName: row.bank_name,
            principal,
            interestRate,
            startDate: row.start_date,
            maturityDate: row.maturity_date,
            compoundingFrequency: row.compounding_frequency,
            maturityAmount,
          };
        })
      );
    } catch (error: any) {
      console.error("Failed to load portfolio:", error);
      toast(`Failed to load portfolio: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Fetch latest NAVs when the base MF list changes; keep any price already fetched.
  useEffect(() => {
    let isMounted = true;

    const fetchNavs = async () => {
      const navUpdates = await Promise.all(
        rawMfs.map(async (mf) => {
          if (mf.schemeCode) {
            try {
              // Add timestamp to bypass browser cache
              const res = await fetch(`https://api.mfapi.in/mf/${mf.schemeCode}?t=${Date.now()}`);
              const json = await res.json();
              if (json.data && json.data.length > 0) {
                return { id: mf.id, currentNav: parseFloat(json.data[0].nav) };
              }
            } catch (err) {
              console.error(`Failed to fetch NAV for ${mf.schemeCode}`, err);
            }
          }
          return { id: mf.id, currentNav: null };
        })
      );

      if (isMounted) {
        setMfs((current) =>
          rawMfs.map((mf) => {
            const update = navUpdates.find((u) => u.id === mf.id);
            const previous = current.find((m) => m.id === mf.id);
            return { ...mf, currentNav: update?.currentNav ?? previous?.currentNav ?? mf.avgNav };
          })
        );
      }
    };

    setMfs(rawMfs);
    if (rawMfs.length > 0) fetchNavs();

    return () => {
      isMounted = false;
    };
  }, [rawMfs]);

  // Fetch latest stock prices when the base stock list changes.
  useEffect(() => {
    let isMounted = true;

    const fetchPrices = async () => {
      const priceUpdates = await Promise.all(
        rawStocks.map(async (stock) => {
          if (stock.symbol) {
            try {
              // Add timestamp to Yahoo URL to bypass their cache
              const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?interval=1d&range=1d&t=${Date.now()}`;
              const res = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`, {
                signal: AbortSignal.timeout(8000),
              });
              const json = await res.json();
              if (json.chart?.result?.[0]?.meta?.regularMarketPrice) {
                return { id: stock.id, currentPrice: json.chart.result[0].meta.regularMarketPrice };
              }
            } catch (err: any) {
              if (err.name !== "AbortError" && err.name !== "TimeoutError") {
                console.error(`Failed to fetch price for ${stock.symbol}`, err);
              }
            }
          }
          return { id: stock.id, currentPrice: null };
        })
      );

      if (isMounted) {
        setStocks((current) =>
          rawStocks.map((stock) => {
            const update = priceUpdates.find((u) => u.id === stock.id);
            const previous = current.find((s) => s.id === stock.id);
            return { ...stock, currentPrice: update?.currentPrice ?? previous?.currentPrice ?? stock.avgPrice };
          })
        );
      }
    };

    setStocks(rawStocks);
    if (rawStocks.length > 0) fetchPrices();

    return () => {
      isMounted = false;
    };
  }, [rawStocks]);

  const insertInitialBuy = async (dbType: string, assetId: string, units: number, price: number, date?: string) => {
    if (units <= 0) return;
    const { error } = await supabase.from("transactions").insert({
      asset_type: dbType,
      asset_id: assetId,
      date: isoDate(date || new Date().toISOString()),
      units,
      price,
      type: "BUY",
    });
    if (error) throw error;
  };

  const addTransaction = async (
    assetType: LedgerAssetType,
    assetId: string,
    units: number,
    price: number,
    date: string,
    type: "BUY" | "SELL"
  ) => {
    const { error } = await supabase.from("transactions").insert({
      asset_type: LEDGER_TABLES[assetType].dbType,
      asset_id: assetId,
      date: isoDate(date),
      units,
      price,
      type,
    });
    if (error) {
      console.error(`Failed to add ${type} transaction:`, error);
      toast(`Failed to save transaction: ${error.message}`);
      return;
    }
    toast("Transaction saved.", "success");
    await fetchAll();
  };

  const addMF = async (mf: Omit<MutualFund, "id">) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("mutual_funds")
        .insert({
          amc: mf.amc,
          scheme: mf.scheme,
          scheme_code: mf.schemeCode || null,
          isin: mf.isin || null,
          folio: mf.folio || null,
          type: mf.type,
        })
        .select("id")
        .single();
      if (error) throw error;
      await insertInitialBuy("MF", data.id, mf.units, mf.avgNav, mf.date);
      toast("Mutual fund added.", "success");
      await fetchAll();
    } catch (error: any) {
      console.error("Failed to add Mutual Fund:", error);
      toast(`Failed to add Mutual Fund: ${error.message}`);
    }
  };

  const addFD = async (fd: Omit<FixedDeposit, "id">) => {
    if (!user) return;
    const { error } = await supabase.from("fixed_deposits").insert({
      bank_name: fd.bankName,
      principal: fd.principal,
      interest_rate: fd.interestRate,
      start_date: isoDate(fd.startDate),
      maturity_date: isoDate(fd.maturityDate),
      compounding_frequency: fd.compoundingFrequency || "Quarterly",
    });
    if (error) {
      console.error("Failed to add Fixed Deposit:", error);
      toast(`Failed to add Fixed Deposit: ${error.message}`);
      return;
    }
    toast("Fixed deposit added.", "success");
    await fetchAll();
  };

  const addStock = async (stock: Omit<Stock, "id">) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("stocks")
        .insert({
          symbol: stock.symbol,
          name: stock.name,
          isin: stock.isin || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await insertInitialBuy("STOCK", data.id, stock.quantity, stock.avgPrice, stock.date);
      toast("Stock added.", "success");
      await fetchAll();
    } catch (error: any) {
      console.error("Failed to add Stock:", error);
      toast(`Failed to add Stock: ${error.message}`);
    }
  };

  const addNPS = async (holding: Omit<NpsHolding, "id"> & { date?: string }) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("nps_holdings")
        .insert({
          scheme: holding.scheme,
          pran: holding.pran || null,
          tier: holding.tier,
          isin: holding.isin || null,
          latest_nav: holding.latestNav || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await insertInitialBuy("NPS", data.id, holding.units, holding.avgNav, holding.date);
      toast("NPS holding added.", "success");
      await fetchAll();
    } catch (error: any) {
      console.error("Failed to add NPS holding:", error);
      toast(`Failed to add NPS holding: ${error.message}`);
    }
  };

  const updateNpsNav = async (npsId: string, nav: number) => {
    const { error } = await supabase.from("nps_holdings").update({ latest_nav: nav }).eq("id", npsId);
    if (error) {
      console.error("Failed to update NPS NAV:", error);
      toast(`Failed to update NAV: ${error.message}`);
      return;
    }
    toast("NAV updated.", "success");
    await fetchAll();
  };

  const addEPF = async (epf: Omit<EpfAccount, "id">) => {
    if (!user) return;
    const { error } = await supabase.from("epf_accounts").insert({
      name: epf.name,
      balance: epf.balance,
      contributed: epf.contributed ?? null,
      as_of: epf.asOf ? isoDate(epf.asOf) : isoDate(new Date().toISOString()),
    });
    if (error) {
      console.error("Failed to add EPF account:", error);
      toast(`Failed to add EPF account: ${error.message}`);
      return;
    }
    toast("EPF account added.", "success");
    await fetchAll();
  };

  const updateEPF = async (epfId: string, balance: number, contributed?: number) => {
    const { error } = await supabase
      .from("epf_accounts")
      .update({ balance, contributed: contributed ?? null, as_of: isoDate(new Date().toISOString()) })
      .eq("id", epfId);
    if (error) {
      console.error("Failed to update EPF account:", error);
      toast(`Failed to update EPF: ${error.message}`);
      return;
    }
    toast("EPF balance updated.", "success");
    await fetchAll();
  };

  const editTransaction = async (
    _assetType: LedgerAssetType,
    _assetId: string,
    transactionId: string,
    newUnits: number,
    newPrice: number,
    date: string,
    type: "BUY" | "SELL"
  ) => {
    const { error } = await supabase
      .from("transactions")
      .update({ units: newUnits, price: newPrice, date: isoDate(date), type })
      .eq("id", transactionId);
    if (error) {
      console.error("Failed to edit transaction:", error);
      toast(`Failed to edit transaction: ${error.message}`);
      return;
    }
    toast("Transaction updated.", "success");
    await fetchAll();
  };

  const deleteTransaction = async (_assetType: LedgerAssetType, _assetId: string, transactionId: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
    if (error) {
      console.error("Failed to delete transaction:", error);
      throw error;
    }
    await fetchAll();
  };

  const deleteAsset = async (assetType: InvestmentTypeForDelete, assetId: string) => {
    const table =
      assetType === "MF" ? "mutual_funds" :
      assetType === "Stocks" ? "stocks" :
      assetType === "NPS" ? "nps_holdings" :
      assetType === "EPF" ? "epf_accounts" : "fixed_deposits";
    try {
      if (assetType === "MF" || assetType === "Stocks" || assetType === "NPS") {
        const { error: txError } = await supabase.from("transactions").delete().eq("asset_id", assetId);
        if (txError) throw txError;
      }
      const { error } = await supabase.from(table).delete().eq("id", assetId);
      if (error) throw error;
    } catch (error: any) {
      console.error("Failed to delete asset:", error);
      throw error;
    }
    await fetchAll();
  };

  return {
    mfs, fds, stocks, nps, epfs, loading,
    addMF, addFD, addStock, addNPS, addEPF,
    updateNpsNav, updateEPF,
    addTransaction, editTransaction, deleteTransaction, deleteAsset,
  };
}

type InvestmentTypeForDelete = "MF" | "Stocks" | "FD" | "NPS" | "EPF";
