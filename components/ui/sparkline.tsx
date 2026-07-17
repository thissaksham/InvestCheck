// 32px-tall accent area, no axes (§3.4). Plain SVG — no chart lib needed at this size.

export function Sparkline({ points, width = 96 }: { points: number[]; width?: number }) {
  if (points.length < 2) return <span className="text-[12px] text-muted">—</span>;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const xy = points.map((p, i) => [i * step, h - 3 - ((p - min) / span) * (h - 6)]);
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${h} L0,${h} Z`;
  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} aria-hidden className="block">
      <path d={area} fill="var(--accent)" opacity={0.08} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
    </svg>
  );
}
