import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, Timestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { useAuth } from "./AuthContext";
import { MutualFund, FixedDeposit, Stock } from "./types";

export function useInvestments() {
  const { user } = useAuth();
  const [rawMfs, setRawMfs] = useState<MutualFund[]>([]);
  const [mfs, setMfs] = useState<MutualFund[]>([]);
  const [fds, setFds] = useState<FixedDeposit[]>([]);
  const [rawStocks, setRawStocks] = useState<Stock[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) {
      setRawMfs([]);
      setMfs([]);
      setFds([]);
      setRawStocks([]);
      setStocks([]);
      setLoading(false);
      return;
    }

    const mfQuery = query(collection(db, "mutual_funds"), where("uid", "==", user.uid));
    const fdQuery = query(collection(db, "fixed_deposits"), where("uid", "==", user.uid));
    const stockQuery = query(collection(db, "stocks"), where("uid", "==", user.uid));

    const unsubMf = onSnapshot(mfQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MutualFund));
      setRawMfs(data);
      setMfs(current => {
        // Merge existing currentNav if available, otherwise use avgNav
        return data.map(newMf => {
          const existing = current.find(m => m.id === newMf.id);
          return { ...newMf, currentNav: existing?.currentNav || newMf.avgNav };
        });
      });
    });

    const unsubFd = onSnapshot(fdQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const fd = doc.data() as FixedDeposit;
        const start = new Date(fd.startDate).getTime();
        const end = new Date(fd.maturityDate).getTime();
        const t = (end - start) / (1000 * 60 * 60 * 24 * 365);
        const maturityAmount = fd.principal * Math.pow(1 + (fd.interestRate / 100) / 4, 4 * t);
        return { id: doc.id, ...fd, maturityAmount } as FixedDeposit;
      });
      setFds(data);
    });

    const unsubStock = onSnapshot(stockQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stock));
      setRawStocks(data);
      setStocks(current => {
        // Merge existing currentPrice if available, otherwise use avgPrice
        return data.map(newStock => {
          const existing = current.find(s => s.id === newStock.id);
          return { ...newStock, currentPrice: existing?.currentPrice || newStock.avgPrice };
        });
      });
      setLoading(false);
    });

    return () => {
      unsubMf();
      unsubFd();
      unsubStock();
    };
  }, [user]);

  // Fetch latest NAVs when rawMfs change
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
        setMfs(current => {
          return current.map(mf => {
            const update = navUpdates.find(u => u.id === mf.id);
            if (update && update.currentNav !== null) {
              return { ...mf, currentNav: update.currentNav };
            }
            return mf;
          });
        });
      }
    };

    if (rawMfs.length > 0) {
      fetchNavs();
    } else {
      setMfs([]);
    }

    return () => {
      isMounted = false;
    };
  }, [rawMfs]);

  // Fetch latest stock prices when rawStocks change
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchPrices = async () => {
      const priceUpdates = await Promise.all(
        rawStocks.map(async (stock) => {
          if (stock.symbol) {
            try {
              // Add timestamp to Yahoo URL to bypass their cache
              const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?interval=1d&range=1d&t=${Date.now()}`;
              
              const timeoutId = setTimeout(() => {
                abortController.abort();
              }, 8000);

              // Use disableCache=true for allorigins proxy
              const res = await fetch(`https://api.allorigins.win/get?disableCache=true&url=${encodeURIComponent(targetUrl)}`, {
                signal: abortController.signal
              });
              
              clearTimeout(timeoutId);
              
              const proxyData = await res.json();
              if (!proxyData || !proxyData.contents) {
                throw new Error("Invalid proxy response");
              }
              const json = JSON.parse(proxyData.contents);
              if (json.chart?.result?.[0]?.meta?.regularMarketPrice) {
                return { id: stock.id, currentPrice: json.chart.result[0].meta.regularMarketPrice };
              }
            } catch (err: any) {
              if (err.name !== 'AbortError') {
                console.error(`Failed to fetch price for ${stock.symbol}`, err);
              }
            }
          }
          return { id: stock.id, currentPrice: null };
        })
      );

      if (isMounted) {
        setStocks(current => {
          return current.map(stock => {
            const update = priceUpdates.find(u => u.id === stock.id);
            if (update && update.currentPrice !== null) {
              return { ...stock, currentPrice: update.currentPrice };
            }
            return stock;
          });
        });
      }
    };

    if (rawStocks.length > 0) {
      fetchPrices();
    } else {
      setStocks([]);
    }

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [rawStocks]);

  const recalculateAsset = (transactions: any[]) => {
    let currentUnits = 0;
    let currentAvg = 0;

    // Sort transactions chronologically for accurate weighted average cost
    const sortedTxs = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedTxs.forEach(t => {
      if (t.type === "BUY") {
        const newTotalUnits = currentUnits + t.units;
        if (newTotalUnits > 0) {
          currentAvg = ((currentUnits * currentAvg) + (t.units * t.price)) / newTotalUnits;
        }
        currentUnits = newTotalUnits;
      } else {
        // SELL
        currentUnits -= t.units;
        // Average cost remains the same on a sale
      }
    });

    return { 
      units: Math.max(0, currentUnits), 
      avgPrice: currentUnits > 0 ? currentAvg : 0 
    };
  };

  const addTransaction = async (
    assetType: "MF" | "Stocks", 
    assetId: string, 
    units: number, 
    price: number, 
    date: string, 
    type: "BUY" | "SELL"
  ) => {
    if (!db) return;
    const collectionName = assetType === "MF" ? "mutual_funds" : "stocks";
    const asset = assetType === "MF" ? rawMfs.find(m => m.id === assetId) : rawStocks.find(s => s.id === assetId);
    if (!asset) return;

    const newTransaction = {
      id: crypto.randomUUID(),
      date,
      units,
      price,
      type
    };

    const updatedTransactions = [...((asset as any).transactions || []), newTransaction];
    const { units: totalUnits, avgPrice: newAvgPrice } = recalculateAsset(updatedTransactions);

    try {
      const updateData: any = {
        lastUpdated: date,
        transactions: updatedTransactions
      };

      if (assetType === "MF") {
        updateData.units = totalUnits;
        updateData.avgNav = newAvgPrice;
      } else {
        updateData.quantity = totalUnits;
        updateData.avgPrice = newAvgPrice;
      }

      await updateDoc(doc(db, collectionName, assetId), updateData);
    } catch (error: any) {
      console.error(`Failed to add ${type} transaction:`, error);
    }
  };

  const addMF = async (mf: Omit<MutualFund, "id">) => {
    if (!user || !db) return;
    try {
      const transactions = [];
      if (mf.units > 0) {
        transactions.push({
          id: crypto.randomUUID(),
          date: mf.date || mf.lastUpdated,
          units: mf.units,
          price: mf.avgNav,
          type: "BUY"
        });
      }
      await addDoc(collection(db, "mutual_funds"), { ...mf, uid: user.uid, transactions });
    } catch (error: any) {
      console.error("Failed to add Mutual Fund:", error);
    }
  };

  const topUpMF = async (mfId: string, newUnits: number, newNav: number, date: string) => {
    if (!db) return;
    const mf = rawMfs.find(m => m.id === mfId);
    if (!mf) return;

    const totalUnits = mf.units + newUnits;
    const newAvgNav = ((mf.units * mf.avgNav) + (newUnits * newNav)) / totalUnits;

    const newTransaction = {
      id: crypto.randomUUID(),
      date,
      units: newUnits,
      price: newNav,
      type: "BUY"
    };
    const updatedTransactions = [...(mf.transactions || []), newTransaction];

    try {
      await updateDoc(doc(db, "mutual_funds", mfId), {
        units: totalUnits,
        avgNav: newAvgNav,
        lastUpdated: date,
        transactions: updatedTransactions
      });
    } catch (error: any) {
      console.error("Failed to top up Mutual Fund:", error);
    }
  };

  const addFD = async (fd: Omit<FixedDeposit, "id">) => {
    if (!user || !db) return;
    try {
      await addDoc(collection(db, "fixed_deposits"), { ...fd, uid: user.uid });
    } catch (error: any) {
      console.error("Failed to add Fixed Deposit:", error);
    }
  };

  const addStock = async (stock: Omit<Stock, "id">) => {
    if (!user || !db) return;
    try {
      const transactions = [];
      if (stock.quantity > 0) {
        transactions.push({
          id: crypto.randomUUID(),
          date: stock.date || stock.lastUpdated,
          units: stock.quantity,
          price: stock.avgPrice,
          type: "BUY"
        });
      }
      await addDoc(collection(db, "stocks"), { ...stock, uid: user.uid, transactions });
    } catch (error: any) {
      console.error("Failed to add Stock:", error);
    }
  };

  const topUpStock = async (stockId: string, newQuantity: number, newPrice: number, date: string) => {
    if (!db) return;
    const stock = rawStocks.find(s => s.id === stockId);
    if (!stock) return;

    const totalQuantity = stock.quantity + newQuantity;
    const newAvgPrice = ((stock.quantity * stock.avgPrice) + (newQuantity * newPrice)) / totalQuantity;

    const newTransaction = {
      id: crypto.randomUUID(),
      date,
      units: newQuantity,
      price: newPrice,
      type: "BUY"
    };
    const updatedTransactions = [...(stock.transactions || []), newTransaction];

    try {
      await updateDoc(doc(db, "stocks", stockId), {
        quantity: totalQuantity,
        avgPrice: newAvgPrice,
        lastUpdated: date,
        transactions: updatedTransactions
      });
    } catch (error: any) {
      console.error("Failed to top up Stock:", error);
    }
  };

  const editTransaction = async (assetType: "MF" | "Stocks", assetId: string, transactionId: string, newUnits: number, newPrice: number, date: string, type: "BUY" | "SELL") => {
    if (!db) return;
    const collectionName = assetType === "MF" ? "mutual_funds" : "stocks";
    const asset = assetType === "MF" ? rawMfs.find(m => m.id === assetId) : rawStocks.find(s => s.id === assetId);
    if (!asset) return;

    const transactions = (asset as any).transactions || [];
    const updatedTransactions = transactions.map((t: any) => 
      t.id === transactionId ? { ...t, units: newUnits, price: newPrice, date, type } : t
    );

    const { units: totalUnits, avgPrice: newAvgPrice } = recalculateAsset(updatedTransactions);

    try {
      const updateData: any = {
        transactions: updatedTransactions
      };

      if (assetType === "MF") {
        updateData.units = totalUnits;
        updateData.avgNav = newAvgPrice;
      } else {
        updateData.quantity = totalUnits;
        updateData.avgPrice = newAvgPrice;
      }

      await updateDoc(doc(db, collectionName, assetId), updateData);
    } catch (error: any) {
      console.error(`Failed to edit transaction:`, error);
    }
  };

  const deleteTransaction = async (assetType: "MF" | "Stocks", assetId: string, transactionId: string) => {
    if (!db) {
      console.error("Database not initialized");
      return;
    }
    const collectionName = assetType === "MF" ? "mutual_funds" : "stocks";
    const asset = assetType === "MF" ? rawMfs.find(m => m.id === assetId) : rawStocks.find(s => s.id === assetId);
    
    if (!asset) {
      console.error("Asset not found in local state");
      return;
    }

    const transactions = (asset as any).transactions || [];
    const updatedTransactions = transactions.filter((t: any) => t.id !== transactionId);

    const { units: totalUnits, avgPrice: newAvgPrice } = recalculateAsset(updatedTransactions);

    try {
      const updateData: any = {
        transactions: updatedTransactions
      };

      if (assetType === "MF") {
        updateData.units = totalUnits;
        updateData.avgNav = newAvgPrice;
      } else {
        updateData.quantity = totalUnits;
        updateData.avgPrice = newAvgPrice;
      }

      await updateDoc(doc(db, collectionName, assetId), updateData);
    } catch (error: any) {
      console.error(`Failed to delete transaction:`, error);
      throw error;
    }
  };

  const deleteAsset = async (assetType: "MF" | "Stocks" | "FD", assetId: string) => {
    if (!db) {
      console.error("Database not initialized");
      return;
    }
    const collectionName = assetType === "MF" ? "mutual_funds" : assetType === "Stocks" ? "stocks" : "fixed_deposits";
    
    try {
      await deleteDoc(doc(db, collectionName, assetId));
    } catch (error: any) {
      console.error(`Failed to delete asset:`, error);
      throw error;
    }
  };

  return { mfs, fds, stocks, loading, addMF, addFD, addStock, addTransaction, editTransaction, deleteTransaction, deleteAsset };
}
