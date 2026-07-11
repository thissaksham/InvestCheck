import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";
import { MutualFund, FixedDeposit, Stock, Transaction } from "./types";

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

export function useInvestments() {
  const { user } = useAuth();
  const [rawMfs, setRawMfs] = useState<MutualFund[]>([]);
  const [mfs, setMfs] = useState<MutualFund[]>([]);
  const [fds, setFds] = useState<FixedDeposit[]>([]);
  const [rawStocks, setRawStocks] = useState<Stock[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setRawMfs([]);
      setMfs([]);
      setFds([]);
      setRawStocks([]);
      setStocks([]);
      setLoading(false);
      return;
    }

    try {
      const [mfRes, stockRes, fdRes, txRes] = await Promise.all([
        supabase.from("mutual_funds").select("*").order("created_at"),
        supabase.from("stocks").select("*").order("created_at"),
        supabase.from("fixed_deposits").select("*").order("created_at"),
        supabase.from("transactions").select("*").order("date"),
      ]);
      const firstError = mfRes.error || stockRes.error || fdRes.error || txRes.error;
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
      alert(`Failed to load portfolio: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  const addTransaction = async (
    assetType: "MF" | "Stocks",
    assetId: string,
    units: number,
    price: number,
    date: string,
    type: "BUY" | "SELL"
  ) => {
    const { error } = await supabase.from("transactions").insert({
      asset_type: assetType === "MF" ? "MF" : "STOCK",
      asset_id: assetId,
      date: isoDate(date),
      units,
      price,
      type,
    });
    if (error) {
      console.error(`Failed to add ${type} transaction:`, error);
      alert(`Failed to save transaction: ${error.message}`);
      return;
    }
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

      if (mf.units > 0) {
        const { error: txError } = await supabase.from("transactions").insert({
          asset_type: "MF",
          asset_id: data.id,
          date: isoDate(mf.date || new Date().toISOString()),
          units: mf.units,
          price: mf.avgNav,
          type: "BUY",
        });
        if (txError) throw txError;
      }
      await fetchAll();
    } catch (error: any) {
      console.error("Failed to add Mutual Fund:", error);
      alert(`Failed to add Mutual Fund: ${error.message}`);
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
      alert(`Failed to add Fixed Deposit: ${error.message}`);
      return;
    }
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

      if (stock.quantity > 0) {
        const { error: txError } = await supabase.from("transactions").insert({
          asset_type: "STOCK",
          asset_id: data.id,
          date: isoDate(stock.date || new Date().toISOString()),
          units: stock.quantity,
          price: stock.avgPrice,
          type: "BUY",
        });
        if (txError) throw txError;
      }
      await fetchAll();
    } catch (error: any) {
      console.error("Failed to add Stock:", error);
      alert(`Failed to add Stock: ${error.message}`);
    }
  };

  const editTransaction = async (
    _assetType: "MF" | "Stocks",
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
      alert(`Failed to edit transaction: ${error.message}`);
      return;
    }
    await fetchAll();
  };

  const deleteTransaction = async (_assetType: "MF" | "Stocks", _assetId: string, transactionId: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
    if (error) {
      console.error("Failed to delete transaction:", error);
      throw error;
    }
    await fetchAll();
  };

  const deleteAsset = async (assetType: "MF" | "Stocks" | "FD", assetId: string) => {
    const table = assetType === "MF" ? "mutual_funds" : assetType === "Stocks" ? "stocks" : "fixed_deposits";
    try {
      if (assetType !== "FD") {
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

  return { mfs, fds, stocks, loading, addMF, addFD, addStock, addTransaction, editTransaction, deleteTransaction, deleteAsset };
}
