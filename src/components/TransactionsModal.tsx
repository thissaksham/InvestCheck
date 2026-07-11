import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Pencil, Trash2 } from "lucide-react";
import { MutualFund, Stock, NpsHolding, Transaction, LedgerAssetType } from "../types";
import { formatCurrency, cn } from "../lib/utils";

interface TransactionsModalProps {
  asset: MutualFund | Stock | NpsHolding | null;
  assetType: LedgerAssetType | null;
  isOpen: boolean;
  onClose: () => void;
  onEditTransaction: (assetType: LedgerAssetType, assetId: string, transactionId: string, units: number, price: number, date: string, type: "BUY" | "SELL") => void;
  onDeleteTransaction: (assetType: LedgerAssetType, assetId: string, transactionId: string) => void;
}

export function TransactionsModal({ asset, assetType, isOpen, onClose, onEditTransaction, onDeleteTransaction }: TransactionsModalProps) {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editUnits, setEditUnits] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDate, setEditDate] = useState("");

  const [editType, setEditType] = useState<"BUY" | "SELL">("BUY");

  if (!asset || !assetType) return null;

  const transactions = [...(asset.transactions || [])].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const title = assetType === "Stocks" ? (asset as Stock).name : (asset as MutualFund | NpsHolding).scheme;
  const unitLabel = assetType === "Stocks" ? "Quantity" : "Units";
  const priceLabel = assetType === "Stocks" ? "Price" : "NAV";

  const handleEditClick = (tx: Transaction) => {
    setEditingTx(tx);
    setEditUnits(tx.units.toString());
    setEditPrice(tx.price.toString());
    setEditDate(tx.date.split("T")[0]);
    setEditType(tx.type);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTx) {
      onEditTransaction(
        assetType,
        asset.id,
        editingTx.id,
        parseFloat(editUnits),
        parseFloat(editPrice),
        new Date(editDate).toISOString(),
        editType
      );
      setEditingTx(null);
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
            className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
          >
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-semibold text-zinc-100">Transactions</h3>
                <p className="text-zinc-500 text-sm mt-1">{title}</p>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {editingTx ? (
                <form onSubmit={handleSaveEdit} className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-zinc-100">Edit Transaction</h4>
                    <button type="button" onClick={() => setEditingTx(null)} className="text-zinc-500 hover:text-zinc-300 text-sm">
                      Cancel
                    </button>
                  </div>

                  <div className="flex p-1 bg-zinc-800 rounded-xl mb-6">
                    <button
                      type="button"
                      onClick={() => setEditType("BUY")}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                        editType === "BUY" ? "bg-blue-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditType("SELL")}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                        editType === "SELL" ? "bg-rose-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      SELL
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-zinc-400 text-sm">Transaction Date</label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">{unitLabel}</label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={editUnits}
                        onChange={(e) => setEditUnits(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-400 text-sm">{priceLabel}</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
                  >
                    Save Changes
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  {transactions.length === 0 ? (
                    <p className="text-zinc-500 text-center py-8">No transactions found.</p>
                  ) : (
                    transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold tracking-wider",
                              tx.type === "BUY" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                            )}>
                              {tx.type}
                            </span>
                            <span className="text-zinc-300 text-sm font-medium">
                              {new Date(tx.date).toLocaleDateString("en-IN", { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <div className="mt-2 text-zinc-400 text-sm">
                            {tx.units} {unitLabel.toLowerCase()} @ {formatCurrency(tx.price)}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={cn(
                              "font-medium",
                              tx.type === "BUY" ? "text-zinc-100" : "text-rose-400"
                            )}>
                              {tx.type === "SELL" ? "-" : ""}{formatCurrency(tx.units * tx.price)}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              onDeleteTransaction(assetType, asset.id, tx.id);
                            }}
                            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-rose-600 hover:text-white transition-all duration-200"
                            title="Delete Transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditClick(tx)}
                            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-blue-600 hover:text-white transition-all duration-200"
                            title="Edit Transaction"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
