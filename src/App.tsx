import React, { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { AuthScreen } from "./components/AuthScreen";
import { Sidebar, Header } from "./components/Layout";
import { DashboardSummary } from "./components/DashboardSummary";
import { MutualFundTable } from "./components/MutualFundTable";
import { FixedDepositGrid } from "./components/FixedDepositGrid";
import { StockTable } from "./components/StockTable";
import { TopUpModal } from "./components/TopUpModal";
import { StockTopUpModal } from "./components/StockTopUpModal";
import { AddInvestmentModal } from "./components/AddInvestmentModal";
import { PortfolioInsights } from "./components/PortfolioInsights";
import { AssetSummary } from "./components/AssetSummary";
import { useInvestments } from "./useInvestments";
import { MutualFund } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";

function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const { mfs, fds, stocks, loading, topUpMF, addMF, addFD, addStock, topUpStock } = useInvestments();
  const [selectedMF, setSelectedMF] = useState<MutualFund | null>(null);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isStockTopUpOpen, setIsStockTopUpOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const totalMFInvested = mfs.reduce((acc, mf) => acc + (mf.units * mf.avgNav), 0);
  const totalMFCurrent = mfs.reduce((acc, mf) => acc + (mf.units * mf.currentNav), 0);
  const totalMFGain = totalMFCurrent - totalMFInvested;

  const totalFDInvested = fds.reduce((acc, fd) => acc + fd.principal, 0);
  const totalFDMaturity = fds.reduce((acc, fd) => acc + (fd.maturityAmount || fd.principal), 0);
  const totalFDGain = totalFDMaturity - totalFDInvested;

  const totalStockInvested = stocks.reduce((acc, stock) => acc + (stock.quantity * stock.avgPrice), 0);
  const totalStockCurrent = stocks.reduce((acc, stock) => acc + (stock.quantity * stock.currentPrice), 0);
  const totalStockGain = totalStockCurrent - totalStockInvested;

  const totalGain = totalMFGain + totalFDGain + totalStockGain;
  const totalCurrentValue = totalMFCurrent + totalFDInvested + totalStockCurrent;

  const handleTopUp = (mf: MutualFund) => {
    setSelectedMF(mf);
    setIsTopUpOpen(true);
  };

  const confirmTopUp = async (units: number, nav: number, date: string) => {
    if (selectedMF) {
      await topUpMF(selectedMF.id, units, nav, date);
    }
  };

  const handleStockTopUp = (stock: Stock) => {
    setSelectedStock(stock);
    setIsStockTopUpOpen(true);
  };

  const confirmStockTopUp = async (quantity: number, price: number, date: string) => {
    if (selectedStock) {
      await topUpStock(selectedStock.id, quantity, price, date);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 ml-20 p-8 lg:p-12 w-full">
        <div className="flex justify-between items-start mb-10">
          <Header 
            title={`Hello, ${user?.displayName?.split(" ")[0] || "Saksham"}`} 
            subtitle="Here's what's happening with your investments today." 
          />
          <button 
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-5 h-5" />
            Add Investment
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <DashboardSummary 
                totalMF={totalMFCurrent} 
                totalFD={totalFDInvested} 
                totalStocks={totalStockCurrent}
                totalGain={totalGain} 
              />
              <PortfolioInsights mfs={mfs} fds={fds} stocks={stocks} />
            </motion.div>
          )}

          {activeTab === "mf" && (
            <motion.div
              key="mf"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Mutual Fund Portfolio</h2>
              </div>
              <AssetSummary invested={totalMFInvested} current={totalMFCurrent} gain={totalMFGain} />
              <MutualFundTable data={mfs} onTopUp={handleTopUp} />
            </motion.div>
          )}

          {activeTab === "stocks" && (
            <motion.div
              key="stocks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Stock Portfolio</h2>
              </div>
              <AssetSummary invested={totalStockInvested} current={totalStockCurrent} gain={totalStockGain} />
              <StockTable data={stocks} onTopUp={handleStockTopUp} />
            </motion.div>
          )}

          {activeTab === "fd" && (
            <motion.div
              key="fd"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Fixed Deposits</h2>
              </div>
              <AssetSummary invested={totalFDInvested} current={totalFDMaturity} gain={totalFDGain} />
              <FixedDepositGrid data={fds} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <TopUpModal 
        mf={selectedMF} 
        isOpen={isTopUpOpen} 
        onClose={() => setIsTopUpOpen(false)} 
        onConfirm={confirmTopUp} 
      />

      <StockTopUpModal 
        stock={selectedStock} 
        isOpen={isStockTopUpOpen} 
        onClose={() => setIsStockTopUpOpen(false)} 
        onConfirm={confirmStockTopUp} 
      />

      <AddInvestmentModal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        onAddMF={addMF} 
        onAddFD={addFD} 
        onAddStock={addStock}
        defaultType={activeTab === "fd" ? "FD" : activeTab === "stocks" ? "Stocks" : "MF"}
      />
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return user ? <Dashboard /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
