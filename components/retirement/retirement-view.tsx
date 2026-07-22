"use client";

// Retirement (§4.6): EPF ledger + balances, NPS schemes card.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addEpfEntry,
  addEpfRecurring,
  deleteEpfEntry,
  stopEpfRecurring,
  updateEpfEntry,
} from "@/app/actions/epf";
import { useQuickAdd } from "@/components/quick-add/quick-add";
import { Button } from "@/components/ui/button";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { Money, Pct, Units } from "@/components/ui/money";
import { ConfirmDialog, Sheet, SheetContent } from "@/components/ui/sheet";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate, formatINR, formatNav } from "@/lib/format";
import type { EpfComponent, EpfEntry, EpfEntryType, EpfRecurring } from "@/lib/types";
import { todayIST } from "@/lib/utils";

export interface NpsRow {
  id: string;
  name: string;
  units: number;
  nav: number | null;
  navDate: string | null;
  value: number;
  invested: number;
}

export function RetirementView({
  epfEntries,
  epf,
  nps,
  recurring = [],
  initialAddOpen = false,
}: {
  epfEntries: EpfEntry[];
  recurring?: EpfRecurring[];
  epf: {
    employee: { balance: number; contributions: number; interest: number };
    employer: { balance: number; contributions: number; interest: number };
    self: { balance: number; contributions: number; interest: number };
    combined: { balance: number; contributions: number; interest: number };
  };
  nps: NpsRow[];
  initialAddOpen?: boolean;
}) {
  const router = useRouter();
  const { open } = useQuickAdd();
  const [addOpen, setAddOpen] = useState(initialAddOpen);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [editing, setEditing] = useState<EpfEntry | null>(null);
  const [deleting, setDeleting] = useState<EpfEntry | null>(null);

  // ledger with running balance, newest first for display
  let running = 0;
  const withRunning = epfEntries.map((e) => {
    running += Number(e.amount);
    return { ...e, running };
  });
  const ledger = [...withRunning].reverse();

  async function confirmDelete() {
    const entry = deleting!;
    setDeleting(null);
    const result = await deleteEpfEntry(entry.id);
    if (result.ok) {
      toast(`Deleted EPF entry · ₹${formatINR(Math.abs(Number(entry.amount)))}`);
      router.refresh();
    } else toast.error(result.error);
  }

  const npsTotal = nps.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-4">
      {/* ===== EPF ===== */}
      <SectionCard
        title="EPF"
        action={
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            Add entry
          </Button>
        }
      >
        {epfEntries.length === 0 ? (
          <EmptyState
            message="No EPF entries yet. Start with your passbook's opening balance."
            action={
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                Add EPF entry
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="Employee"><Money value={epf.employee.balance} /></Stat>
              <Stat label="Employer"><Money value={epf.employer.balance} /></Stat>
              {epf.self.balance !== 0 && <Stat label="Self (VPF)"><Money value={epf.self.balance} /></Stat>}
              <Stat label="Combined"><Money value={epf.combined.balance} /></Stat>
              {/* interest received to date — labeled "Interest earned", not P&L (§4.6) */}
              <Stat label="Interest earned"><Money value={epf.combined.interest} signed /></Stat>
            </div>
            <p className="mt-2 text-[12px] text-muted">
              From your EPFO passbook — interest credits land once a year.
            </p>

            <RecurringPanel rules={recurring} />

            <div className="mt-4 flex items-center justify-between gap-2 rounded-(--radius-field) border border-hairline px-3 py-2">
              <span className="text-[13px] text-muted">
                {epfEntries.length} {epfEntries.length === 1 ? "entry" : "entries"} · latest{" "}
                <span className="num">{formatDate(ledger[0].date)}</span>
              </span>
              <Button size="sm" onClick={() => setLedgerOpen(true)}>
                View ledger
              </Button>
            </div>

            <Sheet open={ledgerOpen} onOpenChange={setLedgerOpen}>
              <SheetContent title="EPF ledger" wide>
                <TableWrap>
              <Table>
                <THead>
                  <TR className="border-b border-hairline">
                    <TH first>Date</TH>
                    <TH>Component</TH>
                    <TH>Type</TH>
                    <TH numeric>Amount</TH>
                    <TH numeric>Balance</TH>
                    <TH />
                  </TR>
                </THead>
                <tbody>
                  {ledger.map((e) =>
                    editing?.id === e.id ? (
                      <EditRow key={e.id} entry={e} onDone={() => setEditing(null)} />
                    ) : (
                      <TR key={e.id} className="group">
                        <TD first className="num text-muted">{formatDate(e.date)}</TD>
                        <TD className="capitalize">{e.component}</TD>
                        <TD className="capitalize text-muted">{e.type}</TD>
                        <TD numeric>
                          <Money value={Number(e.amount)} signed={e.type === "adjustment"} />
                          {e.recurring_id && (
                            <span className="ml-1.5 text-[10px] text-muted" title="Added automatically by a recurring rule">
                              auto
                            </span>
                          )}
                        </TD>
                        <TD numeric><Money value={e.running} /></TD>
                        <TD numeric className="w-[64px]">
                          <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              aria-label="Edit entry"
                              className="rounded p-1 text-muted hover:text-ink"
                              onClick={() => setEditing(e)}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              aria-label="Delete entry"
                              className="rounded p-1 text-muted hover:text-loss"
                              onClick={() => setDeleting(e)}
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
              </SheetContent>
            </Sheet>
          </>
        )}
      </SectionCard>

      {/* ===== NPS ===== */}
      <SectionCard
        title="NPS"
        action={
          nps.length > 0 ? (
            <Button variant="primary" size="sm" onClick={() => open({ instrumentId: nps[0].id })}>
              Log contribution
            </Button>
          ) : undefined
        }
      >
        {nps.length === 0 ? (
          <EmptyState message="No NPS schemes yet. Add scheme E/C/G as instruments to track them here." />
        ) : (
          <>
            {npsTotal > 0 && (
              <div className="mb-3 flex h-3 overflow-hidden rounded-full">
                {nps
                  .filter((r) => r.value > 0)
                  .map((r, i) => (
                    <div
                      key={r.id}
                      title={`${r.name} ${((r.value / npsTotal) * 100).toFixed(1)}%`}
                      style={{
                        width: `${(r.value / npsTotal) * 100}%`,
                        background: ["#0F2C3F", "#136370", "#0E9488"][i % 3],
                      }}
                    />
                  ))}
              </div>
            )}
            <TableWrap>
              <Table>
                <THead>
                  <TR className="border-b border-hairline">
                    <TH first>Scheme</TH>
                    <TH numeric>Units</TH>
                    <TH numeric>NAV</TH>
                    <TH numeric>Value</TH>
                    <TH numeric>Allocation</TH>
                  </TR>
                </THead>
                <tbody>
                  {nps.map((r) => (
                    <TR key={r.id}>
                      <TD first className="font-medium">{r.name}</TD>
                      <TD numeric><Units value={r.units} /></TD>
                      <TD numeric>
                        {r.nav != null ? (
                          <>
                            ₹{formatNav(r.nav)}
                            {r.navDate && <span className="block text-[10px] text-muted">as of {formatDate(r.navDate)}</span>}
                          </>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD numeric><Money value={r.value} /></TD>
                      <TD numeric>{npsTotal > 0 ? <Pct value={r.value / npsTotal} signed={false} /> : "—"}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </>
        )}
      </SectionCard>

      {/* add EPF entry */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent title="Add EPF entry">
          <EpfForm
            onDone={(again) => {
              router.refresh();
              if (!again) setAddOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <ConfirmDialog open={deleting != null} onOpenChange={(o) => !o && setDeleting(null)} title="Delete EPF entry?">
        {deleting && (
          <>
            <p className="text-[13px] text-muted">
              {formatDate(deleting.date)} · {deleting.type} · ₹{formatINR(Math.abs(Number(deleting.amount)))}
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

/** Inline edit of one ledger row — avoids a modal inside the ledger modal. */
function EditRow({ entry, onDone }: { entry: EpfEntry & { running: number }; onDone: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(entry.date);
  const [component, setComponent] = useState<EpfComponent>(entry.component);
  const [type, setType] = useState<EpfEntryType>(entry.type);
  const [amount, setAmount] = useState(String(entry.amount));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await updateEpfEntry(entry.id, {
      component,
      type,
      date,
      amount: parseFloat(amount),
      note: entry.note,
    });
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast("Entry updated");
    onDone();
    router.refresh();
  }

  return (
    <TR className="bg-accent-soft/30">
      <TD first>
        <Input className="h-7 w-[130px] text-[12px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </TD>
      <TD>
        <Select
          className="h-7 w-[100px] text-[12px]"
          value={component}
          onChange={(e) => setComponent(e.target.value as EpfComponent)}
        >
          <option value="employee">Employee</option>
          <option value="employer">Employer</option>
          <option value="self">Self</option>
        </Select>
      </TD>
      <TD>
        <Select className="h-7 w-[118px] text-[12px]" value={type} onChange={(e) => setType(e.target.value as EpfEntryType)}>
          <option value="contribution">Contribution</option>
          <option value="interest">Interest</option>
          <option value="opening">Opening</option>
          <option value="adjustment">Adjustment</option>
        </Select>
      </TD>
      <TD numeric>
        <Input
          className="h-7 w-[90px] text-right text-[12px]"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </TD>
      <TD numeric className="text-muted">—</TD>
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

/** Recurring EPF rules: define once, entries appear every month automatically. */
function RecurringPanel({ rules }: { rules: EpfRecurring[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [component, setComponent] = useState<EpfComponent>("employee");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [startDate, setStartDate] = useState(`${todayIST().slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState<EpfRecurring | null>(null);

  const today = todayIST();
  // a rule whose end date has passed has finished generating — show it as done
  const active = rules.filter((r) => r.is_active);
  const ongoing = active.filter((r) => !r.end_date || r.end_date >= today);
  const finished = active.filter((r) => r.end_date && r.end_date < today);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await addEpfRecurring({
      component,
      amount: parseFloat(amount),
      day_of_month: parseInt(day, 10),
      start_date: startDate,
      end_date: endDate || null,
      note: null,
    });
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast(
      result.created > 0
        ? `Recurring set up · ${result.created} past ${result.created === 1 ? "month" : "months"} filled in`
        : "Recurring set up — next entry lands automatically"
    );
    setOpen(false);
    setAmount("");
    setEndDate("");
    router.refresh();
  }

  async function confirmStop() {
    const rule = stopping!;
    setStopping(null);
    const result = await stopEpfRecurring(rule.id);
    if (result.ok) {
      toast("Recurring stopped — existing entries kept");
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <div className="mt-4 rounded-(--radius-field) border border-hairline p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Recurring contributions</span>
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            {active.length ? "Add another" : "Set up recurring"}
          </Button>
        )}
      </div>

      {active.length === 0 && !open && (
        <p className="mt-2 text-[13px] text-muted">
          Same amount every month? Set it once and each month is added for you.
        </p>
      )}

      {active.length > 0 && (
        <div className="mt-2 divide-y divide-hairline">
          {[...ongoing, ...finished].map((r) => {
            const done = r.end_date != null && r.end_date < today;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
                <span className="font-medium capitalize">{r.component}</span>
                <Money value={Number(r.amount)} />
                <span className="text-muted">
                  on day {r.day_of_month} · {formatDate(r.start_date)}
                  {r.end_date ? ` → ${formatDate(r.end_date)}` : " onwards"}
                </span>
                {done && <StatusChip status="matured" className="ml-1" />}
                {!done && (
                  <button
                    type="button"
                    className="ml-auto text-[12px] text-muted hover:text-loss"
                    onClick={() => setStopping(r)}
                  >
                    Stop
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <form onSubmit={save} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Component">
              <Select value={component} onChange={(e) => setComponent(e.target.value as EpfComponent)}>
                <option value="employee">Employee</option>
                <option value="employer">Employer</option>
                <option value="self">Self (VPF)</option>
              </Select>
            </Field>
            <Field label="Amount (₹)">
              <Input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Day of month">
              <Input required inputMode="numeric" min={1} max={28} type="number" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Field label="Starting from">
              <Input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Until (optional)">
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>
          <p className="text-[12px] text-muted">
            Months between the start date and today are added right away; each new month arrives automatically.
            Set an end date for a past period — e.g. one rule per salary revision.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={busy || !amount}>
              Save recurring
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog open={stopping != null} onOpenChange={(o) => !o && setStopping(null)} title="Stop recurring?">
        {stopping && (
          <>
            <p className="text-[13px] text-muted">
              No more monthly entries for {stopping.component} ₹{formatINR(Number(stopping.amount))}. Entries already
              added stay in the ledger.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" onClick={() => setStopping(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={confirmStop}>Stop</Button>
            </div>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-(--radius-field) border border-hairline p-3">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1 text-lg font-medium">{children}</div>
    </div>
  );
}

function EpfForm({ onDone }: { onDone: (again: boolean) => void }) {
  const [component, setComponent] = useState<EpfComponent>("employee");
  const [type, setType] = useState<EpfEntryType>("contribution");
  const [date, setDate] = useState(todayIST());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(again: boolean) {
    setBusy(true);
    const result = await addEpfEntry({
      component,
      type,
      date,
      amount: parseFloat(amount),
      note: note || null,
    });
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast(`Added ${type} · ₹${formatINR(Math.abs(parseFloat(amount)))}`);
    if (again) setAmount("");
    onDone(again);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Component">
          <Select value={component} onChange={(e) => setComponent(e.target.value as EpfComponent)}>
            <option value="employee">Employee</option>
            <option value="employer">Employer</option>
            <option value="self">Self (VPF)</option>
          </Select>
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as EpfEntryType)}>
            <option value="opening">Opening</option>
            <option value="contribution">Contribution</option>
            <option value="interest">Interest</option>
            <option value="adjustment">Adjustment</option>
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={type === "adjustment" ? "Amount (₹, signed)" : "Amount (₹)"}>
          <Input required inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button disabled={busy || !amount} onClick={() => save(true)}>
          Save & add another
        </Button>
        <Button type="submit" variant="primary" disabled={busy || !amount}>
          Save entry
        </Button>
      </div>
    </form>
  );
}
