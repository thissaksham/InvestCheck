import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AllocationBar } from "@/components/charts/allocation-bar";
import { HeroChart } from "@/components/charts/hero-chart";
import { OnboardingChecklist, StaleChip } from "@/components/dashboard/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty-state";
import { Money, Pct } from "@/components/ui/money";
import { SectionCard } from "@/components/ui/section-card";
import { StatRail } from "@/components/ui/stat-rail";
import { getPortfolioCached } from "@/lib/data-cached";
import { getSnapshotSeries } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { isPriceStale } from "@/lib/staleness";
import { getSessionUser } from "@/lib/supabase/server";
import type { Bucket, FixedDeposit } from "@/lib/types";
import { todayIST } from "@/lib/utils";
import { fdSummary, snapshotPayload, BUCKETS } from "@/lib/valuation";
import { xirr } from "@/lib/xirr";

const TYPE_LABELS: Record<string, string> = {
  stock: "Stocks",
  etf: "ETFs",
  mutual_fund: "Mutual Funds",
  nps: "NPS",
  epf: "EPF",
};

export default async function DashboardPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/login");

  const portfolioPromise = getPortfolioCached();
  const [snapshots, fdsRes] = await Promise.all([
    getSnapshotSeries(supabase, user.id),
    supabase.from("fixed_deposits").select("*").eq("user_id", user.id),
  ]);
  const portfolio = (await portfolioPromise)!;
  const fds = (fdsRes.data ?? []) as FixedDeposit[];

  const today = todayIST();
  const payload = snapshotPayload(portfolio.positions, portfolio.epfEntries);
  const hasAnyData = portfolio.instruments.length > 0 || portfolio.epfEntries.length > 0;

  // Day change vs the previous snapshot (§4.2, §12) — but only the part caused
  // by prices moving. Anything *recorded* since that snapshot (a fresh SIP, an
  // imported statement) is new money, not growth, so it's netted out. Without
  // this, importing history reads as a giant one-day gain.
  // Day change = what prices did, not what I typed. Comparing snapshot totals
  // makes any data entered (or removed) since look like a gain/loss — importing
  // statements once read as +175%. So value today's holdings at today's price
  // vs their price on the previous snapshot date, units held constant.
  // Instruments with no earlier price (just added) contribute nothing, and EPF
  // has no price at all — correctly, it doesn't move daily.
  const prev = [...snapshots].reverse().find((s) => s.date < today) ?? null;
  let delta: { abs: number; pct: number } | null = null;
  if (prev) {
    let moved = 0;
    let basis = 0;
    for (const p of portfolio.positions) {
      if (p.price == null || p.units === 0) continue;
      const history = portfolio.priceHistory.get(p.instrument.id) ?? [];
      const then = [...history].reverse().find((h) => h.date <= prev.date)?.price;
      if (then == null) continue;
      const fx = p.instrument.currency === "USD" ? (portfolio.fx?.rate ?? 1) : 1;
      moved += p.units * (p.price - then) * fx;
      basis += p.units * then * fx;
    }
    if (basis > 0) delta = { abs: moved, pct: moved / basis };
  }

  // XIRR — opening rows excluded (§12)
  const dated = portfolio.transactions.filter((t) => t.type !== "opening");
  const rate =
    dated.length > 0
      ? xirr([
          ...dated.map((t) => ({ amount: t.type === "sell" ? Number(t.amount) : -Number(t.amount), date: t.date })),
          { amount: payload.current_value, date: today },
        ])
      : null;

  const unrealised = payload.current_value - payload.invested;
  const staleCount = portfolio.positions.filter(
    (p) => p.priceDate && p.priceSource && isPriceStale(p.priceDate, p.priceSource, today)
  ).length;

  const fdSum = fdSummary(fds, today);
  const typeRows = ["stock", "etf", "mutual_fund", "nps", "epf"].filter(
    (t) => payload.by_type[t] && (payload.by_type[t].invested !== 0 || payload.by_type[t].value !== 0)
  );
  const typeTotal = typeRows.reduce((s, t) => s + payload.by_type[t].value, 0);

  return (
    <div className="space-y-4">
      <OnboardingChecklist
        hasInstruments={portfolio.instruments.length > 0}
        hasTxns={portfolio.transactions.length > 0}
        hasFds={fds.length > 0}
        hasEpf={portfolio.epfEntries.length > 0}
      />

      {staleCount > 0 && (
        <div>
          <StaleChip count={staleCount} />
        </div>
      )}

      {/* ═══ HERO — the one dominant surface: value + chart + integrated stat rail ═══ */}
      <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface p-5 shadow-(--shadow-card) sm:p-7">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        {hasAnyData ? (
          <>
            <HeroChart
              snapshots={snapshots.map((s) => ({
                date: s.date,
                value: Number(s.current_value),
                invested: Number(s.invested),
              }))}
              currentValue={payload.current_value}
              delta={delta}
            />
            <div className="mt-6 border-t border-hairline pt-5">
              <StatRail
                items={[
                  { label: "Invested", value: <Money value={payload.invested} /> },
                  {
                    label: "Unrealised P&L",
                    value: payload.invested > 0 ? <Money value={unrealised} signed /> : <span className="text-muted">—</span>,
                  },
                  {
                    label: "Return",
                    value: payload.invested > 0 ? <Pct value={unrealised / payload.invested} /> : <span className="text-muted">—</span>,
                  },
                  {
                    label: "XIRR",
                    value:
                      rate != null ? (
                        <Pct value={rate} />
                      ) : (
                        <span className="text-muted" title={dated.length === 0 ? "Needs dated transactions" : "Out of computable range"}>
                          —
                        </span>
                      ),
                  },
                ]}
              />
            </div>
          </>
        ) : (
          <EmptyState message="No holdings yet. Add your first instrument to start tracking." />
        )}
      </section>

      {/* ═══ BODY — two columns on desktop: holdings ledger + a rail ═══ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* holdings by type — editorial ledger list, not a table */}
        <SectionCard
          title="Holdings"
          className="lg:col-span-2"
          action={
            <Link href="/holdings" className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
              All holdings <ArrowUpRight size={13} />
            </Link>
          }
        >
          {typeRows.length === 0 ? (
            <EmptyState message="Nothing here yet. Log an opening balance to see your holdings." />
          ) : (
            <ul>
              {typeRows.map((t) => {
                const slice = payload.by_type[t];
                const pl = slice.value - slice.invested;
                const weight = typeTotal > 0 ? slice.value / typeTotal : 0;
                return (
                  <li key={t}>
                    <Link
                      href={`/holdings#${t}`}
                      className="group flex items-center gap-4 border-b border-hairline py-3.5 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[15px] text-ink-2 group-hover:text-accent">
                          {TYPE_LABELS[t]}
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-hairline">
                          <div className="h-full rounded-full bg-accent/55" style={{ width: `${Math.max(weight * 100, 2)}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="num text-[15px] font-medium text-ink-2">
                          <Money value={slice.value} />
                        </div>
                        <div className="mt-0.5 text-[12px] text-muted">
                          {slice.invested > 0 ? (
                            <>
                              <Pct value={pl / slice.invested} />
                              <span className="mx-1">·</span>
                            </>
                          ) : null}
                          invested <Money value={slice.invested} compact className="text-muted" />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* right rail: allocation + deposits */}
        <div className="space-y-4">
          <SectionCard title="Allocation">
            <AllocationBar
              slices={BUCKETS.map((b: Bucket) => ({ bucket: b, value: payload.by_bucket[b]?.value ?? 0 }))}
            />
          </SectionCard>

          <SectionCard
            title="Fixed deposits"
            action={
              <Link href="/deposits" className="text-[13px] text-accent hover:underline">
                View all
              </Link>
            }
          >
            {fdSum.activeCount === 0 ? (
              <EmptyState
                message="No deposits yet."
                action={
                  <Link href="/deposits?add=1" className="text-[13px] font-medium text-accent hover:underline">
                    Add deposit
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow">Principal</span>
                  <span className="num text-lg font-medium text-ink-2"><Money value={fdSum.principal} /></span>
                </div>
                <div className="flex items-baseline justify-between border-t border-hairline pt-3">
                  <span className="eyebrow">Active FDs</span>
                  <span className="num text-ink-2">{fdSum.activeCount}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-t border-hairline pt-3">
                  <span className="eyebrow">Next maturity</span>
                  <span className="text-right text-[13px]">
                    {fdSum.nextMaturity ? (
                      <>
                        <span className="num text-ink-2">{formatDate(fdSum.nextMaturity.maturity_date)}</span>
                        <span className="block text-[11px] text-muted">{fdSum.nextMaturity.bank}</span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
