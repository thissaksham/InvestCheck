export interface Transaction {
  id: string;
  date: string;
  units: number;
  price: number;
  type: "BUY" | "SELL";
}

export interface MutualFund {
  id: string;
  uid: string;
  amc: string;
  scheme: string;
  schemeCode?: string;
  isin?: string;
  folio: string;
  type: "Equity" | "Debt" | "Hybrid" | "Other";
  units: number;
  avgNav: number;
  currentNav: number;
  lastUpdated: string;
  date?: string; // Original purchase date
  transactions?: Transaction[];
}

export interface FixedDeposit {
  id: string;
  uid: string;
  bankName: string;
  principal: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
  compoundingFrequency: "Quarterly" | "Monthly" | "Yearly";
  lastUpdated: string;
  maturityAmount?: number;
}

export interface Stock {
  id: string;
  uid: string;
  isin: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  lastUpdated: string;
  date?: string;
  transactions?: Transaction[];
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export type InvestmentType = "MF" | "FD" | "Stocks";
