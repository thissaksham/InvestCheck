// DataTable primitives (§3.4): 13px, 40px rows, small-caps header on --bg,
// hairline row dividers (zebra off), sticky header, mobile horizontal scroll
// with sticky first column.

import { cn } from "@/lib/utils";

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return <table className={cn("w-full border-collapse text-[13px]", className)}>{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="sticky top-0 z-10">{children}</thead>;
}

export function TH({
  children,
  numeric,
  first,
  className,
}: {
  children?: React.ReactNode;
  numeric?: boolean;
  first?: boolean;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "eyebrow whitespace-nowrap bg-bg px-3 py-2 text-left font-medium text-ink-2",
        numeric && "text-right",
        first && "sticky left-0 z-10",
        className
      )}
    >
      {children}
    </th>
  );
}

export function TR({
  children,
  className,
  onClick,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "h-10 border-b border-hairline last:border-b-0",
        onClick && "cursor-pointer transition-colors duration-150 hover:bg-accent-soft/40",
        className
      )}
      onClick={onClick}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  numeric,
  first,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  numeric?: boolean;
  first?: boolean;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "whitespace-nowrap px-3 py-1.5",
        numeric && "num text-right",
        first && "sticky left-0 bg-surface",
        className
      )}
    >
      {children}
    </td>
  );
}
