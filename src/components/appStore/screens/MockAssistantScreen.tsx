import { MockScreenShell } from '../MockScreenShell';

export function MockAssistantScreen() {
  return (
    <MockScreenShell activeTab="more">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">AI 照護助手</h1>

      <section className="mb-2 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-3 shadow-sm">
        <p className="text-[10px] leading-relaxed text-stone-700">
          協助整理照護紀錄，快速掌握本週狀況。
        </p>
      </section>

      <section className="mb-2 rounded-2xl bg-white p-2.5 shadow-sm">
        <p className="text-[10px] font-bold text-stone-500">AI 使用次數</p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="text-xl font-bold text-orange-600">2</span>
          <span className="text-[11px] text-stone-400">/ 30</span>
        </p>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-orange-100">
          <span className="block h-full w-[7%] rounded-full bg-orange-400" />
        </span>
      </section>

      <section className="rounded-2xl border border-orange-100 bg-white p-2.5">
        <p className="rounded-xl border border-dashed border-orange-200 bg-orange-50/50 px-2.5 py-2 text-[10px] text-stone-500">
          想問什麼照護問題？
        </p>
        <button type="button" className="mt-2 w-full rounded-xl bg-orange-400 py-2 text-[11px] font-bold text-white">
          詢問 AI
        </button>
      </section>
    </MockScreenShell>
  );
}
