// Instant skeleton while a section's server render streams in — mirrors the
// dashboard shape (dominant hero, two-column body) so there's no layout flash.
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-80 animate-pulse rounded-2xl border border-hairline bg-surface sm:h-72" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-(--radius-card) border border-hairline bg-surface lg:col-span-2" />
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-(--radius-card) border border-hairline bg-surface" />
          <div className="h-32 animate-pulse rounded-(--radius-card) border border-hairline bg-surface" />
        </div>
      </div>
    </div>
  );
}
