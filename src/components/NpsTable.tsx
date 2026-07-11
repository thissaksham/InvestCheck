import React, { useState } from "react";
import { motion } from "motion/react";
import { Plus, TrendingUp, TrendingDown, Eye, Trash2, Pencil, Check, X } from "lucide-react";
import { NpsHolding } from "../types";
import { formatCurrency, formatPercent, cn } from "../lib/utils";

interface NpsTableProps {
  data: NpsHolding[];
  onTopUp: (holding: NpsHolding) => void;
  onViewTransactions: (holding: NpsHolding) => void;
  onDelete: (holding: NpsHolding) => void;
  onUpdateNav: (id: string, nav: number) => void;
}

export function NpsTable({ data, onTopUp, onViewTransactions, onDelete, onUpdateNav }: NpsTableProps) {
  const [editingNavId, setEditingNavId] = useState<string | null>(null);
  const [navInput, setNavInput] = useState("");

  const startNavEdit = (holding: NpsHolding) => {
    setEditingNavId(holding.id);
    setNavInput(holding.latestNav?.toString() || "");
  };

  const saveNav = (id: string) => {
    const nav = parseFloat(navInput);
    if (nav > 0) onUpdateNav(id, nav);
    setEditingNavId(null);
  };

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Scheme & PRAN</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Tier</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Units</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Invested</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Current</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Gain / Loss</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {data.map((holding, index) => {
            const invested = holding.units * holding.avgNav;
            const current = holding.units * holding.currentNav;
            const gain = current - invested;
            const gainPercent = invested > 0 ? (gain / invested) * 100 : 0;
            const isPositive = gain >= 0;

            return (
              <motion.tr
                key={holding.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-zinc-800/30 transition-colors group"
              >
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span className="text-zinc-100 font-medium text-sm leading-tight">{holding.scheme}</span>
                    <span className="text-zinc-500 text-xs mt-1">PRAN: {holding.pran || "N/A"}</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                    {holding.tier}
                  </span>
                </td>
                <td className="px-6 py-5 text-right text-zinc-300 text-sm font-mono">{holding.units.toFixed(4)}</td>
                <td className="px-6 py-5 text-right text-zinc-100 text-sm font-mono font-medium">
                  <div className="flex flex-col items-end">
                    <span>{formatCurrency(invested)}</span>
                    <span className="text-[10px] text-zinc-500 mt-1">Avg: {holding.avgNav.toFixed(4)}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-right text-zinc-100 text-sm font-mono font-medium">
                  <div className="flex flex-col items-end">
                    <span>{formatCurrency(current)}</span>
                    {editingNavId === holding.id ? (
                      <span className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          step="0.0001"
                          autoFocus
                          value={navInput}
                          onChange={(e) => setNavInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveNav(holding.id);
                            if (e.key === "Escape") setEditingNavId(null);
                          }}
                          className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          aria-label="Latest NAV"
                        />
                        <button onClick={() => saveNav(holding.id)} className="text-emerald-500 hover:text-emerald-400" title="Save NAV">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingNavId(null)} className="text-zinc-500 hover:text-zinc-300" title="Cancel">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => startNavEdit(holding)}
                        className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1 hover:text-cyan-400 transition-colors"
                        title={holding.latestNav ? "Update latest NAV" : "Set latest NAV (NPS NAVs are not auto-fetched)"}
                      >
                        NAV: {holding.currentNav.toFixed(4)}{!holding.latestNav && "*"}
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className={cn("flex flex-col items-end", isPositive ? "text-emerald-500" : "text-rose-500")}>
                    <div className="flex items-center gap-1 text-sm font-medium">
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {formatCurrency(Math.abs(gain))}
                    </div>
                    <span className="text-xs font-medium opacity-80">{formatPercent(gainPercent)}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onViewTransactions(holding)}
                      className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-600 hover:text-white transition-all duration-200"
                      title="View Contributions"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onTopUp(holding)}
                      className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-cyan-600 hover:text-white transition-all duration-200"
                      title="Add Contribution"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(holding)}
                      className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-rose-600 hover:text-white transition-all duration-200"
                      title="Delete Holding"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-zinc-500">No NPS holdings yet. Add your Tier I / Tier II schemes to track them.</p>
        </div>
      )}
      {data.some((h) => !h.latestNav) && data.length > 0 && (
        <p className="px-6 pb-4 text-[11px] text-zinc-600">
          * NAV falls back to your average cost until you set the latest NAV (from your NPS statement or npstrust.org.in).
        </p>
      )}
    </div>
  );
}
