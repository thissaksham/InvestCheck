export type InstrumentType = "stock" | "etf" | "mutual_fund" | "nps";
export type Bucket = "indian_equity" | "intl_equity" | "gold" | "debt_liquid" | "retirement";
export type PriceSource = "yahoo" | "mfapi" | "npsnav" | "manual";
export type TxnType = "buy" | "sell" | "opening";
export type FdStatus = "active" | "matured" | "renewed" | "closed";
export type FdPayout = "cumulative" | "monthly";
export type EpfComponent = "employee" | "employer";
export type EpfEntryType = "opening" | "contribution" | "interest" | "adjustment";
export type Currency = "INR" | "USD";

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface Instrument {
  id: string;
  user_id: string;
  name: string;
  type: InstrumentType;
  bucket: Bucket;
  identifier: string | null;
  currency: Currency;
  source: PriceSource;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  instrument_id: string;
  date: string;
  type: TxnType;
  units: number;
  amount: number;
  amount_usd: number | null;
  note: string | null;
  created_at: string;
}

export interface PriceRow {
  id: string;
  instrument_id: string;
  date: string;
  price: number;
  source: PriceSource;
  fetched_at: string;
}

export interface FxRate {
  id: string;
  pair: string;
  date: string;
  rate: number;
  fetched_at: string;
}

export interface FixedDeposit {
  id: string;
  user_id: string;
  deposit_no: string;
  bank: string;
  holder: string;
  principal: number;
  rate: number;
  start_date: string | null;
  maturity_date: string;
  maturity_amount: number | null;
  payout: FdPayout;
  monthly_payout: number | null;
  status: FdStatus;
  renewed_into: string | null;
  note: string | null;
  created_at: string;
}

export interface EpfEntry {
  id: string;
  user_id: string;
  component: EpfComponent;
  date: string;
  type: EpfEntryType;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface BucketSlice {
  invested: number;
  value: number;
}

export interface Snapshot {
  id: string;
  user_id: string;
  date: string;
  invested: number;
  current_value: number;
  by_bucket: Record<string, BucketSlice>;
  by_type: Record<string, BucketSlice>;
  created_at: string;
}
