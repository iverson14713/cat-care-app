import { MockScreenShell } from '../MockScreenShell';

const TASKS = [
  { label: '早餐', done: true },
  { label: '飲水', done: true },
  { label: '清貓砂', done: true },
  { label: '晚餐', done: false },
];

export function MockTodayScreen() {
  return (
    <MockScreenShell activeTab="today">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">今日照護</h1>

      <section className="mb-2.5 rounded-2xl border border-orange-100 bg-white px-3 py-2.5 shadow-sm">
        <header className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-lg font-bold text-orange-600">
            毛
          </span>
          <span className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-stone-900">毛毛 Pet Care</p>
            <p className="text-[10px] text-stone-500">2026-05-19</p>
          </span>
          <span className="text-right">
            <p className="text-base font-bold text-orange-600">75%</p>
          </span>
        </header>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-orange-100">
          <span className="block h-full w-3/4 rounded-full bg-gradient-to-r from-orange-400 to-orange-500" />
        </span>
      </section>

      <h2 className="mb-1.5 text-[12px] font-bold text-stone-900">今日任務</h2>
      <section className="grid grid-cols-2 gap-1.5">
        {TASKS.map((item) => (
          <article
            key={item.label}
            className={`flex min-h-[48px] items-center justify-between rounded-xl border px-2.5 py-2 ${
              item.done ? 'border-green-200 bg-green-50' : 'border-stone-100 bg-white'
            }`}
          >
            <span className="text-[11px] font-bold text-stone-700">{item.label}</span>
            <span
              className={`h-4 w-4 rounded-full border-2 ${
                item.done ? 'border-green-500 bg-green-500' : 'border-stone-300 bg-white'
              }`}
              aria-hidden
            />
          </article>
        ))}
      </section>

      <section className="mt-2.5 rounded-2xl border border-red-100 bg-white p-2.5 shadow-sm">
        <h3 className="text-[11px] font-bold text-stone-900">異常紀錄</h3>
        <p className="mt-1 rounded-xl border border-red-100 bg-red-50 p-2 text-[10px] leading-snug text-stone-700">
          今天精神良好，食慾正常
        </p>
      </section>
    </MockScreenShell>
  );
}
