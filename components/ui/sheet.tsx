"use client";

// Right-side sheet on desktop, bottom sheet on mobile (§3.4). Radix Dialog under the hood.

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

const SHEET_WIDTHS = {
  default: "sm:w-[420px]",
  wide: "sm:w-[560px]",
  // wide enough for a full data table without horizontal scrolling
  xl: "sm:w-[920px] sm:max-w-[94vw]",
} as const;

export function SheetContent({
  title,
  children,
  className,
  wide,
  size,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
  size?: keyof typeof SHEET_WIDTHS;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] animate-fade-in dark:bg-black/50" />
      <Dialog.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface shadow-none focus:outline-none",
          // mobile: bottom sheet
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:rounded-t-(--radius-card) max-sm:border-t max-sm:border-hairline max-sm:animate-sheet-bottom",
          // desktop: right drawer
          "sm:inset-y-0 sm:right-0 sm:h-full sm:border-l sm:border-hairline sm:animate-sheet-right",
          SHEET_WIDTHS[size ?? (wide ? "wide" : "default")],
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <Dialog.Title className="text-lg font-semibold text-ink-2">{title}</Dialog.Title>
          <Dialog.Close
            aria-label="Close"
            className="rounded-(--radius-field) p-1.5 text-muted hover:bg-accent-soft/60 hover:text-ink"
          >
            <X size={16} />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

/** Small centered dialog for confirms. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] animate-fade-in dark:bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-(--radius-card) border border-hairline bg-surface p-4 animate-pop focus:outline-none">
          <Dialog.Title className="text-[15px] font-semibold text-ink-2">{title}</Dialog.Title>
          <div className="mt-3">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
