import Link from "next/link";
import { redirect } from "next/navigation";
import { AllocationBar } from "@/components/charts/allocation-bar";
import { HeroChart } from "@/components/charts/hero-chart";
import { OnboardingChecklist, StaleChip } from "@/components/dashboard/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiTile } from "@/components/ui/kpi-tile";
import { Money, Pct } from "@/components/ui/money";
import { SectionCard } from "@/components/ui/section-card";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/data-table";
import { getPortfolioCached } from "@/lib/data-cached";
import { formatDate } from "@/lib/format";
import { isPriceStale } from "@/lib/staleness";
import { getUser } from "@/lib/supabase/server";
import type { Bucket, FixedDeposit, Snapshot } from "@/lib/types";
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
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const portfolio = (await getPortfolioCached())!;

  const [snapshotsRes, fdsRes] = await Promise.all([
    supabase.from("snapshots").select("*").eq("user_id", user.id).order("date"),
    supabase.from("fixed_deposits").select("*").eq("user_id", user.id),
  ]);
  const snapshots = (snapshotsRes.data ?? []) as Snapshot[];
  const fds = (fdsRes.data ?? []) as FixedDeposit[];

  const today = todayIST();
  const payload = snapshotPayload(portfolio.positions, portfolio.epfEntries);
  const hasAnyData = portfolio.instruments.length > 0 || portfolio.epfEntries.length > 0;

  // day change vs previous snapshot (§4.2, §12)
  const prev = [...snapshots].reverse().find((s) => s.date < today) ?? null;
  const delta = prev
    ? {
        abs: payload.current_value - Number(prev.current_value),
        pct: Number(prev.current_value) > 0 ? (payload.current_value - Number(prev.current_value)) / Number(prev.current_value) : 0,
      }
    : null;

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

      {/* 1 · hero (the signature) */}
      <SectionCard>
        {hasAnyData ? (
          <HeroChart
            snapshots={snapshots.map((s) => ({ date: s.date, value: Number(s.current_value) }))}
            investedNow={payload.invested}
            currentValue={payload.current_value}
            delta={delta}
          />
        ) : (
          <EmptyState message="No holdings yet. Add your first instrument to start tracking." />
        )}
      </SectionCard>

      {/* 2 · KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Invested">
          <Money value={payload.invested} />
        </KpiTile>
        <KpiTile label="Unrealised P&L">
          {payload.invested > 0 ? <Money value={unrealised} signed /> : <span className="text-muted">—</span>}
        </KpiTile>
        <KpiTile label="Return">
          {payload.invested > 0 ? <Pct value={unrealised / payload.invested} /> : <span className="text-muted">—</span>}
        </KpiTile>
        <KpiTile label="XIRR">
          {rate != null ? (
            <Pct value={rate} />
          ) : (
            <span
              className="text-muted"
              title={dated.length === 0 ? "Needs dated transactions" : "Out of computable range"}
            >
              —
            </span>
          )}
        </KpiTile>
      </div>

      {/* 3 · allocation */}
      <SectionCard title="Allocation">
        <AllocationBar
          slices={BUCKETS.map((b: Bucket) => ({ bucket: b, value: payload.by_bucket[b]?.value ?? 0 }))}
        />
      </SectionCard>

      {/* 4 · holdings by type */}
      <SectionCard title="Holdings by type">
        {typeRows.length === 0 ? (
          <EmptyState message="Nothing here yet. Log an opening balance to see your holdings." />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR className="border-b border-hairline">
                  <TH first>Type</TH>
                  <TH numeric>Invested</TH>
                  <TH numeric>Current</TH>
                  <TH numeric>P&L</TH>
                  <TH numeric>Return</TH>
                </TR>
              </THead>
              <tbody>
                {typeRows.map((t) => {
                  const slice = payload.by_type[t];
                  const pl = slice.value - slice.invested;
                  return (
                    <TR key={t}>
                      <TD first>
                        <Link href={`/holdings#${t}`} className="font-medium text-ink hover:text-accent">
                          {TYPE_LABELS[t]}
                        </Link>
                      </TD>
                      <TD numeric><Money value={slice.invested} /></TD>
                      <TD numeric><Money value={slice.value} /></TD>
                      <TD numeric>{slice.invested > 0 ? <Money value={pl} signed /> : "—"}</TD>
                      <TD numeric>{slice.invested > 0 ? <Pct value={pl / slice.invested} /> : "—"}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>

      {/* 5 · deposits tile (FDs live in their own module, §4.2) */}
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
            message="No deposits yet. Add your first FD."
            action={
              <Link href="/deposits?add=1" className="text-[13px] font-medium text-accent hover:underline">
                Add deposit
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <div className="eyebrow">Principal</div>
              <div className="num mt-1 text-xl font-medium"><Money value={fdSum.principal} /></div>
            </div>
            <div>
              <div className="eyebrow">Next maturity</div>
              <div className="mt-1 text-sm">
                {fdSum.nextMaturity ? (
                  <>
                    <span className="num">{formatDate(fdSum.nextMaturity.maturity_date)}</span>
                    <span className="text-muted"> · {fdSum.nextMaturity.bank}</span>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
            </div>
            <div>
              <div className="eyebrow">Active FDs</div>
              <div className="num mt-1 text-xl font-medium">{fdSum.activeCount}</div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
