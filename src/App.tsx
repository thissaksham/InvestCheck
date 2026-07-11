import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { SettingsProvider } from "./SettingsContext";
import { ToastProvider } from "./Toast";
import { AuthScreen } from "./components/AuthScreen";
import { Sidebar, Header } from "./components/Layout";
import { DashboardSummary } from "./components/DashboardSummary";
import { MutualFundTable } from "./components/MutualFundTable";
import { FixedDepositGrid } from "./components/FixedDepositGrid";
import { StockTable } from "./components/StockTable";
import { NpsTable } from "./components/NpsTable";
import { EpfGrid } from "./components/EpfGrid";
import { TopUpModal } from "./components/TopUpModal";
import { StockTopUpModal } from "./components/StockTopUpModal";
import { AddInvestmentModal } from "./components/AddInvestmentModal";
import { PortfolioInsights } from "./components/PortfolioInsights";
import { AssetSummary } from "./components/AssetSummary";
import { TransactionsModal } from "./components/TransactionsModal";
import { VerifyIntegrityModal } from "./components/VerifyIntegrityModal";
import { SettingsModal } from "./components/SettingsModal";
import { DeleteConfirmationModal } from "./components/DeleteConfirmationModal";
import { useInvestments } from "./useInvestments";
import { MutualFund, Stock, FixedDeposit, NpsHolding, EpfAccount, InvestmentType, LedgerAssetType } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, Plus } from "lucide-react";

const TAB_TO_TYPE: Record<string, InvestmentType> = {
  mf: "MF",
  stocks: "Stocks",
  fd: "FD",
  nps: "NPS",
  epf: "EPF",
};

function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const {
    mfs, fds, stocks, nps, epfs, loading,
    addMF, addFD, addStock, addNPS, addEPF,
    updateNpsNav, updateEPF,
    addTransaction, editTransaction, deleteTransaction, deleteAsset,
  } = useInvestments();
  // Units+NAV assets (MF, NPS) share the TopUpModal
  const [topUpTarget, setTopUpTarget] = useState<{ assetType: "MF" | "NPS"; asset: MutualFund | NpsHolding } | null>(null);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isStockTopUpOpen, setIsStockTopUpOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedAssetForTx, setSelectedAssetForTx] = useState<MutualFund | Stock | NpsHolding | null>(null);
  const [assetTypeForTx, setAssetTypeForTx] = useState<LedgerAssetType | null>(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [serverStatus, setServerStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(data => setServerStatus(data.status))
      .catch(() => setServerStatus("offline"));
  }, []);

  const currentAssetForTx =
    assetTypeForTx === "MF" ? mfs.find(m => m.id === selectedAssetForTx?.id)
    : assetTypeForTx === "Stocks" ? stocks.find(s => s.id === selectedAssetForTx?.id)
    : nps.find(n => n.id === selectedAssetForTx?.id);

  // Deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState<{
    type: "MF" | "Stocks" | "FD" | "NPS" | "EPF" | "TX";
    assetId: string;
    txId?: string;
    assetType?: LedgerAssetType; // For transactions
    title: string;
    message: string;
  } | null>(null);

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

  const totalNPSInvested = nps.reduce((acc, h) => acc + (h.units * h.avgNav), 0);
  const totalNPSCurrent = nps.reduce((acc, h) => acc + (h.units * h.currentNav), 0);
  const totalNPSGain = totalNPSCurrent - totalNPSInvested;

  const totalEPFInvested = epfs.reduce((acc, e) => acc + (e.contributed ?? e.balance), 0);
  const totalEPFCurrent = epfs.reduce((acc, e) => acc + e.balance, 0);
  const totalEPFGain = totalEPFCurrent - totalEPFInvested;

  const totalGain = totalMFGain + totalFDGain + totalStockGain + totalNPSGain + totalEPFGain;

  const openTopUp = (assetType: "MF" | "NPS", asset: MutualFund | NpsHolding) => {
    setTopUpTarget({ assetType, asset });
    setIsTopUpOpen(true);
  };

  const confirmTopUp = async (units: number, nav: number, date: string, type: "BUY" | "SELL") => {
    if (topUpTarget) {
      await addTransaction(topUpTarget.assetType, topUpTarget.asset.id, units, nav, date, type);
    }
  };

  const confirmStockTopUp = async (quantity: number, price: number, date: string, type: "BUY" | "SELL") => {
    if (selectedStock) {
      await addTransaction("Stocks", selectedStock.id, quantity, price, date, type);
    }
  };

  const openTransactions = (assetType: LedgerAssetType, asset: MutualFund | Stock | NpsHolding) => {
    setSelectedAssetForTx(asset);
    setAssetTypeForTx(assetType);
    setIsTxModalOpen(true);
  };

  const handleDeleteAsset = (type: "MF" | "Stocks" | "FD" | "NPS" | "EPF", asset: MutualFund | Stock | FixedDeposit | NpsHolding | EpfAccount) => {
    const labels: Record<string, string> = {
      MF: "Mutual Fund", Stocks: "Stock", FD: "Fixed Deposit", NPS: "NPS Holding", EPF: "EPF Account",
    };
    setDeleteConfig({
      type,
      assetId: asset.id,
      title: `Delete ${labels[type]}`,
      message: `Are you sure you want to delete "${(asset as any).scheme || (asset as any).name || (asset as any).bankName}"? This action cannot be undone.`
    });
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTransaction = (assetType: LedgerAssetType, assetId: string, transactionId: string) => {
    setDeleteConfig({
      type: "TX",
      assetId,
      txId: transactionId,
      assetType,
      title: "Delete Transaction",
      message: "Are you sure you want to delete this transaction? This will update your average purchase price and total units."
    });
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteConfig) return;

    if (deleteConfig.type === "TX") {
      const type = deleteConfig.assetType || assetTypeForTx;
      if (!type) throw new Error("Missing asset type for transaction deletion");
      await deleteTransaction(type, deleteConfig.assetId, deleteConfig.txId!);
    } else {
      await deleteAsset(deleteConfig.type, deleteConfig.assetId);
    }
  };

  const tabSection = (key: string, title: string, summary: React.ReactNode, body: React.ReactNode) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      {summary}
      {body}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 ml-20 p-8 lg:p-12 w-full">
        <div className="flex justify-between items-start mb-10">
          <Header
            title={`Hello, ${user?.displayName?.split(" ")[0] || "Investor"}`}
            subtitle="Here's what's happening with your investments today."
          />
          <div className="flex gap-4">
            <button
              onClick={() => setIsVerifyOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl font-semibold transition-all border border-zinc-700"
            >
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Verify Integrity
              {serverStatus === "offline" && <span className="w-2 h-2 rounded-full bg-red-500" title="Server Offline" />}
            </button>
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-5 h-5" />
              Add Investment
            </button>
          </div>
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
                totalNPS={totalNPSCurrent}
                totalEPF={totalEPFCurrent}
                totalGain={totalGain}
              />
              <PortfolioInsights mfs={mfs} fds={fds} stocks={stocks} nps={nps} epfs={epfs} />
            </motion.div>
          )}

          {activeTab === "mf" && tabSection("mf", "Mutual Fund Portfolio",
            <AssetSummary invested={totalMFInvested} current={totalMFCurrent} gain={totalMFGain} />,
            <MutualFundTable
              data={mfs}
              onTopUp={(mf) => openTopUp("MF", mf)}
              onViewTransactions={(mf) => openTransactions("MF", mf)}
              onDelete={(mf) => handleDeleteAsset("MF", mf)}
            />
          )}

          {activeTab === "stocks" && tabSection("stocks", "Stock Portfolio",
            <AssetSummary invested={totalStockInvested} current={totalStockCurrent} gain={totalStockGain} />,
            <StockTable
              data={stocks}
              onTopUp={(stock) => {
                setSelectedStock(stock);
                setIsStockTopUpOpen(true);
              }}
              onViewTransactions={(stock) => openTransactions("Stocks", stock)}
              onDelete={(stock) => handleDeleteAsset("Stocks", stock)}
            />
          )}

          {activeTab === "fd" && tabSection("fd", "Fixed Deposits",
            <AssetSummary invested={totalFDInvested} current={totalFDMaturity} gain={totalFDGain} />,
            <FixedDepositGrid data={fds} onDelete={(fd) => handleDeleteAsset("FD", fd)} />
          )}

          {activeTab === "nps" && tabSection("nps", "NPS Portfolio",
            <AssetSummary invested={totalNPSInvested} current={totalNPSCurrent} gain={totalNPSGain} />,
            <NpsTable
              data={nps}
              onTopUp={(holding) => openTopUp("NPS", holding)}
              onViewTransactions={(holding) => openTransactions("NPS", holding)}
              onDelete={(holding) => handleDeleteAsset("NPS", holding)}
              onUpdateNav={updateNpsNav}
            />
          )}

          {activeTab === "epf" && tabSection("epf", "EPF Accounts",
            <AssetSummary invested={totalEPFInvested} current={totalEPFCurrent} gain={totalEPFGain} />,
            <EpfGrid
              data={epfs}
              onDelete={(epf) => handleDeleteAsset("EPF", epf)}
              onUpdate={updateEPF}
            />
          )}
        </AnimatePresence>
      </main>

      <TopUpModal
        mf={topUpTarget?.asset ?? null}
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
        onAddNPS={addNPS}
        onAddEPF={addEPF}
        defaultType={TAB_TO_TYPE[activeTab] || "MF"}
      />

      <TransactionsModal
        asset={currentAssetForTx || null}
        assetType={assetTypeForTx}
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onEditTransaction={editTransaction}
        onDeleteTransaction={handleDeleteTransaction}
      />

      <VerifyIntegrityModal
        isOpen={isVerifyOpen}
        onClose={() => setIsVerifyOpen(false)}
        mfs={mfs}
        stocks={stocks}
        nps={nps}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={executeDelete}
        title={deleteConfig?.title || "Confirm Deletion"}
        message={deleteConfig?.message || "Are you sure you want to delete this item?"}
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
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
