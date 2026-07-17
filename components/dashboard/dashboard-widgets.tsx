"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQuickAdd } from "@/components/quick-add/quick-add";
import { cn } from "@/lib/utils";

/** One --warn staleness chip (§4.2): "3 prices stale · refresh". */
export function StaleChip({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (count === 0) return null;

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) toast(body.error ?? "Refresh failed.");
      else {
        toast(`Refreshed ${body.updated} prices`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={refresh}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full bg-warn/10 px-3 py-1 text-[12px] font-medium text-warn hover:bg-warn/20 disabled:opacity-60"
    >
      {count} {count === 1 ? "price" : "prices"} stale · {busy ? "refreshing…" : "refresh"}
    </button>
  );
}

/** Onboarding checklist (§18) — replaces seeding; dismissible; auto-hides when complete. */
export function OnboardingChecklist({
  hasInstruments,
  hasTxns,
  hasFds,
  hasEpf,
}: {
  hasInstruments: boolean;
  hasTxns: boolean;
  hasFds: boolean;
  hasEpf: boolean;
}) {
  const { open } = useQuickAdd();
  const [dismissed, setDismissed] = useState(true); // avoid flash; read storage after mount
  useEffect(() => {
    setDismissed(localStorage.getItem("onboarding-dismissed") === "1");
  }, []);

  const steps: { label: string; done: boolean; action: React.ReactNode }[] = [
    {
      label: "Add your instruments",
      done: hasInstruments,
      action: <Link href="/holdings?add=1" className="text-accent hover:underline">Add instrument</Link>,
    },
    {
      label: "Log opening balances",
      done: hasTxns,
      action: (
        <button onClick={() => open({ mode: "opening" })} className="text-accent hover:underline">
          Log opening balance
        </button>
      ),
    },
    {
      label: "Add fixed deposits",
      done: hasFds,
      action: <Link href="/deposits?add=1" className="text-accent hover:underline">Add FD</Link>,
    },
    {
      label: "Add EPF opening balance",
      done: hasEpf,
      action: <Link href="/retirement?add=1" className="text-accent hover:underline">Add EPF entry</Link>,
    },
  ];

  if (dismissed || steps.every((s) => s.done)) return null;

  return (
    <section className="rounded-(--radius-card) border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-2">Set up your portfolio</h2>
        <button
          aria-label="Dismiss checklist"
          className="text-muted hover:text-ink"
          onClick={() => {
            localStorage.setItem("onboarding-dismissed", "1");
            setDismissed(true);
          }}
        >
          <X size={16} />
        </button>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[11px]",
                s.done ? "border-transparent bg-gain/15 text-gain" : "border-hairline text-muted"
              )}
            >
              {s.done ? <Check size={12} /> : i + 1}
            </span>
            <span className={cn(s.done && "text-muted line-through")}>{s.label}</span>
            {!s.done && <span className="ml-auto text-[13px]">{s.action}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
