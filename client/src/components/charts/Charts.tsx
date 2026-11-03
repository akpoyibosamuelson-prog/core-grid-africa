import { cn } from "@/lib/utils";

export function BarChart({ data, height = 200, formatValue, className }: { data: { label: string; value: number }[]; height?: number; formatValue?: (v: number) => string; className?: string }) {
  if (data.length === 0) return <div className="py-10 text-center text-sm text-muted-foreground">No data for this period</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {formatValue ? formatValue(d.value) : d.value}
            </span>
            <div className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(2, (d.value / max) * (height - 24))}px` }} title={`${d.label}: ${formatValue ? formatValue(d.value) : d.value}`} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center text-[10px] text-muted-foreground">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data, height = 200, formatValue, className }: { data: { label: string; value: number }[]; height?: number; formatValue?: (v: number) => string; className?: string }) {
  if (data.length === 0) return <div className="py-10 text-center text-sm text-muted-foreground">No data for this period</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100;
  const pts = data.map((d, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
    const y = 100 - (d.value / max) * 90;
    return `${x},${y}`;
  });
  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" style={{ height }} className="w-full">
        <polyline points={pts.join(" ")} fill="none" stroke="hsl(224 76% 48%)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <polygon points={`0,100 ${pts.join(" ")} ${w},100`} fill="hsl(224 76% 48% / 0.12)" />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.label}</span>
        {formatValue && <span className="font-medium">{formatValue(max)} peak</span>}
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 160, formatValue }: { data: { label: string; value: number }[]; size?: number; formatValue?: (v: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="py-10 text-center text-sm text-muted-foreground">No data for this period</div>;
  const colors = ["hsl(224 76% 48%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)", "hsl(280 65% 60%)", "hsl(0 72% 51%)", "hsl(200 70% 50%)"];
  let acc = 0;
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="shrink-0 -rotate-90">
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * c;
          const el = (
            <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={colors[i % colors.length]} strokeWidth="14" strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc} />
          );
          acc += dash;
          return el;
        })}
      </svg>
      <div className="w-full space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 truncate">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
              <span className="truncate text-muted-foreground">{d.label}</span>
            </span>
            <span className="shrink-0 font-medium text-navy">{formatValue ? formatValue(d.value) : d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
