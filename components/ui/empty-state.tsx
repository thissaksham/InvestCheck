// One sentence of direction + one primary action (§3.7). Never illustration-only.

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <p className="text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}
