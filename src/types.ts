export interface MutualFund {
  id: string;
  uid: string;
  amc: string;
  scheme: string;
  schemeCode?: string;
  folio: string;
  type: "Equity" | "Debt" | "Hybrid" | "Other";
  units: number;
  avgNav: number;
  currentNav: number;
  lastUpdated: string;
  date?: string; // Original purchase date
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
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export type InvestmentType = "MF" | "FD" | "Stocks";
