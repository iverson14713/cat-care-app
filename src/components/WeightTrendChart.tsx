import { useMemo, useState } from 'react';

type Point = { date: string; weight: number };

type WeightTrendChartProps = {
  points: Point[];
  lang: 'zh' | 'en';
};

function formatAxisDate(date: string, lang: 'zh' | 'en'): string {
  const [, m, d] = date.split('-');
  if (!m || !d) return date;
  return lang === 'zh' ? `${Number(m)}/${Number(d)}` : `${Number(m)}/${Number(d)}`;
}

export function formatWeightChangeLabel(
  points: Point[],
  lang: 'zh' | 'en',
  stableThresholdKg = 0.1
): string {
  const sorted = [...points].filter((p) => p.date && Number.isFinite(p.weight)).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) {
    return lang === 'zh' ? '資料尚少' : 'Not enough data';
  }
  const delta = sorted[sorted.length - 1].weight - sorted[0].weight;
  const abs = Math.abs(delta);
  if (abs < stableThresholdKg) {
    return lang === 'zh' ? '整體穩定' : 'Mostly stable';
  }
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} kg`;
}

export function WeightTrendChart({ points, lang }: WeightTrendChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const sorted = useMemo(
    () => [...points].filter((p) => Number.isFinite(p.weight) && p.weight > 0).sort((a, b) => a.date.localeCompare(b.date)),
    [points]
  );

  if (sorted.length === 0) return null;

  const w = 320;
  const h = 168;
  const padL = 40;
  const padR = 14;
  const padT = 30;
  const padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const weights = sorted.map((p) => p.weight);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const padKg = rawMax === rawMin ? 0.25 : Math.max(0.15, (rawMax - rawMin) * 0.15);
  const min = rawMin - padKg;
  const max = rawMax + padKg;
  const range = max - min || 1;

  const coords = sorted.map((p, i) => {
    const x = padL + (sorted.length === 1 ? chartW / 2 : (i / (sorted.length - 1)) * chartW);
    const y = padT + chartH - ((p.weight - min) / range) * chartH;
    return { ...p, x, y, i };
  });

  const path =
    sorted.length >= 2
      ? coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      : '';

  const yTicks = [min, min + range / 2, max];
  const labelStep = sorted.length <= 5 ? 1 : Math.ceil(sorted.length / 5);

  if (sorted.length === 1) {
    const p = coords[0];
    return (
      <div className="rounded-2xl border border-stone-100 bg-gradient-to-b from-stone-50 to-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-stone-500">
              {formatAxisDate(p.date, lang)}
            </p>
            <p className="text-2xl font-bold tabular-nums text-orange-600">{p.weight} kg</p>
          </div>
          <p className="max-w-[9rem] text-right text-[11px] leading-snug text-stone-500">
            {lang === 'zh' ? '再記錄一筆即可顯示趨勢線' : 'Log one more entry to show a trend line'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-100 bg-gradient-to-b from-stone-50/90 to-white p-3 shadow-inner">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full touch-manipulation" role="img" aria-label={lang === 'zh' ? '體重趨勢圖' : 'Weight trend chart'}>
        {yTicks.map((tick, idx) => {
          const y = padT + chartH - ((tick - min) / range) * chartH;
          return (
            <g key={idx}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e7e5e4" strokeWidth="1" />
              <text x={padL - 6} y={y + 4} textAnchor="end" className="fill-stone-400 text-[9px]">
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}
        {path ? (
          <path d={path} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {coords.map((c) => (
          <g
            key={c.date}
            onMouseEnter={() => setActiveIdx(c.i)}
            onMouseLeave={() => setActiveIdx(null)}
            onTouchStart={() => setActiveIdx(c.i)}
          >
            <circle
              cx={c.x}
              cy={c.y}
              r={activeIdx === c.i ? 6 : 4.5}
              fill={activeIdx === c.i ? '#ea580c' : '#fff'}
              stroke="#f97316"
              strokeWidth="2"
            />
            <text
              x={c.x}
              y={c.y - 10}
              textAnchor="middle"
              className="fill-orange-700 text-[9px] font-semibold"
            >
              {c.weight}
            </text>
            {activeIdx === c.i ? (
              <g>
                <rect
                  x={c.x - 34}
                  y={c.y - 36}
                  width={68}
                  height={22}
                  rx={6}
                  fill="#1c1917"
                  opacity={0.88}
                />
                <text x={c.x} y={c.y - 22} textAnchor="middle" className="fill-white text-[9px] font-medium">
                  {formatAxisDate(c.date, lang)} · {c.weight} kg
                </text>
              </g>
            ) : null}
          </g>
        ))}
        {coords.map((c, idx) =>
          idx % labelStep === 0 || idx === coords.length - 1 ? (
            <text
              key={`x-${c.date}`}
              x={c.x}
              y={h - 10}
              textAnchor="middle"
              className="fill-stone-500 text-[9px] font-medium"
            >
              {formatAxisDate(c.date, lang)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}
