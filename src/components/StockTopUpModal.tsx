import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus } from "lucide-react";
import { Stock } from "../types";
import { formatCurrency } from "../lib/utils";

interface StockTopUpModalProps {
  stock: Stock | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, price: number, date: string) => void;
}

export function StockTopUpModal({ stock, isOpen, onClose, onConfirm }: StockTopUpModalProps) {
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  if (!stock) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(parseFloat(quantity), parseFloat(price), new Date(date).toISOString());
    setQuantity("");
    setPrice("");
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
              <h3 className="text-xl font-semibold text-zinc-100">Add Stock Transaction</h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-1">Security</p>
                <p className="text-zinc-100 font-medium">{stock.name}</p>
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
                  <label className="text-zinc-400 text-sm">Quantity</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-zinc-400 text-sm">Purchase Price</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Estimated Investment</span>
                  <span className="text-blue-400 font-bold">
                    {quantity && price ? formatCurrency(parseFloat(quantity) * parseFloat(price)) : formatCurrency(0)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Confirm Transaction
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
