// Indian financial year: starts 1 Apr. fyLabel('2026-07-17') === 'FY26-27'.

export function fyLabel(date: string | Date = new Date()): string {
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T00:00:00`) : date;
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const yy = (y: number) => String(y % 100).padStart(2, "0");
  return `FY${yy(startYear)}-${yy(startYear + 1)}`;
}

/** ISO date of the FY start containing `date` (for dashboard FY range). */
export function fyStart(date: Date = new Date()): string {
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-04-01`;
}
