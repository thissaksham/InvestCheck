"use client";

// Paste a casparser JSON dump → diff it against the ledger. Entirely read-only:
// the CAS is never stored and nothing in the portfolio is modified.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/data-table";
import { Money } from "@/components/ui/money";
import { SectionCard } from "@/components/ui/section-card";
import { StatRail } from "@/components/ui/stat-rail";
import { formatDate } from "@/lib/format";
import {
  holdingsAsOf,
  parseCas,
  reconcile,
  type CasParsed,
  type LedgerTxn,
  type ReconRow,
  type ReconStatus,
} from "@/lib/cas";
import { cn } from "@/lib/utils";

const LABEL: Record<ReconStatus, string> = {
  units_differ: "Units differ",
  only_cas: "Not in InvestCheck",
  only_app: "Not in CAS",
  match: "Matches",
};

const TONE: Record<ReconStatus, string> = {
  units_differ: "text-warn",
  only_cas: "text-loss",
  only_app: "text-loss",
  match: "text-gain",
};

const fmtUnits = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: 3 });

export function ReconcileView({
  instruments,
  txns,
}: {
  instruments: { id: string; name: string }[];
  txns: LedgerTxn[];
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cas, setCas] = useState<CasParsed | null>(null);
  const [rows, setRows] = useState<ReconRow[] | null>(null);

  function compare() {
    setError(null);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      setCas(null);
      setRows(null);
      return setError("That isn't valid JSON — paste the whole casparser output, including the outer { }.");
    }
    const parsed = parseCas(parsedJson);
    if (parsed.holdings.length === 0) {
      setCas(null);
      setRows(null);
      return setError("No holdings found. Expected a casparser dump with demat_accounts / mutual_funds / nps.");
    }
    // rewind the ledger to the statement date so both sides describe the same day
    const asOf = parsed.asOf ?? new Date().toISOString().slice(0, 10);
    setCas(parsed);
    setRows(reconcile(parsed.holdings, holdingsAsOf(instruments, txns, asOf)));
  }

  function reset() {
    setRaw("");
    setCas(null);
    setRows(null);
    setError(null);
  }

  const count = (s: ReconStatus) => rows?.filter((r) => r.status === s).length ?? 0;

  return (
    <div className="space-y-4">
      <SectionCard title="Compare with your CAS">
        <p className="-mt-2 mb-3 text-[13px] text-muted">
          Paste the JSON from casparser. It&apos;s compared in your browser and never saved — nothing in your
          portfolio changes.
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
          placeholder='{ "demat_accounts": [ … ], "mutual_funds": [ … ] }'
          className="h-40 w-full resize-y rounded-(--radius-field) border border-hairline bg-bg p-3 font-mono text-[12px] text-ink placeholder:text-muted focus:outline-none"
        />
        {error && <p className="mt-2 text-[13px] text-loss">{error}</p>}
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={compare} disabled={!raw.trim()}>
            Compare
          </Button>
          {(rows || raw) && <Button onClick={reset}>Clear</Button>}
        </div>
      </SectionCard>

      {cas && rows && (
        <>
          <SectionCard>
            <StatRail
              items={[
                { label: "Matches", value: <span className="text-gain">{count("match")}</span> },
                { label: "Units differ", value: <span className={count("units_differ") ? "text-warn" : undefined}>{count("units_differ")}</span> },
                { label: "Not in InvestCheck", value: <span className={count("only_cas") ? "text-loss" : undefined}>{count("only_cas")}</span> },
                { label: "Not in CAS", value: <span className={count("only_app") ? "text-loss" : undefined}>{count("only_app")}</span> },
              ]}
            />
            <p className="mt-4 border-t border-hairline pt-3 text-[12px] text-muted">
              Both sides as of <span className="num text-ink">{cas.asOf ? formatDate(cas.asOf) : "today"}</span> — your
              ledger is replayed to the statement date, so trades made since then aren&apos;t counted as differences.
              {cas.investor && <> · {cas.investor}</>}
              {cas.totalValue != null && (
                <> · statement total <Money value={cas.totalValue} compact className="text-ink" /></>
              )}
            </p>
          </SectionCard>

          <TableWrap className="rounded-(--radius-card) border border-hairline bg-surface">
            <Table>
              <THead>
                <TR className="border-b border-hairline">
                  <TH first>Holding</TH>
                  <TH>Source</TH>
                  <TH numeric>CAS units</TH>
                  <TH numeric>Yours (then)</TH>
                  <TH numeric>Difference</TH>
                  <TH numeric>CAS value</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map((r) => {
                  const diff = r.casUnits != null && r.appUnits != null ? r.appUnits - r.casUnits : null;
                  return (
                    <TR key={`${r.key}-${r.status}`}>
                      <TD first className="max-w-[260px] truncate font-medium" title={r.casName ?? r.name}>
                        {r.name}
                      </TD>
                      <TD className="text-[12px] text-muted">{r.account ?? "—"}</TD>
                      <TD numeric className="num">{fmtUnits(r.casUnits)}</TD>
                      <TD numeric className="num">{fmtUnits(r.appUnits)}</TD>
                      <TD numeric className={cn("num", diff && Math.abs(diff) > 0.05 ? "text-warn" : "text-muted")}>
                        {diff == null ? "—" : `${diff > 0 ? "+" : ""}${fmtUnits(diff)}`}
                      </TD>
                      <TD numeric>{r.casValue != null ? <Money value={r.casValue} /> : "—"}</TD>
                      <TD className={cn("text-[12px]", TONE[r.status])}>{LABEL[r.status]}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}
    </div>
  );
}
