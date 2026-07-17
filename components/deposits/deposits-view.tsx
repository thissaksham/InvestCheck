"use client";

// Deposits (§4.5): summary band, maturity timeline, register, renewal chains.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { addDeposit, deleteDeposit, markMatured, renewDeposit, updateDeposit } from "@/app/actions/deposits";
import { Button } from "@/components/ui/button";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { ConfirmDialog, Sheet, SheetContent } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { formatCompactINR, formatDate, formatINR } from "@/lib/format";
import type { DepositInput } from "@/lib/schemas";
import type { FdPayout, FixedDeposit } from "@/lib/types";
import { todayIST } from "@/lib/utils";
import { fdSummary } from "@/lib/valuation";

type Fd = FixedDeposit;

export function DepositsView({ fds, initialAddOpen = false }: { fds: Fd[]; initialAddOpen?: boolean }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(initialAddOpen);
  const [holderFilter, setHolderFilter] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<Fd | null>(null);
  const [maturing, setMaturing] = useState<Fd | null>(null);
  const [editing, setEditing] = useState<Fd | null>(null);
  const [deleting, setDeleting] = useState<Fd | null>(null);

  const today = todayIST();
  const summary = fdSummary(fds, today);
  // holder chips derived from data, never hardcoded (§4.5)
  const holders = useMemo(() => [...new Set(fds.map((f) => f.holder))].sort(), [fds]);
  const visible = fds
    .filter((f) => !holderFilter || f.holder === holderFilter)
    .sort((a, b) => a.maturity_date.localeCompare(b.maturity_date));
  const byId = useMemo(() => new Map(fds.map((f) => [f.id, f])), [fds]);
  const parentOf = useMemo(() => {
    const m = new Map<string, Fd>();
    for (const f of fds) if (f.renewed_into) m.set(f.renewed_into, f);
    return m;
  }, [fds]);

  const drawerFd = drawerId ? byId.get(drawerId) ?? null : null;

  async function confirmMature() {
    const fd = maturing!;
    setMaturing(null);
    const result = await markMatured(fd.id);
    if (result.ok) {
      toast(`Marked matured · ${fd.bank} #${fd.deposit_no}`);
      router.refresh();
    } else toast.error(result.error);
  }

  async function confirmDelete() {
    const fd = deleting!;
    setDeleting(null);
    setDrawerId(null);
    const result = await deleteDeposit(fd.id);
    if (result.ok) {
      toast(`Deleted FD #${fd.deposit_no}`);
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <div className="space-y-4">
      {/* 1 · summary band */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Band label="Total principal"><Money value={summary.principal} /></Band>
        <Band label="Maturity value"><Money value={summary.maturityAmount} /></Band>
        <Band label="Projected interest"><Money value={summary.projectedInterest} signed /></Band>
        <Band label="Weighted avg rate">
          {summary.weightedRate != null ? <span className="num">{(summary.weightedRate * 100).toFixed(2)}%</span> : "—"}
        </Band>
        <Band label="Active FDs"><span className="num">{summary.activeCount}</span></Band>
        <Band label="Next maturity">
          {summary.nextMaturity ? <span className="num text-[13px]">{formatDate(summary.nextMaturity.maturity_date)}</span> : "—"}
        </Band>
      </div>

      {/* 2 · maturity timeline: next 12 months */}
      {summary.activeCount > 0 && <Timeline fds={fds.filter((f) => f.status === "active")} today={today} />}

      {/* 3 · register */}
      <div className="flex flex-wrap items-center gap-2">
        {holders.length > 1 &&
          holders.map((h) => (
            <Button key={h} variant="chip" data-on={holderFilter === h} onClick={() => setHolderFilter(holderFilter === h ? null : h)}>
              {h}
            </Button>
          ))}
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => setAddOpen(true)}>
          Add deposit
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          message="No deposits yet. Add your first FD."
          action={
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Add deposit
            </Button>
          }
        />
      ) : (
        <TableWrap className="rounded-(--radius-card) border border-hairline bg-surface">
          <Table>
            <THead>
              <TR className="border-b border-hairline">
                <TH first>Deposit no</TH>
                <TH>Bank</TH>
                <TH>Holder</TH>
                <TH numeric>Principal</TH>
                <TH numeric>Rate</TH>
                <TH numeric>Maturity amount</TH>
                <TH numeric>Maturity date</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {visible.map((f) => (
                <TR key={f.id} onClick={() => setDrawerId(f.id)}>
                  <TD first className="num font-medium">
                    #{f.deposit_no}
                    {f.renewed_into && (
                      <span className="block text-[11px] text-muted">
                        ↳ renewed into #{byId.get(f.renewed_into)?.deposit_no ?? "?"}
                      </span>
                    )}
                  </TD>
                  <TD>{f.bank}</TD>
                  <TD>
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">{f.holder}</span>
                  </TD>
                  <TD numeric><Money value={Number(f.principal)} /></TD>
                  <TD numeric>{(Number(f.rate) * 100).toFixed(2)}%</TD>
                  <TD numeric>{f.maturity_amount != null ? <Money value={Number(f.maturity_amount)} /> : "—"}</TD>
                  <TD numeric>{formatDate(f.maturity_date)}</TD>
                  <TD><StatusChip status={f.status} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {/* add / edit / renew sheets */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent title="Add deposit">
          <DepositForm
            onSubmit={async (input, again) => {
              const result = await addDeposit(input);
              if (!result.ok) return void toast.error(result.error);
              toast(`Added FD #${input.deposit_no} · ${input.bank}`);
              router.refresh();
              if (!again) setAddOpen(false);
              return true;
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <SheetContent title={`Edit FD #${editing.deposit_no}`}>
            <DepositForm
              initial={editing}
              onSubmit={async (input) => {
                const result = await updateDeposit(editing.id, input);
                if (!result.ok) return void toast.error(result.error);
                toast(`Updated FD #${input.deposit_no}`);
                setEditing(null);
                router.refresh();
                return true;
              }}
            />
          </SheetContent>
        )}
      </Sheet>

      <Sheet open={renewing != null} onOpenChange={(o) => !o && setRenewing(null)}>
        {renewing && (
          <SheetContent title={`Renew FD #${renewing.deposit_no}`}>
            <p className="mb-4 text-[13px] text-muted">
              The matured deposit stays in the register and links to its renewal — the chain counts once in totals.
            </p>
            <DepositForm
              initial={{
                ...renewing,
                deposit_no: "",
                principal: renewing.maturity_amount ?? renewing.principal,
                start_date: today,
                maturity_amount: null,
              }}
              onSubmit={async (input) => {
                const result = await renewDeposit(renewing.id, input);
                if (!result.ok) return void toast.error(result.error);
                toast(`Renewed into FD #${input.deposit_no}`);
                setRenewing(null);
                setDrawerId(null);
                router.refresh();
                return true;
              }}
            />
          </SheetContent>
        )}
      </Sheet>

      {/* row drawer: chain + actions */}
      <Sheet open={drawerFd != null} onOpenChange={(o) => !o && setDrawerId(null)}>
        {drawerFd && (
          <SheetContent title={`${drawerFd.bank} · #${drawerFd.deposit_no}`}>
            <FdDrawer
              fd={drawerFd}
              byId={byId}
              parentOf={parentOf}
              onRenew={() => setRenewing(drawerFd)}
              onMature={() => setMaturing(drawerFd)}
              onEdit={() => {
                setDrawerId(null);
                setEditing(drawerFd);
              }}
              onDelete={() => setDeleting(drawerFd)}
            />
          </SheetContent>
        )}
      </Sheet>

      <ConfirmDialog open={maturing != null} onOpenChange={(o) => !o && setMaturing(null)} title="Mark matured?">
        {maturing && (
          <>
            <p className="text-[13px] text-muted">
              #{maturing.deposit_no} · {maturing.bank} · ₹{formatINR(Number(maturing.principal))} leaves the active totals.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" onClick={() => setMaturing(null)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={confirmMature}>Mark matured</Button>
            </div>
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog open={deleting != null} onOpenChange={(o) => !o && setDeleting(null)} title="Delete deposit?">
        {deleting && (
          <>
            <p className="text-[13px] text-muted">#{deleting.deposit_no} · {deleting.bank}. This can't be undone.</p>
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

function Band({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-(--radius-card) border border-hairline bg-surface p-3">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1 text-[15px] font-medium">{children}</div>
    </div>
  );
}

function Timeline({ fds, today }: { fds: Fd[]; today: string }) {
  const months: { key: string; label: string; fds: Fd[] }[] = [];
  const start = new Date(`${today.slice(0, 7)}-01T00:00:00`);
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleDateString("en-GB", { month: "short" }) + " " + String(d.getFullYear()).slice(2),
      fds: fds.filter((f) => f.maturity_date.slice(0, 7) === key),
    });
  }
  return (
    <div className="overflow-x-auto rounded-(--radius-card) border border-hairline bg-surface p-3">
      <div className="eyebrow mb-2">Maturities · next 12 months</div>
      <div className="flex min-w-[720px] gap-1">
        {months.map((m) => (
          <div key={m.key} className="flex-1 rounded-(--radius-field) border border-hairline/60 p-1.5">
            <div className="num text-center text-[10px] text-muted">{m.label}</div>
            <div className="mt-1 space-y-1">
              {m.fds.map((f) => (
                <div
                  key={f.id}
                  title={`#${f.deposit_no} · ${f.bank} · ${formatDate(f.maturity_date)}`}
                  className="num truncate rounded bg-accent-soft px-1 py-0.5 text-center text-[10px] text-accent"
                >
                  {formatCompactINR(Number(f.principal))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FdDrawer({
  fd,
  byId,
  parentOf,
  onRenew,
  onMature,
  onEdit,
  onDelete,
}: {
  fd: Fd;
  byId: Map<string, Fd>;
  parentOf: Map<string, Fd>;
  onRenew: () => void;
  onMature: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // full chain (§4.5): walk to the root, then forward
  const chain: Fd[] = [];
  let root = fd;
  while (parentOf.has(root.id)) root = parentOf.get(root.id)!;
  let cursor: Fd | undefined = root;
  while (cursor) {
    chain.push(cursor);
    cursor = cursor.renewed_into ? byId.get(cursor.renewed_into) : undefined;
  }
  const today = todayIST();
  const matured = fd.maturity_date <= today && fd.status === "active";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Principal"><Money value={Number(fd.principal)} /></Stat>
        <Stat label="Rate"><span className="num">{(Number(fd.rate) * 100).toFixed(2)}%</span></Stat>
        <Stat label="Maturity amount">{fd.maturity_amount != null ? <Money value={Number(fd.maturity_amount)} /> : <>—</>}</Stat>
        <Stat label="Maturity date"><span className="num text-[13px]">{formatDate(fd.maturity_date)}</span></Stat>
        <Stat label="Holder">{fd.holder}</Stat>
        <Stat label="Payout">{fd.payout}{fd.monthly_payout != null && <span className="block text-[11px] text-muted num">₹{formatINR(Number(fd.monthly_payout))}/mo</span>}</Stat>
      </div>
      {fd.note && <p className="text-[13px] text-muted">{fd.note}</p>}

      {chain.length > 1 && (
        <div>
          <div className="eyebrow mb-2">Renewal chain</div>
          <div className="space-y-1">
            {chain.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 text-[13px]">
                <span className="num text-muted">{i > 0 ? "↳" : ""}</span>
                <span className={c.id === fd.id ? "font-semibold" : undefined}>#{c.deposit_no}</span>
                <Money value={Number(c.principal)} compact className="text-muted" />
                <span className="num text-[11px] text-muted">{formatDate(c.maturity_date)}</span>
                <StatusChip status={c.status} className="ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(fd.status === "active" || fd.status === "matured") && (
          <Button variant="primary" size="sm" onClick={onRenew}>Renew</Button>
        )}
        {matured && <Button size="sm" onClick={onMature}>Mark matured</Button>}
        <Button size="sm" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" className="ml-auto text-loss" onClick={onDelete}>Delete</Button>
      </div>
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

// ===== form (bulk-friendly: save-and-add-another keeps bank + holder, §18) =====

function DepositForm({
  initial,
  onSubmit,
}: {
  initial?: Partial<Fd>;
  onSubmit: (input: DepositInput, again: boolean) => Promise<boolean | void>;
}) {
  const [depositNo, setDepositNo] = useState(initial?.deposit_no ?? "");
  const [bank, setBank] = useState(initial?.bank ?? "");
  const [holder, setHolder] = useState(initial?.holder ?? "Self");
  const [principal, setPrincipal] = useState(initial?.principal != null ? String(initial.principal) : "");
  const [ratePct, setRatePct] = useState(initial?.rate != null ? (Number(initial.rate) * 100).toFixed(2) : "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [maturityDate, setMaturityDate] = useState(initial?.maturity_date ?? "");
  const [maturityAmount, setMaturityAmount] = useState(
    initial?.maturity_amount != null ? String(initial.maturity_amount) : ""
  );
  const [payout, setPayout] = useState<FdPayout>(initial?.payout ?? "cumulative");
  const [monthlyPayout, setMonthlyPayout] = useState(
    initial?.monthly_payout != null ? String(initial.monthly_payout) : ""
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(again: boolean) {
    setBusy(true);
    const ok = await onSubmit(
      {
        deposit_no: depositNo,
        bank,
        holder,
        principal: parseFloat(principal),
        rate_pct: parseFloat(ratePct),
        start_date: startDate || null,
        maturity_date: maturityDate,
        maturity_amount: maturityAmount ? parseFloat(maturityAmount) : null,
        payout,
        monthly_payout: monthlyPayout ? parseFloat(monthlyPayout) : null,
        note: note || null,
      },
      again
    );
    setBusy(false);
    if (ok && again) {
      // keep bank + holder for the next one
      setDepositNo("");
      setPrincipal("");
      setRatePct("");
      setStartDate("");
      setMaturityDate("");
      setMaturityAmount("");
      setNote("");
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Deposit no">
          <Input required autoFocus value={depositNo} onChange={(e) => setDepositNo(e.target.value)} />
        </Field>
        <Field label="Bank">
          <Input required value={bank} onChange={(e) => setBank(e.target.value)} />
        </Field>
        <Field label="Holder">
          <Input required value={holder} onChange={(e) => setHolder(e.target.value)} />
        </Field>
        <Field label="Principal (₹)">
          <Input required inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
        </Field>
        <Field label="Rate (% p.a.)">
          <Input required inputMode="decimal" placeholder="7.50" value={ratePct} onChange={(e) => setRatePct(e.target.value)} />
        </Field>
        <Field label="Maturity amount (₹)">
          <Input inputMode="decimal" value={maturityAmount} onChange={(e) => setMaturityAmount(e.target.value)} />
        </Field>
        <Field label="Start date">
          <Input type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Maturity date">
          <Input required type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
        </Field>
        <Field label="Payout">
          <Select value={payout} onChange={(e) => setPayout(e.target.value as FdPayout)}>
            <option value="cumulative">Cumulative</option>
            <option value="monthly">Monthly interest</option>
          </Select>
        </Field>
        {payout === "monthly" && (
          <Field label="Monthly payout (₹)">
            <Input inputMode="decimal" value={monthlyPayout} onChange={(e) => setMonthlyPayout(e.target.value)} />
          </Field>
        )}
      </div>
      <Field label="Note">
        <Input value={note ?? ""} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button disabled={busy} onClick={() => submit(true)}>
          Save & add another
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          Save deposit
        </Button>
      </div>
    </form>
  );
}
