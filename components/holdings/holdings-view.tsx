"use client";

// Holdings (§4.3): grouped DataTable, row drawer, add instrument, refresh.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteInstrument, updateInstrument } from "@/app/actions/instruments";
import { NewInstrumentForm, useQuickAdd } from "@/components/quick-add/quick-add";
import { Button } from "@/components/ui/button";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/input";
import { Money, Pct, Units } from "@/components/ui/money";
import { ConfirmDialog, Sheet, SheetContent } from "@/components/ui/sheet";
import { Sparkline } from "@/components/ui/sparkline";
import { TransactionLedger } from "@/components/transactions/transaction-ledger";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate, formatNav, formatPct } from "@/lib/format";
import type { Contributor, Currency, InstrumentType, PriceSource, TxnType } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface HoldingRow {
  id: string;
  name: string;
  type: InstrumentType;
  currency: Currency;
  identifier: string | null;
  source: PriceSource;
  units: number;
  avgCost: number | null;
  invested: number;
  price: number | null;
  priceInr: number | null; // USD rows: ₹-converted quote
  priceDate: string | null;
  priceStale: boolean;
  fxMissing: boolean;
  value: number;
  unrealised: number;
  ret: number | null;
  weight: number;
  realized: number;
  instrumentXirr: number | null;
  spark: number[];
}

export interface HoldingTxn {
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

export interface HoldingGroup {
  key: string;
  label: string;
  rows: HoldingRow[];
}

export function HoldingsView({
  groups,
  txns,
  epf,
  initialAddOpen = false,
}: {
  groups: HoldingGroup[];
  txns: HoldingTxn[];
  epf: { balance: number; contributions: number } | null;
  initialAddOpen?: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(initialAddOpen);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const flatRows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const [focusIdx, setFocusIdx] = useState(-1);

  // keyboard map (§P6): j/k move, Enter opens drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (drawerId || addOpen || flatRows.length === 0) return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, flatRows.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (e.key === "Enter" && focusIdx >= 0) setDrawerId(flatRows[focusIdx].id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerId, addOpen, flatRows, focusIdx]);

  const drawerRow = flatRows.find((r) => r.id === drawerId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          Add instrument
        </Button>
      </div>

      {flatRows.length === 0 && !epf ? (
        <EmptyState
          message="No instruments yet. Add your first one to start the ledger."
          action={
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Add instrument
            </Button>
          }
        />
      ) : (
        <TableWrap className="rounded-(--radius-card) border border-hairline bg-surface">
          <Table>
            <THead>
              <TR className="border-b border-hairline">
                <TH first>Instrument</TH>
                <TH numeric>Units</TH>
                <TH numeric>Avg cost</TH>
                <TH numeric>Invested</TH>
                <TH numeric>Price</TH>
                <TH numeric>Value</TH>
                <TH numeric>P&L</TH>
                <TH numeric>Return</TH>
                <TH numeric>Weight</TH>
                <TH>30d</TH>
              </TR>
            </THead>
            <tbody>
              {groups.map((g) => (
                <Group
                  key={g.key}
                  group={g}
                  focusId={focusIdx >= 0 ? flatRows[focusIdx]?.id : null}
                  onRowClick={(id) => setDrawerId(id)}
                />
              ))}
              {epf && (
                <>
                  <TR id="epf" className="bg-accent-soft/40">
                    <TD first className="eyebrow bg-transparent">EPF</TD>
                    <TD colSpan={9} />
                  </TR>
                  <TR className="cursor-pointer hover:bg-accent-soft/40" onClick={() => router.push("/retirement")}>
                    <TD first className="font-medium">Employees' Provident Fund</TD>
                    <TD numeric>—</TD>
                    <TD numeric>—</TD>
                    <TD numeric><Money value={epf.contributions} /></TD>
                    <TD numeric>—</TD>
                    <TD numeric><Money value={epf.balance} /></TD>
                    <TD numeric><Money value={epf.balance - epf.contributions} signed /></TD>
                    <TD numeric>
                      {epf.contributions > 0 ? <Pct value={(epf.balance - epf.contributions) / epf.contributions} /> : "—"}
                    </TD>
                    <TD numeric>—</TD>
                    <TD>—</TD>
                  </TR>
                </>
              )}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {/* add instrument */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent title="Add instrument">
          <NewInstrumentForm
            keepOpenOption
            onDone={() => {
              setAddOpen(false);
              router.refresh();
            }}
            onCancel={() => setAddOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* row drawer */}
      <Sheet open={drawerRow != null} onOpenChange={(o) => !o && setDrawerId(null)}>
        {drawerRow && (
          <SheetContent title={drawerRow.name} wide>
            <RowDrawer row={drawerRow} txns={txns.filter((t) => t.instrument_id === drawerRow.id)} onClose={() => setDrawerId(null)} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

function Group({
  group,
  focusId,
  onRowClick,
}: {
  group: HoldingGroup;
  focusId: string | null;
  onRowClick: (id: string) => void;
}) {
  if (group.rows.length === 0) return null;
  const invested = group.rows.reduce((s, r) => s + r.invested, 0);
  const value = group.rows.reduce((s, r) => s + r.value, 0);
  const weight = group.rows.reduce((s, r) => s + r.weight, 0);

  return (
    <>
      <TR id={group.key} className="bg-bg/60">
        <TD first className="eyebrow bg-transparent">{group.label}</TD>
        <TD colSpan={9} />
      </TR>
      {group.rows.map((r) => (
        <TR
          key={r.id}
          onClick={() => onRowClick(r.id)}
          className={cn(focusId === r.id && "bg-accent-soft/40")}
        >
          <TD first className="max-w-[200px] truncate font-medium sm:max-w-[440px]" title={r.name}>
            {r.name}
            {!r.identifier && r.source !== "manual" && <StatusChip status="needs code" className="ml-2" />}
          </TD>
          <TD numeric>{r.units !== 0 ? <Units value={r.units} /> : "—"}</TD>
          <TD numeric>{r.avgCost != null ? <Money value={r.avgCost} decimals={2} currency={r.currency} /> : "—"}</TD>
          <TD numeric><Money value={r.invested} /></TD>
          <TD numeric>
            {r.price != null ? (
              <div className="leading-tight">
                <span className="flex items-center justify-end gap-1">
                  {r.priceStale && (
                    <span title={`As of ${r.priceDate ? formatDate(r.priceDate) : "?"}`} className="h-1.5 w-1.5 rounded-full bg-warn" />
                  )}
                  <span className="num">
                    {r.currency === "USD" ? "$" : "₹"}
                    {formatNav(r.price)}
                  </span>
                </span>
                {r.currency === "USD" && r.priceInr != null && (
                  <span className="block text-[11px] text-muted">₹{formatNav(r.priceInr)}</span>
                )}
                {r.priceDate && r.priceStale && (
                  <span className="block text-[10px] text-warn">as of {formatDate(r.priceDate)}</span>
                )}
              </div>
            ) : r.fxMissing ? (
              <span className="text-muted" title="No USDINR rate yet — refresh to fetch FX">—</span>
            ) : (
              "—"
            )}
          </TD>
          <TD numeric><Money value={r.value} /></TD>
          <TD numeric>{r.invested > 0 ? <Money value={r.unrealised} signed /> : "—"}</TD>
          <TD numeric>{r.ret != null ? <Pct value={r.ret} /> : "—"}</TD>
          <TD numeric>{formatPct(r.weight, false)}</TD>
          <TD><Sparkline points={r.spark} /></TD>
        </TR>
      ))}
      <TR className="bg-accent-soft/50 font-medium">
        <TD first className="bg-transparent text-[12px] text-ink-2">Subtotal</TD>
        <TD numeric>—</TD>
        <TD numeric>—</TD>
        <TD numeric><Money value={invested} /></TD>
        <TD numeric>—</TD>
        <TD numeric><Money value={value} /></TD>
        <TD numeric>{invested > 0 ? <Money value={value - invested} signed /> : "—"}</TD>
        <TD numeric>{invested > 0 ? <Pct value={(value - invested) / invested} /> : "—"}</TD>
        <TD numeric>{formatPct(weight, false)}</TD>
        <TD>—</TD>
      </TR>
    </>
  );
}

function RowDrawer({ row, txns, onClose }: { row: HoldingRow; txns: HoldingTxn[]; onClose: () => void }) {
  const router = useRouter();
  const { open } = useQuickAdd();
  const [identifier, setIdentifier] = useState(row.identifier ?? "");
  const [saving, setSaving] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  async function hide() {
    setHiding(true);
    const result = await updateInstrument(row.id, { is_active: false });
    setHiding(false);
    if (!result.ok) return void toast.error(result.error);
    toast(`Hidden · ${row.name} — restore it from Settings`);
    onClose();
    router.refresh();
  }

  async function doDelete() {
    const result = await deleteInstrument(row.id, confirmName);
    if (!result.ok) return void toast.error(result.error);
    setConfirmDelete(false);
    toast(`Deleted ${row.name}`);
    onClose();
    router.refresh();
  }

  async function saveIdentifier() {
    setSaving(true);
    const result = await updateInstrument(row.id, { identifier });
    setSaving(false);
    if (!result.ok) return void toast.error(result.error);
    toast(`Identifier updated · ${row.name}`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Units"><Units value={row.units} /></Stat>
        <Stat label="Invested"><Money value={row.invested} /></Stat>
        <Stat label="Value"><Money value={row.value} /></Stat>
        <Stat label="P&L">{row.invested > 0 ? <Money value={row.unrealised} signed /> : <>—</>}</Stat>
        <Stat label="Realized P&L">
          {row.realized !== 0 ? <Money value={row.realized} signed /> : <span className="text-muted">—</span>}
        </Stat>
        <Stat label="XIRR">
          {row.instrumentXirr != null ? <Pct value={row.instrumentXirr} /> : <span className="text-muted" title="Needs dated transactions">—</span>}
        </Stat>
      </div>

      <div className="rounded-(--radius-field) border border-hairline p-3 text-[13px]">
        <div className="flex items-center justify-between">
          <span className="text-muted">Latest price</span>
          <span className="num">
            {row.price != null ? `${row.currency === "USD" ? "$" : "₹"}${formatNav(row.price)}` : "—"}
            {row.priceDate && <span className="ml-1.5 text-muted">as of {formatDate(row.priceDate)}</span>}
          </span>
        </div>
        {row.priceStale && <p className="mt-1 text-[12px] text-warn">Stale — older than expected for its source.</p>}
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            onClose();
            open({ instrumentId: row.id });
          }}
        >
          Log transaction
        </Button>
        <Link
          href={`/transactions?instrument=${row.id}`}
          className="inline-flex h-7 items-center rounded-(--radius-field) border border-hairline px-2.5 text-[13px] text-muted hover:text-ink"
        >
          See in ledger
        </Link>
      </div>

      {row.source !== "manual" && (
        <Field label={row.source === "yahoo" ? "Ticker" : "Scheme code"}>
          <div className="flex gap-2">
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            <Button size="md" onClick={saveIdentifier} disabled={saving || identifier === (row.identifier ?? "")}>
              Save
            </Button>
          </div>
        </Field>
      )}

      <div>
        <div className="eyebrow mb-2">Transactions</div>
        <TransactionLedger
          txns={txns}
          isUsd={row.currency === "USD"}
          emptyMessage="None yet. Log the first one."
        />
      </div>

      {/* exited/unwanted holdings: hide keeps the history, delete destroys it */}
      <div className="border-t border-hairline pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={hide} disabled={hiding}>
            Hide from holdings
          </Button>
          <Button size="sm" variant="ghost" className="text-loss" onClick={() => setConfirmDelete(true)}>
            Delete permanently
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          Hiding removes it from this list but keeps its transactions and realised gains. Deleting erases both.
        </p>
      </div>

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete ${row.name}?`}>
        <p className="text-[13px] text-muted">
          This erases the fund and all {txns.length} of its transactions, including realised gains. Type its name to
          confirm.
        </p>
        <p className="mt-2 select-all rounded-(--radius-field) border border-hairline bg-bg px-2 py-1 text-[12px]">
          {row.name}
        </p>
        <Input
          className="mt-2"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder="Type the name exactly"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" disabled={confirmName !== row.name} onClick={doDelete}>
            Delete
          </Button>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-(--radius-field) border border-hairline p-2.5">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1 text-[15px] font-medium">{children}</div>
    </div>
  );
}
