import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  active: "bg-accent-soft text-accent",
  matured: "bg-gain/10 text-gain",
  renewed: "bg-hairline/60 text-muted",
  closed: "bg-hairline/60 text-muted",
  stale: "bg-warn/10 text-warn",
  manual: "bg-warn/10 text-warn",
  buy: "bg-accent-soft text-accent",
  sell: "bg-loss/10 text-loss",
  opening: "bg-hairline/60 text-muted",
  fee: "bg-warn/10 text-warn",
  hidden: "bg-hairline/60 text-muted",
  "needs code": "bg-warn/10 text-warn",
};

export function StatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[status] ?? "bg-hairline/60 text-muted",
        className
      )}
    >
      {status}
    </span>
  );
}
