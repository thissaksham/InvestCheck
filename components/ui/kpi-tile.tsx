import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  children,
  delta,
  className,
}: {
  label: string;
  children: React.ReactNode; // the mono value
  delta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-(--radius-card) border border-hairline bg-surface p-4 shadow-(--shadow-card) transition-colors hover:border-accent/30",
        className
      )}
    >
      <div className="eyebrow">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="num text-[22px] font-medium tracking-tight">{children}</div>
        {delta}
      </div>
    </div>
  );
}
