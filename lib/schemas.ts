// Shared zod schemas (client + server actions).

import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const money = z.coerce.number().positive("Amount must be more than 0");

export const transactionSchema = z.object({
  instrument_id: z.string().uuid("Pick an instrument"),
  type: z.enum(["buy", "sell", "opening"]),
  date: isoDate,
  amount: money,
  amount_usd: z.coerce.number().positive().optional().nullable(),
  units: z.coerce.number().min(0, "Units can't be negative").optional().default(0),
  note: z.string().trim().max(500).optional().nullable(),
  force: z.boolean().optional(), // set after the duplicate-confirm dialog
});
export type TransactionInput = z.infer<typeof transactionSchema>;

export const instrumentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(["stock", "etf", "mutual_fund", "nps"]),
  bucket: z.enum(["indian_equity", "intl_equity", "gold", "debt_liquid", "retirement"]),
  currency: z.enum(["INR", "USD"]).default("INR"),
  source: z.enum(["yahoo", "mfapi", "npsnav", "manual"]),
  identifier: z.string().trim().max(60).optional().nullable(),
});
export type InstrumentInput = z.infer<typeof instrumentSchema>;

export const depositSchema = z.object({
  deposit_no: z.string().trim().min(1, "Deposit number is required").max(60),
  bank: z.string().trim().min(1, "Bank is required").max(120),
  holder: z.string().trim().min(1).max(60).default("Self"),
  principal: money,
  /** Percent as entered (7.70) — stored as fraction (0.0770). */
  rate_pct: z.coerce.number().positive("Rate must be more than 0").max(30, "Rate looks wrong"),
  start_date: isoDate.optional().nullable(),
  maturity_date: isoDate,
  maturity_amount: z.coerce.number().positive().optional().nullable(),
  payout: z.enum(["cumulative", "monthly"]).default("cumulative"),
  monthly_payout: z.coerce.number().positive().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});
export type DepositInput = z.infer<typeof depositSchema>;

export const epfEntrySchema = z.object({
  component: z.enum(["employee", "employer"]),
  date: isoDate,
  type: z.enum(["opening", "contribution", "interest", "adjustment"]),
  amount: z.coerce.number().refine((v) => v !== 0, "Amount can't be zero"), // signed for adjustment
  note: z.string().trim().max(500).optional().nullable(),
});
export type EpfEntryInput = z.infer<typeof epfEntrySchema>;

export const manualPriceSchema = z.object({
  instrument_id: z.string().uuid("Pick an instrument"),
  price: z.coerce.number().positive("Price must be more than 0"),
  date: isoDate,
});
