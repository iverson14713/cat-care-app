import { MockScreenShell } from '../MockScreenShell';

const DAILY = [
  { title: '早餐', time: '08:00' },
  { title: '晚餐', time: '09:00' },
];

const SCHEDULED = [{ title: '驅蟲', date: '06/15', time: '10:00' }];

export function MockRemindersScreen() {
  return (
    <MockScreenShell activeTab="reminders">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">提醒</h1>

      <section className="mb-2 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-white p-2.5">
        <p className="text-[11px] font-bold text-stone-900">日常提醒</p>
        <ul className="mt-1.5 space-y-1">
          {DAILY.map((r) => (
            <li
              key={r.title}
              className="flex items-center justify-between rounded-xl border border-orange-100 bg-white px-2.5 py-2"
            >
              <span className="text-[11px] font-semibold text-stone-900">{r.title}</span>
              <span className="text-[11px] font-bold text-orange-600">{r.time}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-2.5">
        <p className="text-[11px] font-bold text-stone-900">定期照護</p>
        {SCHEDULED.map((r) => (
          <article
            key={r.title}
            className="mt-1.5 flex items-center justify-between rounded-xl border border-sky-100 bg-white px-2.5 py-2"
          >
            <span>
              <span className="block text-[11px] font-semibold text-stone-900">{r.title}</span>
              <span className="block text-[9px] text-stone-500">{r.date}</span>
            </span>
            <span className="text-[11px] font-bold text-sky-700">{r.time}</span>
          </article>
        ))}
      </section>
    </MockScreenShell>
  );
}
