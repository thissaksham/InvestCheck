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
    <div className={cn("rounded-(--radius-card) border border-hairline bg-surface p-4", className)}>
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="num text-xl font-medium">{children}</div>
        {delta}
      </div>
    </div>
  );
}
