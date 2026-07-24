"use client";

// Shared per-instrument ledger: view + inline edit + delete.
// Used by the Holdings drawer and the Retirement NPS card so every instrument
// has the same ledger, not just EPF.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import { Button } from "@/components/ui/button";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { ConfirmDialog } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate, formatINR, formatUnits } from "@/lib/format";
import type { Contributor, TxnType } from "@/lib/types";
import { todayIST } from "@/lib/utils";

export interface LedgerRow {
  id: string;
  instrument_id: string;
  date: string;
  type: TxnType;
  units: number;
  amount: number;
  amount_usd: number | null;
  contributor?: Contributor | null;
  note: string | null;
}

export function TransactionLedger({
  txns,
  currency = "INR",
  isUsd,
  emptyMessage = "No transactions yet.",
}: {
  txns: LedgerRow[];
  currency?: "INR" | "USD";
  isUsd?: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LedgerRow | null>(null);

  async function confirmDelete() {
    const t = deleting!;
    setDeleting(null);
    const result = await deleteTransaction(t.id);
    if (result.ok) {
      toast(`Deleted ₹${formatINR(t.amount)} · ${formatDate(t.date)}`);
      router.refresh();
    } else if ("error" in result) toast.error(result.error);
  }

  if (txns.length === 0) return <p className="text-[13px] text-muted">{emptyMessage}</p>;

  return (
    <>
      <TableWrap>
        <Table>
          <THead>
            <TR className="border-b border-hairline">
              <TH first>Date</TH>
              <TH>Type</TH>
              <TH numeric>Units</TH>
              <TH numeric>Amount</TH>
              <TH />
            </TR>
          </THead>
          <tbody>
            {txns.map((t) =>
              editing === t.id ? (
                <EditRow key={t.id} txn={t} isUsd={isUsd} onDone={() => setEditing(null)} />
              ) : (
                <TR key={t.id} className="group">
                  <TD first className="num text-muted">{formatDate(t.date)}</TD>
                  <TD>
                    <StatusChip status={t.type} />
                    {t.contributor && (
                      <span className="ml-1.5 text-[10px] capitalize text-muted">{t.contributor}</span>
                    )}
                  </TD>
                  <TD numeric>{t.units > 0 ? formatUnits(t.units) : "—"}</TD>
                  <TD numeric>
                    <Money value={t.amount} />
                    {t.amount_usd != null && (
                      <span className="block text-[11px] text-muted">${t.amount_usd.toFixed(2)}</span>
                    )}
                  </TD>
                  <TD numeric className="w-[64px]">
                    <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        aria-label="Edit transaction"
                        className="rounded p-1 text-muted hover:text-ink"
                        onClick={() => setEditing(t.id)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        aria-label="Delete transaction"
                        className="rounded p-1 text-muted hover:text-loss"
                        onClick={() => setDeleting(t)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </TD>
                </TR>
              )
            )}
          </tbody>
        </Table>
      </TableWrap>

      <ConfirmDialog open={deleting != null} onOpenChange={(o) => !o && setDeleting(null)} title="Delete transaction?">
        {deleting && (
          <>
            <p className="text-[13px] text-muted">
              {formatDate(deleting.date)} · {deleting.type} · ₹{formatINR(deleting.amount)}. This can&apos;t be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={confirmDelete}>Delete</Button>
            </div>
          </>
        )}
      </ConfirmDialog>
    </>
  );
}

function EditRow({ txn, isUsd, onDone }: { txn: LedgerRow; isUsd?: boolean; onDone: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(txn.date);
  const [type, setType] = useState<TxnType>(txn.type);
  const [units, setUnits] = useState(String(txn.units || ""));
  const [amount, setAmount] = useState(String(txn.amount));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await updateTransaction(txn.id, {
      instrument_id: txn.instrument_id,
      type,
      date,
      amount: parseFloat(amount),
      amount_usd: isUsd ? txn.amount_usd : null,
      units: units ? parseFloat(units) : 0,
      contributor: txn.contributor ?? null, // preserved
      note: txn.note,
    });
    setBusy(false);
    if (!result.ok) return void toast.error("error" in result ? result.error : "Couldn't save.");
    toast("Transaction updated");
    onDone();
    router.refresh();
  }

  return (
    <TR className="bg-accent-soft/30">
      <TD first>
        <Input className="h-7 w-[130px] text-[12px]" type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} />
      </TD>
      <TD>
        <Select className="h-7 w-[104px] text-[12px]" value={type} onChange={(e) => setType(e.target.value as TxnType)}>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
          <option value="opening">Opening</option>
          <option value="fee">Fee</option>
        </Select>
      </TD>
      <TD numeric>
        <Input
          className="h-7 w-[86px] text-right text-[12px]"
          inputMode="decimal"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
        />
      </TD>
      <TD numeric>
        <Input
          className="h-7 w-[92px] text-right text-[12px]"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </TD>
      <TD numeric className="w-[64px]">
        <span className="flex justify-end gap-1">
          <button aria-label="Save" className="rounded p-1 text-accent hover:opacity-80" disabled={busy} onClick={save}>
            <Check size={14} />
          </button>
          <button aria-label="Cancel" className="rounded p-1 text-muted hover:text-ink" onClick={onDone}>
            <X size={14} />
          </button>
        </span>
      </TD>
    </TR>
  );
}
