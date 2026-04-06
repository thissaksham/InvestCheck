import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, TrendingUp, Landmark, Search, Loader2, LineChart } from "lucide-react";
import { MutualFund, FixedDeposit, Stock } from "../types";

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMF: (mf: Omit<MutualFund, "id">) => void;
  onAddFD: (fd: Omit<FixedDeposit, "id">) => void;
  onAddStock: (stock: Omit<Stock, "id">) => void;
  defaultType?: "MF" | "FD" | "Stocks";
}

interface SchemeSuggestion {
  schemeCode: number;
  schemeName: string;
}

export function AddInvestmentModal({ isOpen, onClose, onAddMF, onAddFD, onAddStock, defaultType = "MF" }: AddModalProps) {
  const [type, setType] = useState<"MF" | "FD" | "Stocks">(defaultType);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
    }
  }, [isOpen, defaultType]);

  // MF Fields
  const [amc, setAmc] = useState("");
  const [scheme, setScheme] = useState("");
  const [schemeCode, setSchemeCode] = useState<string>("");
  const [folio, setFolio] = useState("");
  const [mfType, setMfType] = useState<MutualFund["type"]>("Equity");

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<SchemeSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // FD Fields
  const [bankName, setBankName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");

  // Stock Fields
  const [isin, setIsin] = useState("");
  const [stockName, setStockName] = useState("");
  const [stockSymbol, setStockSymbol] = useState("");
  const [isSearchingIsin, setIsSearchingIsin] = useState(false);
  const isinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setScheme("");
      setSchemeCode("");
      setSuggestions([]);
      setShowSuggestions(false);
      setIsin("");
      setStockName("");
      setStockSymbol("");
      setIsSearchingIsin(false);
      setIsSearching(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [isOpen]);

  const searchSchemes = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSuggestions(data.slice(0, 10)); // Limit to 10 suggestions
      setShowSuggestions(true);
    } catch (error) {
      console.error("Failed to fetch schemes", error);
    } finally {
      setIsSearching(false);
    }
  };

  const searchByAmfiCode = async (code: string) => {
    if (!code || code.length < 5) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://api.mfapi.in/mf/${code}`);
      const data = await response.json();
      if (data.meta && data.meta.scheme_name) {
        setScheme(data.meta.scheme_name);
        setAmc(data.meta.fund_house || "");
      }
    } catch (error) {
      console.error("Failed to fetch scheme by AMFI code", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAmfiCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSchemeCode(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchByAmfiCode(value);
    }, 500);
  };

  const handleSchemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setScheme(value);
    setSchemeCode(""); // Reset scheme code if user types manually
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchSchemes(value);
    }, 500);
  };

  const selectScheme = (suggestion: SchemeSuggestion) => {
    setScheme(suggestion.schemeName);
    setSchemeCode(suggestion.schemeCode.toString());
    setShowSuggestions(false);
    
    // Try to extract AMC from scheme name if AMC is empty
    if (!amc) {
      const parts = suggestion.schemeName.split(" ");
      if (parts.length > 0) {
        setAmc(parts[0] + " Mutual Fund");
      }
    }
  };

  const searchIsin = async (query: string) => {
    if (!query || query.length < 5) {
      setIsSearchingIsin(false);
      return;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setIsSearchingIsin(true);
    try {
      const targetUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`;
      
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, 8000); // 8 second timeout

      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, {
        signal: abortControllerRef.current.signal
      });
      
      clearTimeout(timeoutId);
      
      const proxyData = await response.json();
      if (!proxyData || !proxyData.contents) {
        throw new Error("Invalid proxy response");
      }
      
      const data = JSON.parse(proxyData.contents);
      if (data.quotes && data.quotes.length > 0) {
        const quote = data.quotes[0];
        setStockName(quote.longname || quote.shortname || "");
        setStockSymbol(quote.symbol || "");
      } else {
        setStockName("");
        setStockSymbol("");
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch ISIN details", error);
      }
    } finally {
      setIsSearchingIsin(false);
    }
  };

  const handleIsinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setIsin(value);
    
    if (isinTimeoutRef.current) {
      clearTimeout(isinTimeoutRef.current);
    }

    isinTimeoutRef.current = setTimeout(() => {
      searchIsin(value);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === "MF") {
      onAddMF({
        amc,
        scheme,
        schemeCode,
        folio,
        type: mfType,
        units: 0,
        avgNav: 0,
        currentNav: 0,
        lastUpdated: new Date().toISOString(),
      } as any);
    } else if (type === "FD") {
      onAddFD({
        bankName,
        principal: parseFloat(principal),
        interestRate: parseFloat(interestRate),
        startDate,
        maturityDate,
        compoundingFrequency: "Quarterly",
      } as any);
    } else if (type === "Stocks") {
      onAddStock({
        isin,
        name: stockName,
        symbol: stockSymbol,
        quantity: 0,
        avgPrice: 0,
        currentPrice: 0,
        lastUpdated: new Date().toISOString(),
      } as any);
    }
    onClose();
  };


  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-zinc-100">Add New Investment</h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex gap-3 border-b border-zinc-800">
              <button
                onClick={() => setType("MF")}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                  type === "MF" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Mutual Fund
              </button>
              <button
                onClick={() => setType("Stocks")}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                  type === "Stocks" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                <LineChart className="w-4 h-4" />
                Stocks
              </button>
              <button
                onClick={() => setType("FD")}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                  type === "FD" ? "bg-amber-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                <Landmark className="w-4 h-4" />
                Fixed Deposit
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {type === "MF" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">AMFI Code</label>
                      <input 
                        required 
                        value={schemeCode} 
                        onChange={handleAmfiCodeChange} 
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" 
                        placeholder="e.g. 122639" 
                      />
                    </div>
                    <div className="space-y-2 relative">
                      <label className="text-zinc-400 text-sm">Scheme Name</label>
                      <div className="relative">
                        <input 
                          required 
                          value={scheme} 
                          onChange={handleSchemeChange} 
                          onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true);
                          }}
                          onBlur={() => {
                            // Delay hiding to allow clicks on suggestions
                            setTimeout(() => setShowSuggestions(false), 200);
                          }}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 pl-10" 
                          placeholder="Search scheme" 
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </div>
                      </div>
                      
                      {/* Autocomplete Dropdown */}
                      <AnimatePresence>
                        {showSuggestions && suggestions.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                          >
                            {suggestions.map((s) => (
                              <div 
                                key={s.schemeCode}
                                onClick={() => selectScheme(s)}
                                className="px-4 py-3 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-200 border-b border-zinc-700/50 last:border-0"
                              >
                                {s.schemeName}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">AMC Name</label>
                    <input required value={amc} onChange={e => setAmc(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="e.g. PPFAS Mutual Fund" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Folio Number</label>
                      <input value={folio} onChange={e => setFolio(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Type</label>
                      <select value={mfType} onChange={e => setMfType(e.target.value as any)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100">
                        <option>Equity</option>
                        <option>Debt</option>
                        <option>Hybrid</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              
              {type === "FD" && (
                <>
                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">Bank Name</label>
                    <input required value={bankName} onChange={e => setBankName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="e.g. SBI" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Principal Amount</label>
                      <input type="number" required value={principal} onChange={e => setPrincipal(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Interest Rate (%)</label>
                      <input type="number" step="0.1" required value={interestRate} onChange={e => setInterestRate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Start Date</label>
                      <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Maturity Date</label>
                      <input type="date" required value={maturityDate} onChange={e => setMaturityDate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" />
                    </div>
                  </div>
                </>
              )}

              {type === "Stocks" && (
                <>
                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">ISIN</label>
                    <div className="relative">
                      <input 
                        required 
                        value={isin} 
                        onChange={handleIsinChange} 
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 pl-10 uppercase" 
                        placeholder="e.g. US0378331005" 
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                        {isSearchingIsin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">Security Name (Auto-fetched)</label>
                    <input required value={stockName} onChange={e => setStockName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="e.g. Apple Inc." />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all mt-4"
              >
                Add Investment
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
