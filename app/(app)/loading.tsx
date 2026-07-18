// Instant skeleton while a section's server render streams in.
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-64 animate-pulse rounded-(--radius-card) border border-hairline bg-surface" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-(--radius-card) border border-hairline bg-surface" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-(--radius-card) border border-hairline bg-surface" />
    </div>
  );
}
