import Link from "next/link";

type Bar = { label: string; value: number; secondary?: number; href?: string; tone?: "blue" | "red" | "amber" | "green" | "violet" };
const barTone = { blue: "bg-blue-500", red: "bg-red-500", amber: "bg-amber-400", green: "bg-emerald-500", violet: "bg-violet-500" };

/** Horizontal bars – enough fidelity for a wireframe; real charts will use ECharts. Bars with href drill down to a filtered list. */
export function HBarChart({ data, unit = "", locale = "vi-VN", labelWidth = "11rem" }: { data: Bar[]; unit?: string; locale?: string; labelWidth?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-1">
      {data.map((d) => {
        const row = (
          <>
            <span className="truncate text-slate-600" title={d.label}>
              {d.label}
            </span>
            <span className="h-3 rounded bg-slate-100">
              <span className={`block h-3 rounded ${barTone[d.tone ?? "blue"]}`} style={{ width: `${(d.value / max) * 100}%` }} />
            </span>
            <span className="text-right font-medium text-slate-700">
              {d.value.toLocaleString(locale)}
              {unit}
            </span>
          </>
        );
        const cls = "grid items-center gap-2 rounded px-1 py-0.5 text-xs";
        const style = { gridTemplateColumns: `minmax(0,${labelWidth}) 1fr 3.5rem` };
        return (
          <li key={d.label}>
            {d.href ? (
              <Link href={d.href} className={`${cls} hover:bg-blue-50`} style={style}>
                {row}
              </Link>
            ) : (
              <div className={cls} style={style}>
                {row}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Grouped vertical columns: primary vs secondary series. */
export function ColumnChart({ data, primaryLabel, secondaryLabel }: { data: Bar[]; primaryLabel: string; secondaryLabel: string }) {
  const max = Math.max(...data.flatMap((d) => [d.value, d.secondary ?? 0]), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-2">
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-36 w-full items-end justify-center gap-0.5">
              <span className="w-1/2 max-w-3 rounded-t bg-blue-500" style={{ height: `${(d.value / max) * 100}%` }} title={`${primaryLabel}: ${d.value}`} />
              <span className="w-1/2 max-w-3 rounded-t bg-emerald-400" style={{ height: `${((d.secondary ?? 0) / max) * 100}%` }} title={`${secondaryLabel}: ${d.secondary}`} />
            </div>
            <span className="text-[10px] text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-blue-500" /> {primaryLabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-400" /> {secondaryLabel}
        </span>
      </div>
    </div>
  );
}

export function Donut({ segments, centerLabel = "hồ sơ", locale = "vi-VN" }: { segments: { label: string; value: number; color: string; href?: string }[]; centerLabel?: string; locale?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const stops = total
    ? segments
        .map((s, i) => {
          const before = segments.slice(0, i).reduce((sum, x) => sum + x.value, 0);
          return `${s.color} ${(before / total) * 360}deg ${((before + s.value) / total) * 360}deg`;
        })
        .join(", ")
    : "#e2e8f0 0deg 360deg";
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-lg font-semibold text-slate-900">{total.toLocaleString(locale)}</span>
          <span className="text-[10px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {segments.map((s) => {
          const body = (
            <>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              <span className="text-slate-600">{s.label}</span>
              <span className="font-medium text-slate-800">{s.value.toLocaleString(locale)}</span>
            </>
          );
          return (
            <li key={s.label}>
              {s.href ? (
                <Link href={s.href} className="flex items-center gap-2 rounded px-1 hover:bg-blue-50">
                  {body}
                </Link>
              ) : (
                <span className="flex items-center gap-2 px-1">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
