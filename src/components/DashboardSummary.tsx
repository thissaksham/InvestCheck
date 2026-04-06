import React from "react";
import { motion } from "motion/react";
import { Wallet, TrendingUp, Landmark, PieChart, LineChart } from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";

interface SummaryProps {
  totalMF: number;
  totalFD: number;
  totalStocks: number;
  totalGain: number;
}

export function DashboardSummary({ totalMF, totalFD, totalStocks, totalGain }: SummaryProps) {
  const totalNetWorth = totalMF + totalFD + totalStocks;

  const stats = [
    { label: "Net Worth", value: totalNetWorth, icon: Wallet, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Total Gain", value: totalGain, icon: PieChart, color: totalGain >= 0 ? "text-emerald-500" : "text-rose-500", bg: totalGain >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10" },
    { label: "Mutual Funds", value: totalMF, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Stocks", value: totalStocks, icon: LineChart, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Fixed Deposits", value: totalFD, icon: Landmark, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex flex-col items-center justify-center text-center"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("p-2 rounded-xl", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <span className="text-zinc-500 text-sm font-medium">{stat.label}</span>
          </div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
            {formatCurrency(stat.value)}
          </h2>
        </motion.div>
      ))}
    </div>
  );
}
