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
      const updatedMfs = await Promise.all(
        rawMfs.map(async (mf) => {
          if (mf.schemeCode) {
            try {
              const res = await fetch(`https://api.mfapi.in/mf/${mf.schemeCode}`);
              const json = await res.json();
              if (json.data && json.data.length > 0) {
                return { ...mf, currentNav: parseFloat(json.data[0].nav) };
              }
            } catch (err) {
              console.error(`Failed to fetch NAV for ${mf.schemeCode}`, err);
            }
          }
          return mf;
        })
      );

      if (isMounted) {
        setMfs(updatedMfs);
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
      const updatedStocks = await Promise.all(
        rawStocks.map(async (stock) => {
          if (stock.symbol) {
            try {
              const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?interval=1d&range=1d`;
              
              const timeoutId = setTimeout(() => {
                abortController.abort();
              }, 8000);

              const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, {
                signal: abortController.signal
              });
              
              clearTimeout(timeoutId);
              
              const proxyData = await res.json();
              if (!proxyData || !proxyData.contents) {
                throw new Error("Invalid proxy response");
              }
              const json = JSON.parse(proxyData.contents);
              if (json.chart?.result?.[0]?.meta?.regularMarketPrice) {
                return { ...stock, currentPrice: json.chart.result[0].meta.regularMarketPrice };
              }
            } catch (err: any) {
              if (err.name !== 'AbortError') {
                console.error(`Failed to fetch price for ${stock.symbol}`, err);
              }
            }
          }
          return stock;
        })
      );

      if (isMounted) {
        setStocks(updatedStocks);
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

  const addMF = async (mf: Omit<MutualFund, "id">) => {
    if (!user || !db) return;
    try {
      await addDoc(collection(db, "mutual_funds"), { ...mf, uid: user.uid });
    } catch (error: any) {
      console.error("Failed to add Mutual Fund:", error);
      alert(`Failed to save: ${error.message}`);
    }
  };

  const topUpMF = async (mfId: string, newUnits: number, newNav: number, date: string) => {
    if (!db) return;
    const mf = rawMfs.find(m => m.id === mfId);
    if (!mf) return;

    const totalUnits = mf.units + newUnits;
    const newAvgNav = ((mf.units * mf.avgNav) + (newUnits * newNav)) / totalUnits;

    try {
      await updateDoc(doc(db, "mutual_funds", mfId), {
        units: totalUnits,
        avgNav: newAvgNav,
        lastUpdated: date
      });
    } catch (error: any) {
      console.error("Failed to top up Mutual Fund:", error);
      alert(`Failed to save: ${error.message}`);
    }
  };

  const addFD = async (fd: Omit<FixedDeposit, "id">) => {
    if (!user || !db) return;
    try {
      await addDoc(collection(db, "fixed_deposits"), { ...fd, uid: user.uid });
    } catch (error: any) {
      console.error("Failed to add Fixed Deposit:", error);
      alert(`Failed to save: ${error.message}`);
    }
  };

  const addStock = async (stock: Omit<Stock, "id">) => {
    if (!user || !db) return;
    try {
      await addDoc(collection(db, "stocks"), { ...stock, uid: user.uid });
    } catch (error: any) {
      console.error("Failed to add Stock:", error);
      alert(`Failed to save: ${error.message}`);
    }
  };

  const topUpStock = async (stockId: string, newQuantity: number, newPrice: number, date: string) => {
    if (!db) return;
    const stock = rawStocks.find(s => s.id === stockId);
    if (!stock) return;

    const totalQuantity = stock.quantity + newQuantity;
    const newAvgPrice = ((stock.quantity * stock.avgPrice) + (newQuantity * newPrice)) / totalQuantity;

    try {
      await updateDoc(doc(db, "stocks", stockId), {
        quantity: totalQuantity,
        avgPrice: newAvgPrice,
        lastUpdated: date
      });
    } catch (error: any) {
      console.error("Failed to top up Stock:", error);
      alert(`Failed to save: ${error.message}`);
    }
  };

  return { mfs, fds, stocks, loading, addMF, topUpMF, addFD, addStock, topUpStock };
}
