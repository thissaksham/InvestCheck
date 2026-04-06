import React from "react";
import { motion } from "motion/react";
import { Landmark, Calendar, ArrowUpRight } from "lucide-react";
import { FixedDeposit } from "../types";
import { formatCurrency, cn } from "../lib/utils";

interface FDGridProps {
  data: FixedDeposit[];
}

export function FixedDepositGrid({ data }: FDGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.map((fd, index) => {
        const start = new Date(fd.startDate).getTime();
        const end = new Date(fd.maturityDate).getTime();
        const now = Date.now();
        const total = end - start;
        const elapsed = Math.max(0, Math.min(total, now - start));
        const progress = (elapsed / total) * 100;

        // Quarterly compounding: A = P(1 + r/4)^(4*t)
        const t = (now - start) / (1000 * 60 * 60 * 24 * 365);
        const currentVal = fd.principal * Math.pow(1 + (fd.interestRate / 100) / 4, 4 * t);

        return (
          <motion.div
            key={fd.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm hover:border-zinc-700 transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-blue-500 transition-colors">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-zinc-100 font-medium">{fd.bankName}</h3>
                  <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">{fd.interestRate}% P.A.</p>
                </div>
              </div>
              <div className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Principal</p>
                <h4 className="text-lg font-bold text-zinc-100 tracking-tight">{formatCurrency(fd.principal)}</h4>
              </div>
              <div className="text-right">
                <p className="text-zinc-500 text-xs mb-1">Maturity Amount</p>
                <h4 className="text-lg font-bold text-emerald-500 tracking-tight">
                  {fd.maturityAmount ? formatCurrency(fd.maturityAmount) : "Calculating..."}
                </h4>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-xs">Accrued Value</span>
                <span className="text-blue-400 font-mono font-bold text-sm">{formatCurrency(currentVal)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-zinc-500">Maturity Progress</span>
                  <span className="text-zinc-300 font-medium">{progress.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-blue-600 rounded-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Calendar className="w-3 h-3" />
                <span>Matures on {new Date(fd.maturityDate).toLocaleDateString()}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
      {data.length === 0 && (
        <div className="col-span-full py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
          <p className="text-zinc-500">No fixed deposits found. Add your first FD.</p>
        </div>
      )}
    </div>
  );
}
