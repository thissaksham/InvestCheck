import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-(--radius-field) border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none",
          props.inputMode === "decimal" || props.inputMode === "numeric" ? "num" : undefined,
          className
        )}
        {...props}
      />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-(--radius-field) border border-hairline bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none",
          className
        )}
        {...props}
      />
    );
  }
);

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-[13px] font-medium text-muted">{label}</span>
      {children}
      {error && <span className="block text-[12px] text-loss">{error}</span>}
    </label>
  );
}
