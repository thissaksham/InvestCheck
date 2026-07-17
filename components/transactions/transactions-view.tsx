"use client";

// Ledger (§4.4): reverse-chron, filter chips by type/instrument/FY, inline edit/delete.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import { useQuickAdd } from "@/components/quick-add/quick-add";
import { Button } from "@/components/ui/button";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { ConfirmDialog, Sheet, SheetContent } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate, formatINR, formatUnits } from "@/lib/format";
import { fyLabel } from "@/lib/fy";
import type { TxnType } from "@/lib/types";
import { todayIST } from "@/lib/utils";

export interface LedgerTxn {
  id: string;
  instrument_id: string;
  instrument_name: string;
  currency: "INR" | "USD";
  date: string;
  type: TxnType;
  units: number;
  amount: number;
  amount_usd: number | null;
  note: string | null;
}

export function TransactionsView({
  txns,
  initialInstrument = null,
}: {
  txns: LedgerTxn[];
  initialInstrument?: string | null;
}) {
  const router = useRouter();
  const { open } = useQuickAdd();

  const [typeFilter, setTypeFilter] = useState<TxnType | null>(null);
  const [instrumentFilter, setInstrumentFilter] = useState<string | null>(initialInstrument);
  const [fyFilter, setFyFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<LedgerTxn | null>(null);
  const [deleting, setDeleting] = useState<LedgerTxn | null>(null);

  const instruments = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of txns) map.set(t.instrument_id, t.instrument_name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [txns]);

  const fys = useMemo(() => [...new Set(txns.map((t) => fyLabel(t.date)))], [txns]);

  const filtered = txns.filter(
    (t) =>
      (!typeFilter || t.type === typeFilter) &&
      (!instrumentFilter || t.instrument_id === instrumentFilter) &&
      (!fyFilter || fyLabel(t.date) === fyFilter)
  );

  async function confirmDelete() {
    const t = deleting!;
    setDeleting(null);
    const result = await deleteTransaction(t.id);
    if (result.ok) {
      toast(`Deleted ₹${formatINR(t.amount)} · ${t.instrument_name}`);
      router.refresh();
    } else if ("error" in result) toast.error(result.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["buy", "sell", "opening"] as const).map((t) => (
          <Button key={t} variant="chip" data-on={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>
            {t}
          </Button>
        ))}
        <Select
          className="h-7 w-auto max-w-[200px] rounded-full px-3 text-[13px]"
          value={instrumentFilter ?? ""}
          onChange={(e) => setInstrumentFilter(e.target.value || null)}
        >
          <option value="">All instruments</option>
          {instruments.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        {fys.map((fy) => (
          <Button key={fy} variant="chip" data-on={fyFilter === fy} onClick={() => setFyFilter(fyFilter === fy ? null : fy)}>
            <span className="num">{fy}</span>
          </Button>
        ))}
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => open()}>
          Log transaction
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={txns.length === 0 ? "No transactions yet. Log your first one." : "Nothing matches these filters."}
          action={
            txns.length === 0 ? (
              <Button variant="primary" onClick={() => open()}>
                Log transaction
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TableWrap className="rounded-(--radius-card) border border-hairline bg-surface">
          <Table>
            <THead>
              <TR className="border-b border-hairline">
                <TH first>Date</TH>
                <TH>Instrument</TH>
                <TH>Type</TH>
                <TH numeric>Units</TH>
                <TH numeric>Amount</TH>
                <TH>Note</TH>
                <TH />
              </TR>
            </THead>
            <tbody>
              {filtered.map((t) => (
                <TR key={t.id} className="group">
                  <TD first className="num text-muted">{formatDate(t.date)}</TD>
                  <TD className="max-w-[220px] truncate font-medium">{t.instrument_name}</TD>
                  <TD><StatusChip status={t.type} /></TD>
                  <TD numeric>{t.units > 0 ? formatUnits(t.units) : "—"}</TD>
                  <TD numeric>
                    <Money value={t.amount} />
                    {t.amount_usd != null && <span className="block text-[11px] text-muted">${t.amount_usd.toFixed(2)}</span>}
                  </TD>
                  <TD className="max-w-[180px] truncate text-muted">{t.note ?? ""}</TD>
                  <TD numeric className="w-[72px]">
                    <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button aria-label="Edit" className="rounded p-1 text-muted hover:text-ink" onClick={() => setEditing(t)}>
                        <Pencil size={13} />
                      </button>
                      <button aria-label="Delete" className="rounded p-1 text-muted hover:text-loss" onClick={() => setDeleting(t)}>
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <Sheet open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <SheetContent title="Edit transaction"><EditForm txn={editing} onDone={() => setEditing(null)} /></SheetContent>}
      </Sheet>

      <ConfirmDialog open={deleting != null} onOpenChange={(o) => !o && setDeleting(null)} title="Delete transaction?">
        {deleting && (
          <>
            <p className="text-[13px] text-muted">
              {formatDate(deleting.date)} · {deleting.instrument_name} · ₹{formatINR(deleting.amount)}. This can't be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={confirmDelete}>Delete</Button>
            </div>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

function EditForm({ txn, onDone }: { txn: LedgerTxn; onDone: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(txn.date);
  const [type, setType] = useState<TxnType>(txn.type);
  const [units, setUnits] = useState(String(txn.units || ""));
  const [amount, setAmount] = useState(String(txn.amount));
  const [amountUsd, setAmountUsd] = useState(txn.amount_usd != null ? String(txn.amount_usd) : "");
  const [note, setNote] = useState(txn.note ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await updateTransaction(txn.id, {
      instrument_id: txn.instrument_id,
      type,
      date,
      amount: parseFloat(amount),
      amount_usd: txn.currency === "USD" && amountUsd ? parseFloat(amountUsd) : null,
      units: units ? parseFloat(units) : 0,
      note: note || null,
    });
    setBusy(false);
    if (!result.ok) return void toast.error("error" in result ? result.error : "Couldn't save.");
    toast(`Updated · ${txn.instrument_name}`);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <p className="text-[13px] font-medium">{txn.instrument_name}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as TxnType)}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="opening">Opening</option>
          </Select>
        </Field>
        <Field label="Amount (₹)">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        {txn.currency === "USD" && (
          <Field label="Amount ($)">
            <Input inputMode="decimal" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} />
          </Field>
        )}
        <Field label="Units">
          <Input inputMode="decimal" value={units} onChange={(e) => setUnits(e.target.value)} />
        </Field>
      </div>
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
