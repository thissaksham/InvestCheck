import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, TrendingUp, Landmark, Search, Loader2, LineChart, Umbrella, PiggyBank } from "lucide-react";
import { MutualFund, FixedDeposit, Stock, NpsHolding, EpfAccount, InvestmentType } from "../types";

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMF: (mf: Omit<MutualFund, "id">) => void;
  onAddFD: (fd: Omit<FixedDeposit, "id">) => void;
  onAddStock: (stock: Omit<Stock, "id">) => void;
  onAddNPS: (nps: Omit<NpsHolding, "id"> & { date?: string }) => void;
  onAddEPF: (epf: Omit<EpfAccount, "id">) => void;
  defaultType?: InvestmentType;
}

interface SchemeSuggestion {
  schemeCode: number;
  schemeName: string;
}

export function AddInvestmentModal({ isOpen, onClose, onAddMF, onAddFD, onAddStock, onAddNPS, onAddEPF, defaultType = "MF" }: AddModalProps) {
  const [type, setType] = useState<InvestmentType>(defaultType);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
    }
  }, [isOpen, defaultType]);

  // MF Fields
  const [amc, setAmc] = useState("");
  const [scheme, setScheme] = useState("");
  const [schemeCode, setSchemeCode] = useState<string>("");
  const [mfIsin, setMfIsin] = useState("");
  const [folio, setFolio] = useState("");
  const [mfType, setMfType] = useState<MutualFund["type"]>("Equity");
  const [initialUnits, setInitialUnits] = useState("");
  const [initialNav, setInitialNav] = useState("");
  const [initialDate, setInitialDate] = useState(new Date().toISOString().split("T")[0]);

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

  // NPS Fields
  const [npsScheme, setNpsScheme] = useState("");
  const [pran, setPran] = useState("");
  const [npsTier, setNpsTier] = useState<NpsHolding["tier"]>("Tier I");
  const [npsIsin, setNpsIsin] = useState("");
  const [npsLatestNav, setNpsLatestNav] = useState("");
  const [npsUnits, setNpsUnits] = useState("");
  const [npsAvgNav, setNpsAvgNav] = useState("");
  const [npsDate, setNpsDate] = useState(new Date().toISOString().split("T")[0]);

  // EPF Fields
  const [epfName, setEpfName] = useState("");
  const [epfBalance, setEpfBalance] = useState("");
  const [epfContributed, setEpfContributed] = useState("");

  // Stock Fields
  const [isin, setIsin] = useState("");
  const [stockName, setStockName] = useState("");
  const [stockSymbol, setStockSymbol] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("");
  const [initialPrice, setInitialPrice] = useState("");
  const [initialStockDate, setInitialStockDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const [stockSuggestions, setStockSuggestions] = useState<any[]>([]);
  const [showStockSuggestions, setShowStockSuggestions] = useState(false);
  const stockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setScheme("");
      setSchemeCode("");
      setMfIsin("");
      setSuggestions([]);
      setShowSuggestions(false);
      setIsin("");
      setStockName("");
      setStockSymbol("");
      setIsSearchingStock(false);
      setStockSuggestions([]);
      setShowStockSuggestions(false);
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
      const targetUrl = `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
      
      if (!response.ok) {
        throw new Error("Invalid response from MF API search proxy");
      }
      
      const data = await response.json();
      setSuggestions(data.slice(0, 10)); // Limit to 10 suggestions
      setShowSuggestions(true);
    } catch (error) {
      console.error("Failed to fetch schemes", error);
    } finally {
      setIsSearching(false);
    }
  };

  const searchByAmfiCode = async (code: string, skipIsinUpdate = false) => {
    if (!code || code.length < 5) return;
    setIsSearching(true);
    try {
      const targetUrl = `https://api.mfapi.in/mf/${code}`;
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
      
      if (!response.ok) {
        throw new Error("Invalid response from MF API proxy");
      }
      
      const data = await response.json();
      if (data.meta && data.meta.scheme_name) {
        setScheme(data.meta.scheme_name);
        setAmc(data.meta.fund_house || "");
        
        if (!skipIsinUpdate) {
          // MFAPI provides ISIN in meta for growth/payout
          const isin = data.meta.isin_growth || data.meta.isin_payout || "";
          setMfIsin(isin);
        }
      }
    } catch (error) {
      console.error("Failed to fetch scheme by AMFI code", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSchemeCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSchemeCode(value);
    if (value.length >= 5) {
      searchByAmfiCode(value);
    }
  };

  const handleMfIsinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setMfIsin(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.length >= 10) {
      searchTimeoutRef.current = setTimeout(() => {
        searchByMfIsin(value);
      }, 800);
    }
  };

  const searchByMfIsin = async (isin: string) => {
    if (!isin || isin.length < 10) return;
    setIsSearching(true);
    try {
      // 1. Try MFAPI search via proxy
      const searchUrl = `https://api.mfapi.in/mf/search?q=${encodeURIComponent(isin)}`;
      const searchRes = await fetch(`/api/proxy?url=${encodeURIComponent(searchUrl)}`);
      
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData && Array.isArray(searchData) && searchData.length > 0) {
          const schemeCode = searchData[0].schemeCode.toString();
          setSchemeCode(schemeCode);
          await searchByAmfiCode(schemeCode, true);
          return;
        }
      }

      // 2. Fallback to Yahoo Finance search via server proxy to get the name
      const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(isin)}`;
      const yahooRes = await fetch(`/api/proxy?url=${encodeURIComponent(yahooUrl)}`);
      
      if (yahooRes.ok) {
        const data = await yahooRes.json();
        if (data.quotes && data.quotes.length > 0) {
          const quote = data.quotes[0];
          const name = quote.longname || quote.shortname || quote.name || "";
          setScheme(name);
          setAmc(quote.dispName || quote.exchDisp || quote.sector || "");

          // 3. Use the name from Yahoo to search MFAPI for the scheme code
          if (name) {
            const nameSearchUrl = `https://api.mfapi.in/mf/search?q=${encodeURIComponent(name)}`;
            const nameSearchRes = await fetch(`/api/proxy?url=${encodeURIComponent(nameSearchUrl)}`);
            if (nameSearchRes.ok) {
              const nameSearchData = await nameSearchRes.json();
              if (nameSearchData && Array.isArray(nameSearchData) && nameSearchData.length > 0) {
                // Try to find a good match
                const bestMatch = nameSearchData.find((s: any) => 
                  s.schemeName.toLowerCase().includes(name.toLowerCase()) ||
                  name.toLowerCase().includes(s.schemeName.toLowerCase())
                ) || nameSearchData[0];
                
                setSchemeCode(bestMatch.schemeCode.toString());
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch MF scheme by ISIN", error);
    } finally {
      setIsSearching(false);
    }
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
    
    // Fetch full details including ISIN and Fund House
    searchByAmfiCode(suggestion.schemeCode.toString());
  };

  const searchStocks = async (query: string) => {
    if (!query || query.length < 3) {
      setStockSuggestions([]);
      setShowStockSuggestions(false);
      return;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setIsSearchingStock(true);
    try {
      const targetUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`;
      
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`, {
        signal: abortControllerRef.current.signal
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.quotes && data.quotes.length > 0) {
          setStockSuggestions(data.quotes.slice(0, 10));
          setShowStockSuggestions(true);
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch Stock details", error);
      }
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleStockSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIsin(value); // We use 'isin' state for the search input
    
    if (stockTimeoutRef.current) {
      clearTimeout(stockTimeoutRef.current);
    }

    stockTimeoutRef.current = setTimeout(() => {
      searchStocks(value);
    }, 500);
  };

  const selectStock = (quote: any) => {
    setStockName(quote.longname || quote.shortname || quote.name || "");
    setStockSymbol(quote.symbol || "");
    // If it looks like an ISIN, set it, otherwise leave it for manual entry
    if (isin.length >= 10 && /^[A-Z]{2}[A-Z0-9]{9,10}\d$/.test(isin)) {
      setIsin(isin);
    }
    setShowStockSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === "MF") {
      onAddMF({
        amc,
        scheme,
        schemeCode,
        isin: mfIsin,
        folio,
        type: mfType,
        units: parseFloat(initialUnits) || 0,
        avgNav: parseFloat(initialNav) || 0,
        currentNav: parseFloat(initialNav) || 0,
        lastUpdated: new Date(initialDate).toISOString(),
        date: new Date(initialDate).toISOString(),
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
        quantity: parseFloat(initialQuantity) || 0,
        avgPrice: parseFloat(initialPrice) || 0,
        currentPrice: parseFloat(initialPrice) || 0,
        lastUpdated: new Date(initialStockDate).toISOString(),
        date: new Date(initialStockDate).toISOString(),
      } as any);
    } else if (type === "NPS") {
      onAddNPS({
        scheme: npsScheme,
        pran,
        tier: npsTier,
        isin: npsIsin,
        latestNav: parseFloat(npsLatestNav) || undefined,
        units: parseFloat(npsUnits) || 0,
        avgNav: parseFloat(npsAvgNav) || 0,
        currentNav: parseFloat(npsLatestNav) || parseFloat(npsAvgNav) || 0,
        date: new Date(npsDate).toISOString(),
      });
    } else if (type === "EPF") {
      onAddEPF({
        name: epfName,
        balance: parseFloat(epfBalance),
        contributed: epfContributed ? parseFloat(epfContributed) : undefined,
      });
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

            <div className="p-6 grid grid-cols-3 gap-3 border-b border-zinc-800">
              {([
                { id: "MF", label: "Mutual Fund", icon: TrendingUp, active: "bg-blue-600 text-white" },
                { id: "Stocks", label: "Stocks", icon: LineChart, active: "bg-emerald-600 text-white" },
                { id: "FD", label: "Fixed Deposit", icon: Landmark, active: "bg-amber-600 text-white" },
                { id: "NPS", label: "NPS", icon: Umbrella, active: "bg-cyan-600 text-white" },
                { id: "EPF", label: "EPF", icon: PiggyBank, active: "bg-orange-600 text-white" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setType(tab.id)}
                  className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                    type === tab.id ? tab.active : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {type === "MF" && (
                <>
                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">AMFI Code (Optional - Fetches Details)</label>
                    <div className="relative">
                      <input 
                        value={schemeCode} 
                        onChange={handleSchemeCodeChange} 
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 pr-10" 
                        placeholder="e.g. 120503" 
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      )}
                    </div>
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
                        placeholder="Search scheme (e.g. Parag Parikh Flexi Cap)" 
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">AMC Name</label>
                      <input required value={amc} onChange={e => setAmc(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="e.g. PPFAS Mutual Fund" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">ISIN (For Verification)</label>
                      <input 
                        required 
                        value={mfIsin} 
                        onChange={e => setMfIsin(e.target.value.toUpperCase())} 
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 uppercase" 
                        placeholder="Auto-fetched" 
                      />
                    </div>
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

                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-4">
                    <p className="text-blue-400 text-xs font-bold uppercase tracking-wider">Initial Investment (Optional)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-zinc-400 text-sm">Units</label>
                        <input type="number" step="0.001" value={initialUnits} onChange={e => setInitialUnits(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="0.000" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-zinc-400 text-sm">Avg NAV</label>
                        <input type="number" step="0.01" value={initialNav} onChange={e => setInitialNav(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="0.00" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Purchase Date</label>
                      <input type="date" value={initialDate} onChange={e => setInitialDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" />
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
                  <div className="space-y-2 relative">
                    <label className="text-zinc-400 text-sm">Search Stock (Name, Symbol or ISIN)</label>
                    <div className="relative">
                      <input 
                        required 
                        value={isin} 
                        onChange={handleStockSearchChange} 
                        onFocus={() => {
                          if (stockSuggestions.length > 0) setShowStockSuggestions(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowStockSuggestions(false), 200);
                        }}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 pl-10" 
                        placeholder="e.g. Reliance, AAPL, INE002A01018" 
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                        {isSearchingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Stock Autocomplete Dropdown */}
                    <AnimatePresence>
                      {showStockSuggestions && stockSuggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                        >
                          {stockSuggestions.map((s, idx) => (
                            <div 
                              key={idx}
                              onClick={() => selectStock(s)}
                              className="px-4 py-3 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-200 border-b border-zinc-700/50 last:border-0"
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium truncate mr-2">{s.longname || s.shortname || s.name}</span>
                                <span className="text-xs text-zinc-500 shrink-0 font-mono">{s.symbol}</span>
                              </div>
                              <div className="text-[10px] text-zinc-500 mt-0.5">
                                {s.exchDisp} • {s.typeDisp}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Security Name</label>
                      <input required value={stockName} onChange={e => setStockName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="e.g. Apple Inc." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Symbol (For Live Price)</label>
                      <input required value={stockSymbol} onChange={e => setStockSymbol(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 font-mono" placeholder="e.g. AAPL or RELIANCE.NS" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">ISIN (For Verification)</label>
                    <input 
                      required 
                      value={isin.length > 15 ? "" : isin} // Simple heuristic to clear if it was a name search
                      onChange={e => setIsin(e.target.value.toUpperCase())} 
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 uppercase font-mono" 
                      placeholder="e.g. INE002A01018" 
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                    <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Initial Investment (Optional)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-zinc-400 text-sm">Quantity</label>
                        <input type="number" value={initialQuantity} onChange={e => setInitialQuantity(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-zinc-400 text-sm">Avg Price</label>
                        <input type="number" step="0.01" value={initialPrice} onChange={e => setInitialPrice(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="0.00" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Purchase Date</label>
                      <input type="date" value={initialStockDate} onChange={e => setInitialStockDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" />
                    </div>
                  </div>
                </>
              )}

              {type === "NPS" && (
                <>
                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">Scheme Name</label>
                    <input required value={npsScheme} onChange={e => setNpsScheme(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="e.g. HDFC Pension Fund - Scheme E" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">PRAN (Optional)</label>
                      <input value={pran} onChange={e => setPran(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 font-mono" placeholder="12-digit PRAN" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Tier</label>
                      <select value={npsTier} onChange={e => setNpsTier(e.target.value as any)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100">
                        <option>Tier I</option>
                        <option>Tier II</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">ISIN (For Verification)</label>
                      <input value={npsIsin} onChange={e => setNpsIsin(e.target.value.toUpperCase())} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 uppercase font-mono" placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Latest NAV</label>
                      <input type="number" step="0.0001" value={npsLatestNav} onChange={e => setNpsLatestNav(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="From NPS statement" />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10 space-y-4">
                    <p className="text-cyan-400 text-xs font-bold uppercase tracking-wider">Current Holding (Optional)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-zinc-400 text-sm">Units</label>
                        <input type="number" step="0.0001" value={npsUnits} onChange={e => setNpsUnits(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="0.0000" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-zinc-400 text-sm">Avg NAV (Cost)</label>
                        <input type="number" step="0.0001" value={npsAvgNav} onChange={e => setNpsAvgNav(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="0.0000" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">As-of Date</label>
                      <input type="date" value={npsDate} onChange={e => setNpsDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" />
                    </div>
                  </div>
                </>
              )}

              {type === "EPF" && (
                <>
                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">Account Label</label>
                    <input required value={epfName} onChange={e => setEpfName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="e.g. EPF - Current Employer" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Current Balance</label>
                      <input type="number" step="0.01" required value={epfBalance} onChange={e => setEpfBalance(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="From EPFO passbook" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">Total Contributed</label>
                      <input type="number" step="0.01" value={epfContributed} onChange={e => setEpfContributed(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100" placeholder="Optional — shows interest earned" />
                    </div>
                  </div>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    EPF has no live feed — update the balance from your EPFO passbook whenever interest or contributions are credited.
                  </p>
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
