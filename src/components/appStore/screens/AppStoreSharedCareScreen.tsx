import { AppStoreScreenShell } from '../AppStoreScreenShell';
import { DEMO_CAT } from '../demoData';

const MEMBERS = [
  { name: '媽媽', role: '主人', emoji: '👩' },
  { name: '爸爸', role: '成員', emoji: '👨' },
];

const ACTIVITY = [
  { who: '媽媽', action: '更新了今日照護紀錄', time: '08:30' },
  { who: '爸爸', action: '新增體重 4.6 kg', time: '昨天' },
];

/** Mirrors App.tsx shared care page layout. */
export function AppStoreSharedCareScreen() {
  return (
    <AppStoreScreenShell activeTab="more">
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-stone-900">共同照護</h1>
        <p className="mt-1 text-sm text-stone-500">與家人／室友共享同一隻寵物的紀錄，資料同步於雲端。</p>
      </section>

      <section className="mb-4 rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-sm">
        <header className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
            {DEMO_CAT.emoji}
          </span>
          <span>
            <p className="text-base font-bold text-stone-900">{DEMO_CAT.name}</p>
            <p className="text-sm text-stone-500">雲端同步 · {MEMBERS.length} 位成員</p>
          </span>
        </header>
      </section>

      <section className="mb-4 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-stone-900">共享成員</h2>
        <ul className="mt-3 space-y-2">
          {MEMBERS.map((m) => (
            <li key={m.name} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                <span aria-hidden>{m.emoji}</span>
                {m.name}
              </span>
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-stone-900">最近動態</h2>
        <ul className="mt-3 space-y-2">
          {ACTIVITY.map((a) => (
            <li key={a.action} className="rounded-xl border border-sky-100 bg-white px-3 py-2.5">
              <p className="text-sm font-semibold text-stone-900">
                {a.who} — {a.action}
              </p>
              <p className="text-[11px] text-stone-500">{a.time}</p>
            </li>
          ))}
        </ul>
      </section>
    </AppStoreScreenShell>
  );
}
