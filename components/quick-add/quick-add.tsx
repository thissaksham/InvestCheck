"use client";

// Quick-Add (§5): global sheet, ≤5s to log. ⌘K / '/' on desktop, FAB on mobile.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { logTransaction } from "@/app/actions/transactions";
import {
  addInstrument,
  detectInstrument,
  searchInstruments,
  type DetectedInstrument,
  type InstrumentHit,
} from "@/app/actions/instruments";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ConfirmDialog, Sheet, SheetContent } from "@/components/ui/sheet";
import { formatDate, formatINR, formatNav, formatUnits } from "@/lib/format";
import type { TransactionInput } from "@/lib/schemas";
import type { Bucket, Currency, InstrumentType, PriceSource, TxnType } from "@/lib/types";
import { todayIST } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface QuickAddInstrument {
  id: string;
  name: string;
  type: InstrumentType;
  currency: Currency;
  price: number | null; // native currency
  priceDate: string | null;
}

interface QuickAddData {
  instruments: QuickAddInstrument[];
  recentIds: string[];
  fxRate: number | null;
  hasAnyTxn: boolean;
}

interface Preset {
  instrumentId?: string;
  mode?: TxnType;
}

const QuickAddContext = createContext<{ open: (preset?: Preset) => void }>({ open: () => {} });
export const useQuickAdd = () => useContext(QuickAddContext);

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function QuickAddProvider({ data, children }: { data: QuickAddData; children: React.ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"log" | "new-instrument">("log");

  // form state
  const [instrumentId, setInstrumentId] = useState<string | null>(null);
  const [comboQuery, setComboQuery] = useState("");
  const [txnType, setTxnType] = useState<TxnType>("buy");
  const [openingAllowed, setOpeningAllowed] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [units, setUnits] = useState("");
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "pick">("today");
  const [pickedDate, setPickedDate] = useState(todayIST());
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [dupPending, setDupPending] = useState<TransactionInput | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const instrument = data.instruments.find((i) => i.id === instrumentId) ?? null;
  const isUsd = instrument?.currency === "USD";

  const reset = useCallback(
    (preset?: Preset) => {
      setView("log");
      setInstrumentId(preset?.instrumentId ?? null);
      setComboQuery("");
      setTxnType(preset?.mode ?? "buy");
      // Opening mode: third toggle state, shown while onboarding or from the checklist (§18)
      setOpeningAllowed(!data.hasAnyTxn || preset?.mode === "opening");
      setAmount("");
      setAmountUsd("");
      setUnits("");
      setDateMode("today");
      setPickedDate(todayIST());
      setNote("");
      setShowNote(false);
    },
    [data.hasAnyTxn]
  );

  const open = useCallback(
    (preset?: Preset) => {
      reset(preset);
      setIsOpen(true);
    },
    [reset]
  );

  // ⌘K / ctrl+K / '/' — global (§5)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const txnDate =
    dateMode === "today"
      ? todayIST()
      : dateMode === "yesterday"
        ? iso(new Date(Date.now() - 86400000))
        : pickedDate;

  // dual ₹/$ fill from latest USDINR — user's exact figures always win (§5)
  function onAmountChange(v: string) {
    setAmount(v);
    if (isUsd && data.fxRate) {
      const n = parseFloat(v);
      setAmountUsd(isFinite(n) && n > 0 ? (n / data.fxRate).toFixed(2) : "");
    }
  }
  function onAmountUsdChange(v: string) {
    setAmountUsd(v);
    if (data.fxRate) {
      const n = parseFloat(v);
      setAmount(isFinite(n) && n > 0 ? (n * data.fxRate).toFixed(2) : "");
    }
  }

  // units helper: ≈ 35.06 units @ ₹142.60 (latest NAV)
  const unitsHint = useMemo(() => {
    if (!instrument?.price) return null;
    const native = isUsd ? parseFloat(amountUsd) : parseFloat(amount);
    if (!isFinite(native) || native <= 0) return null;
    return { units: native / instrument.price, price: instrument.price };
  }, [instrument, amount, amountUsd, isUsd]);

  async function submit(keepOpen: boolean) {
    if (!instrument) return void toast.error("Pick an instrument first.");
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) return void toast.error("Amount must be more than 0.");

    const input: TransactionInput = {
      instrument_id: instrument.id,
      type: txnType,
      date: txnDate,
      amount: amt,
      amount_usd: isUsd && amountUsd ? parseFloat(amountUsd) : null,
      units: units ? parseFloat(units) : 0,
      note: note || null,
    };

    // optimistic close (§5) — don't block the sheet on the roundtrip
    if (!keepOpen) setIsOpen(false);
    else {
      const kept = instrument.id;
      reset();
      setInstrumentId(kept);
    }

    const verb = txnType === "sell" ? "Sold" : txnType === "opening" ? "Opening balance" : "Logged";
    const result = await logTransaction(input);
    if (result.ok) {
      toast(`${verb} ₹${formatINR(amt)} · ${instrument.name}`);
      router.refresh();
    } else if ("duplicate" in result && result.duplicate) {
      setDupPending(input);
    } else if ("error" in result) {
      toast.error(result.error);
    }
  }

  async function forceDuplicate() {
    const input = dupPending!;
    setDupPending(null);
    const result = await logTransaction({ ...input, force: true });
    if (result.ok) {
      toast(`Logged ₹${formatINR(input.amount)} (duplicate confirmed)`);
      router.refresh();
    } else if ("error" in result) {
      toast.error(result.error);
    }
  }

  const orderedRecents = data.recentIds
    .map((id) => data.instruments.find((i) => i.id === id))
    .filter((i): i is QuickAddInstrument => !!i);
  const rest = data.instruments.filter((i) => !data.recentIds.includes(i.id));

  return (
    <QuickAddContext.Provider value={{ open }}>
      {children}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {view === "log" ? (
          <SheetContent title="Log transaction">
            <form
              className="space-y-4"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey) {
                  e.preventDefault();
                  submit(true); // Shift+Enter = log & keep open (SIP-day batch, §5)
                }
              }}
              onSubmit={(e) => {
                e.preventDefault();
                submit(false);
              }}
            >
              {/* 1 · instrument combobox */}
              <Command
                label="Instrument"
                className="rounded-(--radius-field) border border-hairline"
                filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase().trim()) ? 1 : 0)}
              >
                <Command.Input
                  autoFocus
                  value={comboQuery}
                  onValueChange={setComboQuery}
                  placeholder="Search instrument…"
                  className="h-9 w-full rounded-t-(--radius-field) border-b border-hairline bg-surface px-3 text-sm outline-none placeholder:text-muted/70"
                />
                <Command.List className="max-h-44 overflow-y-auto p-1">
                  <Command.Empty className="px-3 py-2 text-[13px] text-muted">
                    Not in your portfolio yet — continue below to add it.
                  </Command.Empty>
                  {orderedRecents.length > 0 && (
                    <Command.Group heading={<GroupHeading>Recent</GroupHeading>}>
                      {orderedRecents.map((i) => (
                        <InstrumentItem key={i.id} i={i} selected={instrumentId === i.id} onSelect={() => pick(i.id)} />
                      ))}
                    </Command.Group>
                  )}
                  <Command.Group heading={rest.length ? <GroupHeading>All</GroupHeading> : undefined}>
                    {rest.map((i) => (
                      <InstrumentItem key={i.id} i={i} selected={instrumentId === i.id} onSelect={() => pick(i.id)} />
                    ))}
                  </Command.Group>
                </Command.List>
                <button
                  type="button"
                  onClick={() => setView("new-instrument")}
                  className="w-full border-t border-hairline px-3 py-2 text-left text-[13px] text-accent hover:bg-accent-soft/50"
                >
                  {comboQuery.trim() ? `Search everywhere for “${comboQuery.trim()}”…` : "New instrument…"}
                </button>
              </Command>

              {/* 2 · amount (dual ₹/$ for USD instruments) */}
              <div className={cn("grid gap-3", isUsd && "grid-cols-2")}>
                <Field label="Amount (₹)">
                  <Input
                    ref={amountRef}
                    inputMode="decimal"
                    placeholder="5,000"
                    value={amount}
                    onChange={(e) => onAmountChange(e.target.value)}
                  />
                </Field>
                {isUsd && (
                  <Field label="Amount ($)">
                    <Input
                      inputMode="decimal"
                      placeholder="60.00"
                      value={amountUsd}
                      onChange={(e) => onAmountUsdChange(e.target.value)}
                    />
                  </Field>
                )}
              </div>
              {isUsd && !data.fxRate && (
                <p className="-mt-2 text-[12px] text-warn">No USDINR rate yet — refresh to fetch FX. Entry still works.</p>
              )}

              {/* 3 · units (optional) */}
              <Field label="Units (optional)">
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                />
              </Field>
              {unitsHint && (
                <div className="-mt-2 flex items-center gap-2 text-[12px] text-muted">
                  <span className="num">
                    ≈ {formatUnits(unitsHint.units)} units @ {isUsd ? "$" : "₹"}
                    {formatNav(unitsHint.price)} (latest {instrument?.type === "mutual_fund" ? "NAV" : "price"})
                  </span>
                  <button
                    type="button"
                    className="font-medium text-accent hover:underline"
                    onClick={() => setUnits(unitsHint.units.toFixed(3))}
                  >
                    Use
                  </button>
                </div>
              )}

              {/* 4 · date chips */}
              <div className="flex items-center gap-2">
                {(["today", "yesterday", "pick"] as const).map((m) => (
                  <Button key={m} variant="chip" data-on={dateMode === m} onClick={() => setDateMode(m)}>
                    {m === "today" ? "Today" : m === "yesterday" ? "Yesterday" : "Pick"}
                  </Button>
                ))}
                {dateMode === "pick" && (
                  <Input
                    type="date"
                    className="w-auto"
                    value={pickedDate}
                    max={todayIST()}
                    onChange={(e) => setPickedDate(e.target.value)}
                  />
                )}
              </div>

              {/* 5 · buy/sell toggle (+ opening while onboarding) */}
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-(--radius-field) border border-hairline p-0.5">
                  {(openingAllowed ? (["buy", "sell", "opening"] as const) : (["buy", "sell"] as const)).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTxnType(t)}
                      className={cn(
                        "rounded-[6px] px-3 py-1 text-[13px] font-medium capitalize transition-colors",
                        txnType === t ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
                      )}
                    >
                      {t === "opening" ? "Opening balance" : t}
                    </button>
                  ))}
                </div>
                {!showNote && (
                  <button type="button" className="text-[13px] text-muted hover:text-ink" onClick={() => setShowNote(true)}>
                    + note
                  </button>
                )}
              </div>
              {showNote && (
                <Input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted">Shift+Enter logs & keeps open</span>
                <Button type="submit" variant="primary" disabled={!instrument || !amount}>
                  Log transaction
                </Button>
              </div>
            </form>
          </SheetContent>
        ) : (
          <SheetContent title="New instrument">
            <NewInstrumentForm
              initialQuery={comboQuery}
              onDone={(id) => {
                router.refresh();
                setView("log");
                if (id) setInstrumentId(id);
              }}
              onCancel={() => setView("log")}
            />
          </SheetContent>
        )}
      </Sheet>

      <ConfirmDialog
        open={dupPending != null}
        onOpenChange={(o) => !o && setDupPending(null)}
        title="Looks like a duplicate"
      >
        <p className="text-[13px] text-muted">
          The same amount was logged for this instrument on the same date within the last minute.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" onClick={() => setDupPending(null)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={forceDuplicate}>
            Log anyway
          </Button>
        </div>
      </ConfirmDialog>
    </QuickAddContext.Provider>
  );

  function pick(id: string) {
    setInstrumentId(id);
    amountRef.current?.focus();
  }
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow block px-2 pb-1 pt-2">{children}</span>;
}

function InstrumentItem({
  i,
  selected,
  onSelect,
}: {
  i: QuickAddInstrument;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={i.name}
      onSelect={onSelect}
      className="flex cursor-pointer items-center justify-between rounded-[6px] px-2 py-1.5 text-sm data-[selected=true]:bg-accent-soft/60"
    >
      <span className="truncate">{i.name}</span>
      <span className="ml-2 flex items-center gap-1.5 text-[11px] text-muted">
        {i.currency === "USD" && <span>$</span>}
        {selected && <Check size={14} className="text-accent" />}
      </span>
    </Command.Item>
  );
}

// ===== inline new-instrument form =====
// One identifier → Find → name/type/currency/bucket auto-detected from the
// source API. "Advanced" is the correction hatch; "Add manually" covers
// unlisted things (source='manual', priced via Settings → manual override).

const TYPE_LABELS: Record<InstrumentType, string> = {
  stock: "Stock",
  etf: "ETF",
  mutual_fund: "Mutual fund",
  nps: "NPS scheme",
};

const BUCKET_LABELS: Record<Bucket, string> = {
  indian_equity: "Indian equity",
  intl_equity: "Intl equity",
  gold: "Gold",
  debt_liquid: "Debt & liquid",
  retirement: "Retirement",
};

const CODE_PATTERN = /^(\d{4,7}|SM\d+|[A-Za-z0-9&.-]+\.(NS|BO))$/i;

export function NewInstrumentForm({
  onDone,
  onCancel,
  keepOpenOption,
  initialQuery,
}: {
  onDone: (newId: string | null) => void;
  onCancel?: () => void;
  keepOpenOption?: boolean;
  /** carried over from the quick-add combobox — auto-searches on mount */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [hits, setHits] = useState<InstrumentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [detected, setDetected] = useState<DetectedInstrument | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // advanced overrides (prefilled by detection)
  const [type, setType] = useState<InstrumentType>("stock");
  const [bucket, setBucket] = useState<Bucket>("indian_equity");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [busy, setBusy] = useState(false);

  // debounced name search across yahoo + mfapi
  useEffect(() => {
    if (manualMode || detected) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const result = await searchInstruments(q);
      setSearching(false);
      if (result.ok) setHits(result.hits);
    }, 300);
    return () => clearTimeout(t);
  }, [query, manualMode, detected]);

  async function pickIdentifier(identifier: string) {
    setChecking(true);
    setCheckError(null);
    setHits([]);
    const result = await detectInstrument(identifier);
    setChecking(false);
    if (!result.ok) return void setCheckError(result.error);
    setDetected(result.data);
    setType(result.data.type);
    setBucket(result.data.bucket);
    setCurrency(result.data.currency);
    if (result.data.name) setName(result.data.name);
  }

  async function save(addAnother: boolean) {
    setBusy(true);
    const result = await addInstrument({
      name,
      type,
      bucket,
      currency,
      source: manualMode ? "manual" : (detected?.source as PriceSource),
      identifier: manualMode ? null : detected?.identifier ?? null,
    });
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast(`Added ${name}`);
    if (addAnother) {
      setQuery("");
      setHits([]);
      setDetected(null);
      setName("");
      setCheckError(null);
      setShowAdvanced(false);
    } else {
      onDone(result.data?.id ?? null);
    }
  }

  const canSave = Boolean(name.trim()) && (manualMode || detected != null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) save(false);
      }}
    >
      {!manualMode && (
        <>
          <Field label="Search by name">
            <Input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDetected(null);
                setCheckError(null);
              }}
              onKeyDown={(e) => {
                // power users can still paste a ticker/scheme code and hit Enter
                if (e.key === "Enter" && !detected) {
                  e.preventDefault();
                  if (CODE_PATTERN.test(query.trim())) pickIdentifier(query.trim());
                }
              }}
              placeholder="reliance · uti nifty 50 · apple"
            />
          </Field>
          {!detected && (
            <p className="-mt-2 text-[11px] text-muted">
              Stocks, ETFs and mutual funds — Indian and US. NPS scheme? Paste its code (SM…) and press Enter.
            </p>
          )}

          {(searching || checking) && (
            <p className="text-[12px] text-muted">{checking ? "Fetching latest price…" : "Searching…"}</p>
          )}

          {hits.length > 0 && !detected && (
            <div className="max-h-56 overflow-y-auto rounded-(--radius-field) border border-hairline">
              {(["market", "mf"] as const).map((group) => {
                const groupHits = hits.filter((h) => h.group === group);
                if (groupHits.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="eyebrow bg-bg px-3 py-1.5">
                      {group === "market" ? "Stocks & ETFs" : "Mutual funds"}
                    </div>
                    {groupHits.map((h) => (
                      <button
                        key={h.identifier}
                        type="button"
                        onClick={() => pickIdentifier(h.identifier)}
                        className="block w-full border-t border-hairline px-3 py-2 text-left hover:bg-accent-soft/50"
                      >
                        <span className="block truncate text-sm">{h.label}</span>
                        <span className="text-[11px] text-muted">{h.sub}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {!searching && !checking && !detected && query.trim().length >= 2 && hits.length === 0 && (
            <p className="text-[12px] text-muted">No matches. Try another spelling, or add it manually below.</p>
          )}
        </>
      )}

      {checkError && <p className="text-[12px] text-loss">{checkError}</p>}

      {detected && !manualMode && (
        <div className="rounded-(--radius-field) border border-hairline bg-accent-soft/30 p-3 text-[13px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">✓ Found</span>
            <span className="num">
              {detected.currency === "USD" ? "$" : "₹"}
              {formatNav(detected.price)}
              <span className="ml-1 text-muted">as of {formatDate(detected.asOf)}</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip>{TYPE_LABELS[type]}</Chip>
            <Chip>{currency}</Chip>
            <Chip>{BUCKET_LABELS[bucket]}</Chip>
            <button
              type="button"
              className="ml-auto text-[12px] text-accent hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide" : "Change"}
            </button>
          </div>
        </div>
      )}

      {(detected || manualMode) && (
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="UTI Nifty 50 Index Fund" />
        </Field>
      )}

      {(showAdvanced || manualMode) && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as InstrumentType)}>
              {(Object.keys(TYPE_LABELS) as InstrumentType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bucket">
            <Select value={bucket} onChange={(e) => setBucket(e.target.value as Bucket)}>
              {(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => (
                <option key={b} value={b}>
                  {BUCKET_LABELS[b]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-3">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Back
            </Button>
          )}
          <button
            type="button"
            className="text-[12px] text-muted hover:text-ink"
            onClick={() => {
              setManualMode((v) => !v);
              setDetected(null);
              setCheckError(null);
              setHits([]);
            }}
          >
            {manualMode ? "Use search instead" : "Can't find it? Add manually"}
          </button>
        </div>
        <div className="flex gap-2">
          {keepOpenOption && (
            <Button disabled={busy || !canSave} onClick={() => save(true)}>
              Save & add another
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={busy || !canSave}>
            Save instrument
          </Button>
        </div>
      </div>
    </form>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] text-muted">
      {children}
    </span>
  );
}
