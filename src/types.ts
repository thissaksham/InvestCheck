export interface Transaction {
  id: string;
  date: string;
  units: number;
  price: number;
  type: "BUY" | "SELL";
}

export interface MutualFund {
  id: string;
  amc: string;
  scheme: string;
  schemeCode?: string;
  isin?: string;
  folio: string;
  type: "Equity" | "Debt" | "Hybrid" | "Other";
  units: number;      // derived from transactions
  avgNav: number;     // derived from transactions
  currentNav: number; // live NAV from MFAPI
  lastUpdated?: string;
  date?: string; // Original purchase date
  transactions?: Transaction[];
}

export interface FixedDeposit {
  id: string;
  bankName: string;
  principal: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
  compoundingFrequency: "Quarterly" | "Monthly" | "Yearly";
  lastUpdated?: string;
  maturityAmount?: number;
}

export interface Stock {
  id: string;
  isin: string;
  symbol: string;
  name: string;
  quantity: number;     // derived from transactions
  avgPrice: number;     // derived from transactions
  currentPrice: number; // live price from Yahoo Finance
  lastUpdated?: string;
  date?: string;
  transactions?: Transaction[];
}

export interface NpsHolding {
  id: string;
  scheme: string;
  pran?: string;
  tier: "Tier I" | "Tier II";
  isin?: string;
  units: number;      // derived from transactions
  avgNav: number;     // derived from transactions
  currentNav: number; // latest_nav (user-updated) or avg cost fallback
  latestNav?: number;
  transactions?: Transaction[];
}

export interface EpfAccount {
  id: string;
  name: string;
  balance: number;
  contributed?: number;
  asOf?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export type InvestmentType = "MF" | "FD" | "Stocks" | "NPS" | "EPF";

// Assets that carry a BUY/SELL transaction ledger
export type LedgerAssetType = "MF" | "Stocks" | "NPS";
