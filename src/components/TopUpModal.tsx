import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus } from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";

interface TopUpModalProps {
  // Any units-and-NAV asset (mutual fund, NPS scheme)
  mf: { scheme: string; units: number } | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (units: number, nav: number, date: string, type: "BUY" | "SELL") => void | Promise<void>;
}

export function TopUpModal({ mf, isOpen, onClose, onConfirm }: TopUpModalProps) {
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [units, setUnits] = useState("");
  const [nav, setNav] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  if (!mf) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(parseFloat(units), parseFloat(nav), new Date(date).toISOString(), type);
    setUnits("");
    setNav("");
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
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-zinc-100">Add Transaction</h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="flex p-1 bg-zinc-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType("BUY")}
                  className={cn(
                    "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                    type === "BUY" ? "bg-blue-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setType("SELL")}
                  className={cn(
                    "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                    type === "SELL" ? "bg-rose-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  SELL
                </button>
              </div>

              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-1">Scheme</p>
                <p className="text-zinc-100 font-medium">{mf.scheme}</p>
                <p className="text-zinc-500 text-xs mt-1">Current Balance: {mf.units.toFixed(3)} units</p>
              </div>

              <div className="space-y-2">
                <label className="text-zinc-400 text-sm">Transaction Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-zinc-400 text-sm">{type === "BUY" ? "Units to Buy" : "Units to Sell"}</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    max={type === "SELL" ? mf.units : undefined}
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-zinc-400 text-sm">{type === "BUY" ? "Purchase NAV" : "Sale NAV"}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={nav}
                    onChange={(e) => setNav(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className={cn(
                "p-4 rounded-xl border",
                type === "BUY" ? "bg-blue-500/5 border-blue-500/10" : "bg-rose-500/5 border-rose-500/10"
              )}>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">{type === "BUY" ? "Estimated Investment" : "Estimated Proceeds"}</span>
                  <span className={cn("font-bold", type === "BUY" ? "text-blue-400" : "text-rose-400")}>
                    {units && nav ? formatCurrency(parseFloat(units) * parseFloat(nav)) : formatCurrency(0)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className={cn(
                  "w-full py-4 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2",
                  type === "BUY" ? "bg-blue-600 hover:bg-blue-500" : "bg-rose-600 hover:bg-rose-500"
                )}
              >
                {type === "BUY" ? <Plus className="w-5 h-5" /> : <X className="w-5 h-5" />}
                Confirm {type === "BUY" ? "Top-up" : "Sale"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
