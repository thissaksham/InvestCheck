import React from "react";
import { motion } from "motion/react";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Stock } from "../types";
import { formatCurrency, formatPercent, cn } from "../lib/utils";

interface StockTableProps {
  data: Stock[];
  onTopUp: (stock: Stock) => void;
}

export function StockTable({ data, onTopUp }: StockTableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Security & ISIN</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Quantity</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Avg Price</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Invested</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Current</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Gain / Loss</th>
            <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {data.map((stock, index) => {
            const invested = stock.quantity * stock.avgPrice;
            const current = stock.quantity * stock.currentPrice;
            const gain = current - invested;
            const gainPercent = invested > 0 ? (gain / invested) * 100 : 0;
            const isPositive = gain >= 0;

            return (
              <motion.tr
                key={stock.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-zinc-800/30 transition-colors group"
              >
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span className="text-zinc-100 font-medium text-sm leading-tight">{stock.name}</span>
                    <span className="text-zinc-500 text-xs mt-1">{stock.isin} • {stock.symbol}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-right text-zinc-300 text-sm font-mono">{stock.quantity}</td>
                <td className="px-6 py-5 text-right text-zinc-300 text-sm font-mono">{formatCurrency(stock.avgPrice)}</td>
                <td className="px-6 py-5 text-right text-zinc-100 text-sm font-mono font-medium">{formatCurrency(invested)}</td>
                <td className="px-6 py-5 text-right text-zinc-100 text-sm font-mono font-medium">
                  <div className="flex flex-col items-end">
                    <span>{formatCurrency(current)}</span>
                    <span className="text-[10px] text-zinc-500 mt-1">LTP: {formatCurrency(stock.currentPrice)}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className={cn(
                    "flex flex-col items-end",
                    isPositive ? "text-emerald-500" : "text-rose-500"
                  )}>
                    <div className="flex items-center gap-1 text-sm font-medium">
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {formatCurrency(Math.abs(gain))}
                    </div>
                    <span className="text-xs font-medium opacity-80">{formatPercent(gainPercent)}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <button
                    onClick={() => onTopUp(stock)}
                    className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-blue-600 hover:text-white transition-all duration-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-zinc-500">No stocks found. Add your first investment.</p>
        </div>
      )}
    </div>
  );
}
