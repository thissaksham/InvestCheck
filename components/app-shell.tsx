"use client";

// Shell (§3.5): 220px sidebar on desktop, bottom tab bar + center FAB on mobile.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ClipboardCheck,
  Landmark,
  LayoutDashboard,
  LineChart,
  Moon,
  PiggyBank,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { QuickAddProvider, useQuickAdd, type QuickAddInstrument } from "@/components/quick-add/quick-add";
import { fyLabel } from "@/lib/fy";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/holdings", label: "Holdings", icon: LineChart },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/deposits", label: "Deposits", icon: Landmark },
  { href: "/retirement", label: "Retirement", icon: PiggyBank },
  { href: "/reconcile", label: "Reconcile", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = NAV.filter((n) => ["/", "/holdings", "/deposits", "/retirement"].includes(n.href));

export function AppShell({
  children,
  displayName,
  lastFetchedAt,
  quickAdd,
}: {
  children: React.ReactNode;
  displayName: string | null;
  lastFetchedAt: string | null;
  quickAdd: {
    instruments: QuickAddInstrument[];
    recentIds: string[];
    fxRate: number | null;
    hasAnyTxn: boolean;
  };
}) {
  return (
    <QuickAddProvider data={quickAdd}>
      <div className="min-h-dvh">
        <Sidebar />
        <div className="sm:pl-[220px]">
          <Topbar displayName={displayName} lastFetchedAt={lastFetchedAt} />
          <main className="mx-auto max-w-[1120px] px-4 pb-24 pt-4 sm:px-6 sm:pb-8">{children}</main>
        </div>
        <TabBar />
      </div>
    </QuickAddProvider>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[224px] flex-col border-r border-hairline bg-surface/60 sm:flex">
      <div className="flex items-center gap-2 px-5 py-6">
        <span className="h-4 w-4 rounded-[5px] bg-accent" />
        <span className="text-[17px] font-semibold tracking-tight text-ink-2">InvestCheck</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-(--radius-field) px-3 py-2 text-[13.5px] transition-colors duration-150",
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-accent-soft/40 hover:text-ink"
              )}
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />}
              <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4">
        <span className="num rounded-full border border-hairline px-2.5 py-1 text-[11px] text-muted">
          {fyLabel()}
        </span>
      </div>
    </aside>
  );
}

function Topbar({ displayName, lastFetchedAt }: { displayName: string | null; lastFetchedAt: string | null }) {
  const pathname = usePathname();
  const { open } = useQuickAdd();
  const title = NAV.find((n) => n.href === pathname)?.label ?? "InvestCheck";
  // the handler accepts both meta and ctrl — the label should match the OS
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-hairline bg-bg/80 px-4 backdrop-blur-xl sm:px-6">
      <h1 className="font-display text-[26px] font-medium text-ink-2 max-sm:text-xl">{title}</h1>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => open()}
          className="hidden items-center gap-2 rounded-(--radius-field) border border-hairline bg-surface px-3 py-1.5 text-[13px] text-muted hover:border-accent/50 sm:flex"
        >
          <Search size={14} />
          Log transaction
          <kbd className="num rounded border border-hairline px-1 text-[10px]">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
        <RefreshButton lastFetchedAt={lastFetchedAt} />
        <ThemeToggle className="max-sm:hidden" />
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent"
        >
          {(displayName ?? "I").slice(0, 1).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}

export function RefreshButton({ lastFetchedAt }: { lastFetchedAt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) toast(body.error ?? "Refreshed recently — try again in a few minutes.");
      else if (!res.ok) toast.error(body.error ?? "Refresh failed.");
      else {
        const failed: string[] = body.failed ?? [];
        toast(
          failed.length
            ? `Refreshed ${body.updated} prices · ${failed.length} stale (${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""})`
            : `Refreshed ${body.updated} prices`
        );
        router.refresh();
      }
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const ago = lastFetchedAt ? timeAgo(lastFetchedAt) : null;
  return (
    <button
      onClick={refresh}
      disabled={busy}
      aria-label="Refresh prices"
      title={ago ? `Prices updated ${ago}` : "Refresh prices"}
      className="flex items-center gap-1.5 rounded-(--radius-field) border border-hairline bg-surface px-2.5 py-1.5 text-[12px] text-muted hover:border-accent/50 disabled:opacity-50"
    >
      <RefreshCw size={14} className={busy ? "animate-spin" : undefined} />
      {ago && <span className="num max-md:hidden">{ago}</span>}
    </button>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      aria-label="Switch theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-(--radius-field) border border-hairline bg-surface text-muted hover:text-ink",
        className
      )}
    >
      <Sun size={15} className="dark:hidden" />
      <Moon size={15} className="hidden dark:block" />
    </button>
  );
}

function TabBar() {
  const pathname = usePathname();
  const { open } = useQuickAdd();
  const left = MOBILE_NAV.slice(0, 2);
  const right = MOBILE_NAV.slice(2);

  const item = ({ href, label, icon: Icon }: (typeof NAV)[number]) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
        pathname === href ? "text-accent" : "text-muted"
      )}
    >
      <Icon size={18} />
      {label}
    </Link>
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
      {left.map(item)}
      <div className="relative flex-1">
        <button
          aria-label="Log transaction"
          onClick={() => open()}
          className="absolute -top-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-bg shadow-lg"
        >
          <Plus size={22} />
        </button>
      </div>
      {right.map(item)}
    </nav>
  );
}
