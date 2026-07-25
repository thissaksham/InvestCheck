import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  action,
  children,
  className,
  id,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-(--radius-card) border border-hairline bg-surface p-5 shadow-(--shadow-card)",
        className
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-[19px] font-medium text-ink-2">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
