import { AppStoreScreenShell } from '../AppStoreScreenShell';
import { appStoreZh } from '../appStoreCopy';
import { DEMO_CAT } from '../demoData';

const TODAY_REMINDERS = [
  { title: '早上餵食', time: '08:00' },
  { title: '晚上餵食', time: '19:00' },
  { title: '清貓砂', time: '21:00' },
];

/** Mirrors App.tsx renderRemindersPage() today section. */
export function AppStoreRemindersScreen() {
  return (
    <AppStoreScreenShell activeTab="reminders">
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-3xl" aria-hidden>
          🔔
        </div>
        <h1 className="mt-2 text-xl font-bold text-stone-900">{appStoreZh.remindersTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">{appStoreZh.remindersLead}</p>
      </section>

      <section className="mb-4 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-stone-900">{appStoreZh.remindersTodaySection}</h2>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-100">
            已啟用 {TODAY_REMINDERS.length}
          </span>
        </div>
        <ul className="space-y-2">
          {TODAY_REMINDERS.map((r) => (
            <li
              key={r.title}
              className="flex items-center justify-between gap-2 rounded-xl border border-orange-100 bg-white px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900">{r.title}</p>
                <p className="text-[11px] text-stone-500">
                  {DEMO_CAT.emoji} {DEMO_CAT.name}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-orange-600">{r.time}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-stone-900">定期照護</h2>
        <article className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">驅蟲提醒</p>
            <p className="text-[11px] text-stone-500">2026-06-15 · 單次</p>
          </div>
          <span className="shrink-0 text-sm font-bold text-sky-700">10:00</span>
        </article>
      </section>
    </AppStoreScreenShell>
  );
}
