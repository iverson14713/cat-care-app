import { MockScreenShell } from '../MockScreenShell';

const SECTIONS = [
  { title: '本週摘要', body: '食慾穩定，活動力正常，排便規律。' },
  { title: '體重趨勢', body: '近 7 日體重維持 4.6–4.8 kg，變化平穩。' },
  { title: '下週建議', body: '維持固定餵食時間，持續觀察飲水量。' },
];

export function MockAssistantScreen() {
  return (
    <MockScreenShell activeTab="more">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">AI 照護助手</h1>

      <section className="mb-2 rounded-2xl bg-white p-2.5 shadow-sm">
        <p className="text-[10px] font-bold text-stone-500">AI 使用次數</p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="text-xl font-bold text-violet-600">2</span>
          <span className="text-[11px] text-stone-400">/ 30 次 · 今日</span>
        </p>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-violet-100">
          <span className="block h-full w-[7%] rounded-full bg-violet-500" />
        </span>
      </section>

      <section className="mb-2 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-2.5 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-sm" aria-hidden>
            📊
          </span>
          <p className="text-[12px] font-bold text-stone-900">AI 週報</p>
        </div>
        <button type="button" className="w-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 py-2 text-[11px] font-bold text-white">
          生成本週週報
        </button>
      </section>

      <section className="space-y-1.5">
        {SECTIONS.map((s) => (
          <article key={s.title} className="rounded-xl border border-violet-100 bg-white px-2.5 py-2">
            <p className="text-[10px] font-bold text-violet-700">{s.title}</p>
            <p className="mt-1 text-[10px] leading-snug text-stone-700">{s.body}</p>
          </article>
        ))}
      </section>
    </MockScreenShell>
  );
}
