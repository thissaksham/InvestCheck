import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-accent text-white hover:opacity-90 border border-transparent",
  secondary: "bg-surface text-ink border border-hairline hover:border-accent/50",
  ghost: "text-muted hover:text-ink hover:bg-accent-soft/60 border border-transparent",
  destructive: "bg-loss text-white hover:opacity-90 border border-transparent",
  chip: "rounded-full border border-hairline bg-surface text-muted hover:text-ink text-[13px] data-[on=true]:bg-accent-soft data-[on=true]:text-accent data-[on=true]:border-accent/30",
};

const sizes = {
  sm: "h-7 px-2.5 text-[13px]",
  md: "h-9 px-3.5 text-sm",
  lg: "h-10 px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-(--radius-field) font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
        variant !== "chip" && sizes[size],
        variant === "chip" && "h-7 px-3",
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
