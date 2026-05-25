import { AppStoreCatSwitcher } from '../AppStoreCatSwitcher';
import { AppStoreScreenShell } from '../AppStoreScreenShell';
import { appStoreZh } from '../appStoreCopy';

const RECORDS = [
  { date: '2026-05-15', weight: 4.6, note: '食慾正常' },
  { date: '2026-05-08', weight: 4.5, note: '' },
  { date: '2026-05-01', weight: 4.4, note: '' },
];

const CHART_POINTS = [4.2, 4.35, 4.4, 4.45, 4.5, 4.55, 4.6];

/** Mirrors App.tsx renderWeightPage() key sections. */
export function AppStoreWeightScreen() {
  return (
    <AppStoreScreenShell activeTab="weight">
      <AppStoreCatSwitcher compact />

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl" aria-hidden>
          ⚖️
        </div>
        <h1 className="mt-2 text-2xl font-bold">{appStoreZh.weightTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">{appStoreZh.weightDesc}</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-stone-400">{appStoreZh.latestWeight}</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">4.6 kg</p>
          <p className="mt-1 text-xs text-stone-400">2026-05-15</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-stone-400">{appStoreZh.weightChange}</p>
          <p className="mt-1 text-2xl font-bold text-blue-500">+0.10 kg</p>
          <p className="mt-1 text-xs text-stone-400">latest vs recent</p>
        </div>
      </div>

      <section className="mb-5 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-stone-900">{appStoreZh.weightChart}</h2>
        <div className="flex h-36 items-end justify-between gap-1.5 px-1">
          {CHART_POINTS.map((w, i) => {
            const min = 4.2;
            const max = 4.65;
            const pct = ((w - min) / (max - min)) * 100;
            return (
              <span
                key={String(i)}
                className="block flex-1 rounded-t-lg bg-gradient-to-t from-orange-500 to-orange-300"
                style={{ height: `${Math.max(12, pct)}%` }}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-stone-900">{appStoreZh.weightRecords}</h2>
        <ul className="space-y-2">
          {RECORDS.map((r) => (
            <li
              key={r.date}
              className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-bold text-stone-900">{r.date}</p>
                {r.note ? <p className="text-xs text-stone-500">{r.note}</p> : null}
              </div>
              <p className="text-lg font-bold text-orange-600">{r.weight} kg</p>
            </li>
          ))}
        </ul>
      </section>
    </AppStoreScreenShell>
  );
}
