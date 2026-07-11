import React, { useState } from "react";
import { motion } from "motion/react";
import { PiggyBank, Calendar, Trash2, Pencil, Check, X } from "lucide-react";
import { EpfAccount } from "../types";
import { formatCurrency, cn } from "../lib/utils";

interface EpfGridProps {
  data: EpfAccount[];
  onDelete: (epf: EpfAccount) => void;
  onUpdate: (id: string, balance: number, contributed?: number) => void;
}

export function EpfGrid({ data, onDelete, onUpdate }: EpfGridProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState("");
  const [contributedInput, setContributedInput] = useState("");

  const startEdit = (epf: EpfAccount) => {
    setEditingId(epf.id);
    setBalanceInput(epf.balance.toString());
    setContributedInput(epf.contributed?.toString() || "");
  };

  const saveEdit = (id: string) => {
    const balance = parseFloat(balanceInput);
    if (!(balance >= 0)) return;
    const contributed = contributedInput ? parseFloat(contributedInput) : undefined;
    onUpdate(id, balance, contributed);
    setEditingId(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.map((epf, index) => {
        const gain = epf.contributed !== undefined ? epf.balance - epf.contributed : null;
        const isEditing = editingId === epf.id;

        return (
          <motion.div
            key={epf.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm hover:border-zinc-700 transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-orange-500 transition-colors">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-zinc-100 font-medium">{epf.name}</h3>
                  <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Provident Fund</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (isEditing ? setEditingId(null) : startEdit(epf))}
                  className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-orange-600 hover:text-white transition-all duration-200"
                  title="Update balance"
                >
                  {isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(epf)}
                  className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-rose-600 hover:text-white transition-all duration-200"
                  title="Delete EPF account"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-3 mb-6">
                <div className="space-y-1">
                  <label className="text-zinc-500 text-xs">Current Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 text-xs">Total Contributed (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={contributedInput}
                    onChange={(e) => setContributedInput(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <button
                  onClick={() => saveEdit(epf.id)}
                  className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-zinc-500 text-xs mb-1">Current Balance</p>
                  <h4 className="text-lg font-bold text-zinc-100 tracking-tight">{formatCurrency(epf.balance)}</h4>
                </div>
                <div className="text-right">
                  <p className="text-zinc-500 text-xs mb-1">{gain !== null ? "Interest Earned" : "Contributed"}</p>
                  {gain !== null ? (
                    <h4 className={cn("text-lg font-bold tracking-tight", gain >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {formatCurrency(gain)}
                    </h4>
                  ) : (
                    <h4 className="text-lg font-bold text-zinc-500 tracking-tight">—</h4>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Calendar className="w-3 h-3" />
              <span>{epf.asOf ? `Balance as of ${new Date(epf.asOf).toLocaleDateString("en-IN")}` : "Update from your EPFO passbook"}</span>
            </div>
          </motion.div>
        );
      })}
      {data.length === 0 && (
        <div className="col-span-full py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
          <p className="text-zinc-500">No EPF accounts yet. Add one with the balance from your EPFO passbook.</p>
        </div>
      )}
    </div>
  );
}
