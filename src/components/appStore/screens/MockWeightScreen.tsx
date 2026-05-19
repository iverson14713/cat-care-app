import { MockScreenShell } from '../MockScreenShell';

const RECORDS = [
  { date: '05/15', weight: '4.6' },
  { date: '05/08', weight: '4.5' },
  { date: '05/01', weight: '4.4' },
];

const BARS = [42, 48, 45, 52, 58, 55, 62];

export function MockWeightScreen() {
  return (
    <MockScreenShell activeTab="weight">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">體重紀錄</h1>

      <section className="mb-2 rounded-2xl bg-white p-3 shadow-sm">
        <p className="text-[11px] text-stone-500">目前體重</p>
        <p className="mt-1 text-2xl font-bold text-orange-600">4.8 kg</p>
        <p className="text-[10px] text-stone-500">2026-05-19</p>
      </section>

      <section className="mb-2 rounded-2xl border border-orange-100 bg-white p-2.5 shadow-sm">
        <p className="mb-2 text-center text-[10px] font-bold text-stone-700">近 7 次體重變化</p>
        <span className="flex h-24 items-end justify-between gap-1 px-1">
          {BARS.map((h, i) => (
            <span
              key={String(i)}
              className="block flex-1 rounded-t-md bg-gradient-to-t from-orange-500 to-orange-300"
              style={{ height: `${h}%` }}
            />
          ))}
        </span>
      </section>

      <section className="space-y-1.5">
        {RECORDS.map((r) => (
          <article
            key={r.date}
            className="flex items-center justify-between rounded-xl border border-stone-100 bg-white px-3 py-2"
          >
            <span className="text-[10px] text-stone-500">{r.date}</span>
            <span className="text-[13px] font-bold text-orange-700">{r.weight} kg</span>
          </article>
        ))}
      </section>
    </MockScreenShell>
  );
}
