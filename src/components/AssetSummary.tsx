import React from "react";
import { motion } from "motion/react";
import { Wallet, TrendingUp, PieChart } from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";

interface AssetSummaryProps {
  invested: number;
  current: number;
  gain: number;
}

export function AssetSummary({ invested, current, gain }: AssetSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex flex-col items-center justify-center text-center"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Wallet className="w-5 h-5 text-blue-500" />
          </div>
          <span className="text-zinc-500 text-sm font-medium">Total Invested</span>
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
          {formatCurrency(invested)}
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex flex-col items-center justify-center text-center"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-emerald-500/10">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-zinc-500 text-sm font-medium">Current Value</span>
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
          {formatCurrency(current)}
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex flex-col items-center justify-center text-center"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("p-2 rounded-xl", gain >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10")}>
            <PieChart className={cn("w-5 h-5", gain >= 0 ? "text-emerald-500" : "text-rose-500")} />
          </div>
          <span className="text-zinc-500 text-sm font-medium">Total Gain</span>
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
          {formatCurrency(gain)}
        </h2>
      </motion.div>
    </div>
  );
}
