import React from "react";
import { motion } from "motion/react";
import { PieChart, TrendingUp, Calendar, Lightbulb } from "lucide-react";
import { MutualFund, FixedDeposit, Stock } from "../types";
import { formatCurrency, formatPercent } from "../lib/utils";

interface Props {
  mfs: MutualFund[];
  fds: FixedDeposit[];
  stocks: Stock[];
}

export function PortfolioInsights({ mfs, fds, stocks }: Props) {
  const totalMFCurrent = mfs.reduce((acc, mf) => acc + (mf.units * mf.currentNav), 0);
  const totalFD = fds.reduce((acc, fd) => acc + fd.principal, 0);
  const totalStockCurrent = stocks.reduce((acc, stock) => acc + (stock.quantity * stock.currentPrice), 0);
  const totalPortfolio = totalMFCurrent + totalFD + totalStockCurrent;

  const mfPercent = totalPortfolio > 0 ? (totalMFCurrent / totalPortfolio) * 100 : 0;
  const fdPercent = totalPortfolio > 0 ? (totalFD / totalPortfolio) * 100 : 0;
  const stockPercent = totalPortfolio > 0 ? (totalStockCurrent / totalPortfolio) * 100 : 0;

  const topPerformer = [...mfs].sort((a, b) => {
    const gainA = a.avgNav > 0 ? (a.currentNav - a.avgNav) / a.avgNav : 0;
    const gainB = b.avgNav > 0 ? (b.currentNav - b.avgNav) / b.avgNav : 0;
    return gainB - gainA;
  })[0];

  const upcomingFD = [...fds]
    .filter(fd => new Date(fd.maturityDate).getTime() > Date.now())
    .sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime())[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Asset Allocation */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm lg:col-span-2"
      >
        <h3 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-blue-500" /> Asset Allocation
        </h3>
        <div className="h-4 w-full rounded-full flex overflow-hidden mb-6 bg-zinc-800">
          <div style={{ width: `${mfPercent}%` }} className="bg-emerald-500 h-full transition-all duration-1000" />
          <div style={{ width: `${stockPercent}%` }} className="bg-purple-500 h-full transition-all duration-1000" />
          <div style={{ width: `${fdPercent}%` }} className="bg-amber-500 h-full transition-all duration-1000" />
        </div>
        <div className="flex flex-wrap gap-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-emerald-500" /> 
              <span className="text-zinc-400 text-sm">Mutual Funds</span>
            </div>
            <div className="text-2xl font-bold text-zinc-100">{formatPercent(mfPercent)}</div>
            <div className="text-zinc-500 text-sm mt-1">{formatCurrency(totalMFCurrent)}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-purple-500" /> 
              <span className="text-zinc-400 text-sm">Stocks</span>
            </div>
            <div className="text-2xl font-bold text-zinc-100">{formatPercent(stockPercent)}</div>
            <div className="text-zinc-500 text-sm mt-1">{formatCurrency(totalStockCurrent)}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-amber-500" /> 
              <span className="text-zinc-400 text-sm">Fixed Deposits</span>
            </div>
            <div className="text-2xl font-bold text-zinc-100">{formatPercent(fdPercent)}</div>
            <div className="text-zinc-500 text-sm mt-1">{formatCurrency(totalFD)}</div>
          </div>
        </div>
      </motion.div>

      {/* Top Performer */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex flex-col items-center justify-center text-center"
      >
        <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2 justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-500" /> Top Performer (MF)
        </h3>
        {topPerformer ? (
          <div className="flex flex-col h-[calc(100%-2rem)] justify-center items-center">
            <div className="text-zinc-300 font-medium mb-3 line-clamp-2 leading-snug">{topPerformer.scheme}</div>
            <div className="text-3xl font-bold text-emerald-500">
              +{formatPercent((topPerformer.currentNav - topPerformer.avgNav) / topPerformer.avgNav * 100)}
            </div>
            <div className="text-zinc-500 text-sm mt-2">Absolute return</div>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100%-2rem)] justify-center items-center text-zinc-500 text-sm">
            No mutual funds added yet.
          </div>
        )}
      </motion.div>

      {/* Upcoming Maturity */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex flex-col items-center justify-center text-center"
      >
        <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2 justify-center">
          <Calendar className="w-5 h-5 text-amber-500" /> Next FD Maturity
        </h3>
        {upcomingFD ? (
          <div className="flex flex-col h-[calc(100%-2rem)] justify-center items-center">
            <div className="text-zinc-300 font-medium mb-3">{upcomingFD.bankName}</div>
            <div className="text-3xl font-bold text-zinc-100">
              {new Date(upcomingFD.maturityDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', day: 'numeric' })}
            </div>
            <div className="text-zinc-500 text-sm mt-2">{formatCurrency(upcomingFD.maturityAmount || upcomingFD.principal)} expected</div>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100%-2rem)] justify-center items-center text-zinc-500 text-sm">
            No upcoming fixed deposit maturities.
          </div>
        )}
      </motion.div>
      
      {/* Portfolio Insights */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm lg:col-span-2"
      >
        <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-blue-500" /> Smart Insights
        </h3>
        <ul className="space-y-4 text-zinc-300 text-sm leading-relaxed">
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
            <p>You currently hold <strong>{mfs.length} mutual fund{mfs.length !== 1 ? 's' : ''}</strong>, <strong>{stocks.length} stock{stocks.length !== 1 ? 's' : ''}</strong>, and <strong>{fds.length} fixed deposit{fds.length !== 1 ? 's' : ''}</strong> in your portfolio.</p>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
            <p>
              {(mfPercent + stockPercent) > 80 ? "Your portfolio is highly skewed towards market-linked assets. Consider diversifying with fixed-income instruments to reduce volatility." : 
               fdPercent > 80 ? "Your portfolio is highly conservative. Consider adding equity mutual funds or stocks for better long-term inflation-beating returns." :
               "Your portfolio has a balanced mix of market-linked and fixed-income assets, providing a good blend of growth and stability."}
            </p>
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
