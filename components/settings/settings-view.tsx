"use client";

// Settings (§4.7): profile & theme, instruments manager, manual price, export, danger zone.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteInstrument, updateInstrument } from "@/app/actions/instruments";
import { setManualPrice } from "@/app/actions/prices";
import { deleteAllData, updateProfile } from "@/app/actions/settings";
import { ThemeToggle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/sheet";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { createClient } from "@/lib/supabase/browser";
import type { Instrument } from "@/lib/types";
import { todayIST } from "@/lib/utils";

export function SettingsView({
  instruments,
  displayName,
  email,
}: {
  instruments: Instrument[];
  displayName: string | null;
  email: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState<Instrument | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [dangerOpen, setDangerOpen] = useState(false);
  const [dangerText, setDangerText] = useState("");

  const needsIdentifier = instruments.filter((i) => !i.identifier && i.source !== "manual");

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    const result = await updateProfile(name);
    setSavingName(false);
    if (!result.ok) return void toast.error(result.error);
    toast("Profile updated");
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function confirmDeleteInstrument() {
    const instrument = deleting!;
    const result = await deleteInstrument(instrument.id, confirmName);
    if (!result.ok) return void toast.error(result.error);
    setDeleting(null);
    setConfirmName("");
    toast(`Deleted ${instrument.name} and its transactions`);
    router.refresh();
  }

  async function confirmDangerDelete() {
    const result = await deleteAllData(dangerText);
    if (!result.ok) return void toast.error(result.error);
    setDangerOpen(false);
    setDangerText("");
    toast("All data deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Profile">
        <form onSubmit={saveName} className="flex flex-wrap items-end gap-3">
          <Field label="Display name" className="w-64">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={email ?? ""} />
          </Field>
          <Button type="submit" disabled={savingName}>
            Save
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[13px] text-muted">Theme</span>
            <ThemeToggle />
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </form>
        {email && <p className="mt-2 text-[12px] text-muted">Signed in as {email}</p>}
      </SectionCard>

      <SectionCard title="Instruments">
        {needsIdentifier.length > 0 && (
          <div className="mb-3 rounded-(--radius-field) border border-warn/40 bg-warn/5 p-3">
            <p className="text-[13px] font-medium text-warn">
              Needs identifier — excluded from refresh until filled:
            </p>
            <p className="mt-1 text-[13px] text-muted">{needsIdentifier.map((i) => i.name).join(" · ")}</p>
          </div>
        )}
        {instruments.length === 0 ? (
          <EmptyState message="No instruments yet. Add them from Holdings." />
        ) : (
          <div className="divide-y divide-hairline">
            {instruments.map((i) => (
              <InstrumentRow key={i.id} instrument={i} onDelete={() => setDeleting(i)} />
            ))}
          </div>
        )}
      </SectionCard>

      <ManualPriceCard instruments={instruments} />

      <SectionCard title="Export">
        <p className="text-[13px] text-muted">Everything — instruments, ledger, deposits, EPF, snapshots — as one workbook.</p>
        <a
          href="/api/export"
          className="mt-3 inline-flex h-9 items-center rounded-(--radius-field) border border-hairline bg-surface px-3.5 text-sm font-medium hover:border-accent/50"
        >
          Download .xlsx
        </a>
      </SectionCard>

      <SectionCard title="Danger zone" className="border-loss/30">
        <p className="text-[13px] text-muted">Deletes every instrument, transaction, deposit, EPF entry and snapshot. No undo.</p>
        <Button variant="destructive" size="sm" className="mt-3" onClick={() => setDangerOpen(true)}>
          Delete all data
        </Button>
      </SectionCard>

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(o) => {
          if (!o) {
            setDeleting(null);
            setConfirmName("");
          }
        }}
        title={`Delete ${deleting?.name}?`}
      >
        <p className="text-[13px] text-muted">
          This deletes the instrument and all its transactions and prices. Type its name to confirm.
        </p>
        <Input className="mt-3" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={deleting?.name} />
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button size="sm" variant="destructive" disabled={confirmName !== deleting?.name} onClick={confirmDeleteInstrument}>
            Delete instrument
          </Button>
        </div>
      </ConfirmDialog>

      <ConfirmDialog open={dangerOpen} onOpenChange={setDangerOpen} title="Delete all data?">
        <p className="text-[13px] text-muted">Type DELETE to confirm. This cannot be undone.</p>
        <Input className="mt-3" value={dangerText} onChange={(e) => setDangerText(e.target.value)} placeholder="DELETE" />
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" onClick={() => setDangerOpen(false)}>Cancel</Button>
          <Button size="sm" variant="destructive" disabled={dangerText !== "DELETE"} onClick={confirmDangerDelete}>
            Delete everything
          </Button>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function InstrumentRow({ instrument, onDelete }: { instrument: Instrument; onDelete: () => void }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(instrument.identifier ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await updateInstrument(instrument.id, { identifier });
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast(`Identifier updated · ${instrument.name}`);
    router.refresh();
  }

  async function toggleActive() {
    setBusy(true);
    const result = await updateInstrument(instrument.id, { is_active: !instrument.is_active });
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast(instrument.is_active ? `Hidden · ${instrument.name}` : `Restored · ${instrument.name}`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {instrument.name}
          {!instrument.is_active && <StatusChip status="hidden" className="ml-2" />}
        </span>
        <span className="text-[11px] text-muted">
          {instrument.type} · {instrument.source} · {instrument.currency}
        </span>
      </div>
      {!instrument.identifier && instrument.source !== "manual" && <StatusChip status="needs code" />}
      {instrument.source !== "manual" && (
        <>
          <Input
            className="num h-8 w-36 text-[13px]"
            value={identifier}
            placeholder="identifier"
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <Button size="sm" onClick={save} disabled={busy || identifier === (instrument.identifier ?? "")}>
            Save
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" onClick={toggleActive} disabled={busy}>
        {instrument.is_active ? "Hide" : "Restore"}
      </Button>
      <Button size="sm" variant="ghost" className="text-loss" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}

function ManualPriceCard({ instruments }: { instruments: Instrument[] }) {
  const router = useRouter();
  const [instrumentId, setInstrumentId] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayIST());
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await setManualPrice({ instrument_id: instrumentId, price: parseFloat(price), date });
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast("Manual price saved");
    setPrice("");
    router.refresh();
  }

  return (
    <SectionCard title="Manual price override">
      <form onSubmit={save} className="flex flex-wrap items-end gap-3">
        <Field label="Instrument" className="w-64">
          <Select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
            <option value="">Pick one…</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Price" className="w-32">
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Date" className="w-40">
          <Input type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy || !instrumentId || !price}>
          Save price
        </Button>
      </form>
      <p className="mt-2 text-[12px] text-muted">Writes a price row with source=&quot;manual&quot; for that date.</p>
    </SectionCard>
  );
}
