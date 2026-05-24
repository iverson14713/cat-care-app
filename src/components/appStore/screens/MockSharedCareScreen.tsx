import { MockScreenShell } from '../MockScreenShell';

const MEMBERS = [
  { name: '媽媽', role: '主人', emoji: '👩' },
  { name: '爸爸', role: '成員', emoji: '👨' },
];

const ACTIVITY = [
  { who: '媽媽', action: '完成今日照護', time: '08:30' },
  { who: '爸爸', action: '新增體重 4.8 kg', time: '昨天' },
];

export function MockSharedCareScreen() {
  return (
    <MockScreenShell activeTab="more">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">共同照護</h1>

      <section className="mb-2 rounded-2xl border border-orange-100 bg-white px-3 py-2.5 shadow-sm">
        <header className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-base">🐱</span>
          <span>
            <p className="text-[12px] font-bold text-stone-900">毛毛</p>
            <p className="text-[10px] text-stone-500">雲端同步 · 2 位成員</p>
          </span>
        </header>
      </section>

      <section className="mb-2 rounded-2xl border border-stone-100 bg-white p-2.5 shadow-sm">
        <p className="text-[11px] font-bold text-stone-900">共享成員</p>
        <ul className="mt-1.5 space-y-1">
          {MEMBERS.map((m) => (
            <li key={m.name} className="flex items-center justify-between rounded-xl bg-stone-50 px-2.5 py-2">
              <span className="flex items-center gap-2 text-[11px] font-semibold text-stone-800">
                <span aria-hidden>{m.emoji}</span>
                {m.name}
              </span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-bold text-orange-700">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-2.5">
        <p className="text-[11px] font-bold text-stone-900">最近動態</p>
        <ul className="mt-1.5 space-y-1">
          {ACTIVITY.map((a) => (
            <li key={a.action} className="rounded-xl border border-sky-100 bg-white px-2.5 py-2">
              <p className="text-[11px] font-semibold text-stone-900">
                {a.who} · {a.action}
              </p>
              <p className="text-[9px] text-stone-500">{a.time}</p>
            </li>
          ))}
        </ul>
      </section>
    </MockScreenShell>
  );
}
