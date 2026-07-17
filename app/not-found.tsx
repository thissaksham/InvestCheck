import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg p-4 text-center">
      <div className="num text-[40px] font-medium text-ink-2">404</div>
      <p className="text-sm text-muted">This page doesn&apos;t exist.</p>
      <Link href="/" className="text-sm font-medium text-accent hover:underline">
        Back to dashboard
      </Link>
    </main>
  );
}
