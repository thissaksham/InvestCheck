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
  // per-instrument price movement since the previous snapshot → "today's movers"
  const movers: { name: string; pct: number }[] = [];
  if (prev) {
    let moved = 0;
    let basis = 0;
    for (const p of portfolio.positions) {
      if (p.price == null || p.units === 0) continue;
      const history = portfolio.priceHistory.get(p.instrument.id) ?? [];
      const then = [...history].reverse().find((h) => h.date <= prev.date)?.price;
      if (then == null) continue;
      const fx = p.instrument.currency === "USD" ? (portfolio.fx?.rate ?? 1) : 1;
      const m = p.units * (p.price - then) * fx;
      const b = p.units * then * fx;
      moved += m;
      basis += b;
      if (b > 0 && Math.abs(p.price - then) > 1e-9) movers.push({ name: p.instrument.name, pct: m / b });
    }
    if (basis > 0) delta = { abs: moved, pct: moved / basis };
  }
  const topMovers = movers.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 4);

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
  // booked gains from sells (avg-cost) — otherwise a fully-exited position's
  // profit vanishes from the headline (invested 0, unrealised 0)
  const realized = portfolio.positions.reduce((s, p) => s + p.realized, 0);
  const staleCount = portfolio.positions.filter(
    (p) => p.priceDate && p.priceSource && isPriceStale(p.priceDate, p.priceSource, today)
  ).length;

  const fdSum = fdSummary(fds, today);

  // Top holdings = biggest individual positions (concentration — a different
  // question from allocation-by-class). EPF is folded in as one line so a large
  // retirement balance isn't invisible here.
  const holdings: { key: string; name: string; value: number; ret: number | null; href: string }[] = [
    ...portfolio.positions
      .filter((p) => p.value > 0)
      .map((p) => ({
        key: p.instrument.id,
        name: p.instrument.name,
        value: p.value,
        ret: p.invested > 0 ? p.unrealised / p.invested : null,
        href: `/holdings#${p.instrument.type}`,
      })),
    ...(portfolio.epf.combined.balance > 0
      ? [{ key: "epf", name: "EPF (combined)", value: portfolio.epf.combined.balance, ret: null, href: "/retirement" }]
      : []),
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const holdingsTotal = payload.current_value || 1;

  return (
    <div className="space-y-6">
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

      {/* ═══ HERO — full-bleed: the net-worth figure and the chart ARE the page ═══ */}
      <section>
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
                  ...(Math.round(realized) !== 0
                    ? [{ label: "Realised P&L", value: <Money value={realized} signed /> }]
                    : []),
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
          <div className="rounded-(--radius-card) border border-hairline bg-surface p-8">
            <EmptyState message="No holdings yet. Add your first instrument to start tracking." />
          </div>
        )}
      </section>

      {hasAnyData && (
        <>
          {/* ═══ Asset mix (how risk is spread) vs Top holdings (what you own) ═══ */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Asset mix">
              <p className="-mt-2 mb-4 text-[12px] text-muted">How your money is spread across classes.</p>
              <AllocationBar
                slices={BUCKETS.map((b: Bucket) => ({ bucket: b, value: payload.by_bucket[b]?.value ?? 0 }))}
              />
            </SectionCard>

            <SectionCard
              title="Top holdings"
              action={
                <Link href="/holdings" className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
                  All holdings <ArrowUpRight size={13} />
                </Link>
              }
            >
              <p className="-mt-2 mb-2 text-[12px] text-muted">Your biggest single positions.</p>
              <ul>
                {holdings.map((h) => (
                  <li key={h.key}>
                    <Link
                      href={h.href}
                      className="group flex items-center gap-4 border-b border-hairline py-3 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] text-ink-2 group-hover:text-accent">{h.name}</div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-hairline">
                          <div
                            className="h-full rounded-full bg-accent/50"
                            style={{ width: `${Math.max((h.value / holdingsTotal) * 100, 2)}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="num text-[14px] font-medium text-ink-2">
                          <Money value={h.value} compact />
                        </div>
                        <div className="num mt-0.5 text-[12px]">
                          {h.ret != null ? <Pct value={h.ret} /> : <span className="text-muted">—</span>}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          {/* ═══ Today's movers + Fixed deposits ═══ */}
          <div className={`grid gap-4 ${topMovers.length ? "lg:grid-cols-2" : ""}`}>
            {topMovers.length > 0 && (
              <SectionCard title="Today's movers">
                <ul className="space-y-3">
                  {topMovers.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate text-ink">{m.name}</span>
                      <Pct value={m.pct} className="num shrink-0" />
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

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
                <div className="flex flex-wrap gap-x-10 gap-y-3">
                  <div>
                    <div className="eyebrow">Principal</div>
                    <div className="num mt-1 text-lg font-medium text-ink-2"><Money value={fdSum.principal} /></div>
                  </div>
                  <div>
                    <div className="eyebrow">Active FDs</div>
                    <div className="num mt-1 text-lg font-medium text-ink-2">{fdSum.activeCount}</div>
                  </div>
                  <div>
                    <div className="eyebrow">Next maturity</div>
                    <div className="mt-1 text-[13px]">
                      {fdSum.nextMaturity ? (
                        <>
                          <span className="num text-ink-2">{formatDate(fdSum.nextMaturity.maturity_date)}</span>
                          <span className="text-muted"> · {fdSum.nextMaturity.bank}</span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
