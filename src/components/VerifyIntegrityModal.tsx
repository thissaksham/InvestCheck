import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Upload, ShieldCheck, AlertCircle, CheckCircle2, Loader2, FileText, Lock, TrendingUp, LineChart, XCircle } from "lucide-react";
import { MutualFund, Stock } from "../types";
import { cn } from "../lib/utils";
import * as pdfjsLib from "pdfjs-dist";

// Set up PDF.js worker
// For pdfjs-dist 5.x+, the worker is often an .mjs file on CDNJS or unpkg
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface VerifyIntegrityModalProps {
  isOpen: boolean;
  onClose: () => void;
  mfs: MutualFund[];
  stocks: Stock[];
}

interface VerificationResult {
  name: string;
  type: "MF" | "Stock";
  isin?: string;
  schemeCode?: string;
  folio?: string;
  pdfUnits: number;
  portfolioUnits: number;
  match: boolean;
}

export function VerifyIntegrityModal({ isOpen, onClose, mfs, stocks }: VerifyIntegrityModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [results, setResults] = useState<VerificationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPassword("");
    setResults(null);
    setError(null);
    setIsVerifying(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const extractTextFromPDF = async (file: File, pass: string): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      password: pass,
    });

    try {
      const pdf = await loadingTask.promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }
      return fullText;
    } catch (err: any) {
      if (err.name === "PasswordException") {
        throw new Error("Incorrect password. Please try again.");
      }
      throw new Error("Failed to parse PDF. Make sure it's a valid CAS statement.");
    }
  };

  const parseCASText = (text: string): { name: string; units: number }[] => {
    const lines = text.split("\n");
    const data: { name: string; units: number }[] = [];
    
    // CAS statements usually have lines like:
    // "Scheme Name ... Folio ... Units"
    // "HDFC Top 100 Fund - Growth 1234567/89 1,234.567"
    
    lines.forEach(line => {
      // Clean up the line
      const cleanLine = line.replace(/\s+/g, " ").trim();
      
      // Pattern 1: Name followed by a large space and then units (common in CAMS)
      // Example: "ICICI Prudential Bluechip Fund - Growth 1,234.567"
      const camsMatch = cleanLine.match(/(.+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{3,}))$/);
      if (camsMatch) {
        const name = camsMatch[1].trim();
        const units = parseFloat(camsMatch[2].replace(/,/g, ""));
        if (name.length > 5 && units > 0) {
          data.push({ name, units });
          return;
        }
      }

      // Pattern 2: Name followed by folio and then units (common in Karvy)
      // Example: "Nippon India Small Cap Fund - Growth 123456789 500.000"
      const karvyMatch = cleanLine.match(/(.+?)\s+\d{5,}\s+(\d{1,3}(?:,\d{3})*(?:\.\d{3,}))/);
      if (karvyMatch) {
        const name = karvyMatch[1].trim();
        const units = parseFloat(karvyMatch[2].replace(/,/g, ""));
        if (name.length > 5 && units > 0) {
          data.push({ name, units });
        }
      }
    });

    // Deduplicate and keep the most likely unit count if multiple matches for same name
    const uniqueData: { [key: string]: number } = {};
    data.forEach(item => {
      if (!uniqueData[item.name] || item.units > uniqueData[item.name]) {
        uniqueData[item.name] = item.units;
      }
    });

    return Object.entries(uniqueData).map(([name, units]) => ({ name, units }));
  };

  const handleVerify = async () => {
    if (!file) return;
    setIsVerifying(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (password) {
        formData.append("password", password);
      }

      const response = await fetch("/api/verify-cas", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type");
      let pdfData: { name: string; units: number; folio?: string; isin?: string }[] = [];

      if (!response.ok) {
        console.warn("API verification failed, attempting local parsing fallback...");
        try {
          const text = await extractTextFromPDF(file, password);
          pdfData = parseCASText(text);
          if (pdfData.length === 0) throw new Error("No data found locally");
        } catch (localErr) {
          // If local parsing failed, try to get error from original API response
          if (contentType && contentType.includes("application/json")) {
            try {
              const errData = await response.json();
              throw new Error(errData.error || "Failed to verify CAS statement");
            } catch (jsonErr) {
              throw new Error(`Server error (${response.status}): Failed to parse error details`);
            }
          } else {
            const errText = await response.text();
            console.error("Non-JSON error response:", errText);
            
            // Try to find common error messages in HTML/text
            if (errText.includes("Insufficient credits")) {
              throw new Error("Insufficient credits in CASParser API account. Please top up.");
            }
            if (errText.includes("Forbidden") || response.status === 403) {
              throw new Error("Access Forbidden (403). This might be due to insufficient credits or API key issues.");
            }
            
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }
        }
      } else {
        if (!contentType || !contentType.includes("application/json")) {
          const errText = await response.text();
          console.error("Expected JSON but got:", errText);
          
          if (errText.includes("Cookie check") || errText.includes("Action required to load your app")) {
            throw new Error("Authentication required. Please refresh the page or open the app in a new tab to re-authenticate with AI Studio.");
          }
          
          throw new Error("Invalid response format from server. Your session might have expired. Please refresh the page.");
        }

        const result = await response.json();
        pdfData = result.data || [];
        
        if (pdfData.length === 0) {
          // Fallback to local parsing if API returns no data but didn't error
          console.log("API returned no data, attempting local parsing fallback...");
          try {
            const text = await extractTextFromPDF(file, password);
            pdfData = parseCASText(text);
          } catch (localErr) {
            console.error("Local parsing fallback failed:", localErr);
          }
        }
      }
      
      if (pdfData.length === 0) {
        throw new Error("No investment data found in the statement. Please ensure it's a valid CAS PDF.");
      }

      const verificationResults: VerificationResult[] = [];

      // Match Mutual Funds
      mfs.forEach(mf => {
        // Try to find a match in PDF data using folio and isin
        const match = pdfData.find(p => {
          const mfFolio = mf.folio?.trim().toLowerCase();
          const pFolio = p.folio?.trim().toLowerCase();
          const mfIsin = mf.isin?.trim().toUpperCase();
          const pIsin = p.isin?.trim().toUpperCase();

          // 1. Match by folio and isin (Combined matching)
          if (mfFolio && pFolio && mfFolio === pFolio && mfIsin && pIsin && mfIsin === pIsin) {
            return true;
          }
          
          // If either is missing in the PDF data, we can't be sure of a combined match
          return false;
        });

        verificationResults.push({
          name: mf.scheme,
          type: "MF",
          isin: mf.isin,
          schemeCode: mf.schemeCode,
          folio: mf.folio,
          pdfUnits: match ? match.units : 0,
          portfolioUnits: mf.units,
          match: match ? Math.abs(match.units - mf.units) < 0.01 : false
        });
      });

      // Match Stocks (if present in CAS)
      stocks.forEach(stock => {
        const match = pdfData.find(p => {
          const stockIsin = stock.isin?.trim().toUpperCase();
          const pIsin = p.isin?.trim().toUpperCase();

          // 1. Match by ISIN (Primary source of truth for stocks)
          if (stockIsin && pIsin && stockIsin === pIsin) {
            return true;
          }
          
          // 2. Fallback to name/symbol matching only if ISIN is missing in either
          if (!stockIsin || !pIsin) {
            return p.name.toLowerCase().includes(stock.name.toLowerCase()) || 
                   stock.name.toLowerCase().includes(p.name.toLowerCase()) ||
                   p.name.toLowerCase().includes(stock.symbol.toLowerCase());
          }
          
          return false;
        });

        verificationResults.push({
          name: stock.name,
          type: "Stock",
          isin: stock.isin,
          pdfUnits: match ? match.units : 0,
          portfolioUnits: stock.quantity,
          match: match ? Math.abs(match.units - stock.quantity) < 0.01 : false
        });
      });

      setResults(verificationResults);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
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
            className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-zinc-100">Verify Portfolio Integrity</h3>
                  <p className="text-zinc-500 text-sm">Verify your portfolio integrity using <strong>casparser.in</strong></p>
                </div>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {!results ? (
                <div className="space-y-6">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
                      file ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-800 hover:border-zinc-700 bg-zinc-800/30"
                    )}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept=".pdf" 
                      className="hidden" 
                    />
                    {file ? (
                      <>
                        <FileText className="w-12 h-12 text-emerald-500" />
                        <div className="text-center">
                          <p className="text-zinc-100 font-medium">{file.name}</p>
                          <p className="text-zinc-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-zinc-600" />
                        <div className="text-center">
                          <p className="text-zinc-100 font-medium">Upload CAS PDF</p>
                          <p className="text-zinc-500 text-sm">Drag and drop or click to browse</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      PDF Password (usually your PAN)
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <p className="text-rose-500 text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={handleVerify}
                    disabled={!file || isVerifying}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" />
                        Start Verification
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Mutual Funds Section */}
                  <div className="space-y-4">
                    <h4 className="text-blue-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Mutual Funds
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-zinc-500 text-[10px] uppercase tracking-wider border-b border-zinc-800">
                            <th className="pb-3 font-medium">ISIN / Folio</th>
                            <th className="pb-3 font-medium">Scheme Name</th>
                            <th className="pb-3 font-medium text-right">My Units</th>
                            <th className="pb-3 font-medium text-right">CAS Units</th>
                            <th className="pb-3 font-medium text-center">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {results.filter(r => r.type === "MF").map((res, idx) => (
                            <tr key={idx} className="text-sm">
                              <td className="py-3 pr-4">
                                <div className="text-zinc-300 font-mono text-[10px]">{res.isin || "N/A"}</div>
                                <div className="text-zinc-500 text-[10px]">{res.folio || "N/A"}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-zinc-100 font-medium line-clamp-1">{res.name}</div>
                              </td>
                              <td className="py-3 pr-4 text-right text-zinc-300 font-mono">{res.portfolioUnits.toFixed(3)}</td>
                              <td className="py-3 pr-4 text-right text-zinc-300 font-mono">{res.pdfUnits.toFixed(3)}</td>
                              <td className="py-3 text-center">
                                {res.match ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-rose-500 mx-auto" />
                                )}
                              </td>
                            </tr>
                          ))}
                          {results.filter(r => r.type === "MF").length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-zinc-500 text-sm italic">No mutual funds found</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stocks Section */}
                  <div className="space-y-4">
                    <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <LineChart className="w-4 h-4" />
                      Stocks
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-zinc-500 text-[10px] uppercase tracking-wider border-b border-zinc-800">
                            <th className="pb-3 font-medium">ISIN</th>
                            <th className="pb-3 font-medium">Stock Name</th>
                            <th className="pb-3 font-medium text-right">My Units</th>
                            <th className="pb-3 font-medium text-right">CAS Units</th>
                            <th className="pb-3 font-medium text-center">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {results.filter(r => r.type === "Stock").map((res, idx) => (
                            <tr key={idx} className="text-sm">
                              <td className="py-3 pr-4">
                                <div className="text-zinc-300 font-mono text-[10px]">{res.isin || "N/A"}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-zinc-100 font-medium line-clamp-1">{res.name}</div>
                              </td>
                              <td className="py-3 pr-4 text-right text-zinc-300 font-mono">{res.portfolioUnits.toFixed(0)}</td>
                              <td className="py-3 pr-4 text-right text-zinc-300 font-mono">{res.pdfUnits.toFixed(0)}</td>
                              <td className="py-3 text-center">
                                {res.match ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-rose-500 mx-auto" />
                                )}
                              </td>
                            </tr>
                          ))}
                          {results.filter(r => r.type === "Stock").length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-zinc-500 text-sm italic">No stocks found</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400 text-sm">Verification Summary</span>
                      <span className="text-zinc-100 font-bold">
                        {results.filter(r => r.match).length} / {results.length} Matches
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={reset}
                    className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold rounded-xl transition-all"
                  >
                    Verify Another Statement
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
