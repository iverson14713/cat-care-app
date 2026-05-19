import { MockScreenShell } from '../MockScreenShell';

const FOCUS_ITEMS = ['食慾與飲水狀況', '排便與排尿紀錄', '異常照片與備註'];

export function MockVetScreen() {
  return (
    <MockScreenShell activeTab="vet">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">獸醫報告</h1>

      <section className="mb-2 rounded-2xl bg-white px-3 py-2 shadow-sm">
        <p className="text-[10px] text-stone-500">日期範圍</p>
        <p className="text-[12px] font-semibold text-stone-800">近 30 天紀錄</p>
      </section>

      <section className="mb-2 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-3 shadow-sm">
        <p className="text-[10px] font-bold text-orange-700">AI 摘要</p>
        <p className="mt-2 text-[10px] leading-relaxed text-stone-700">
          本週食慾穩定，排便正常，未發現明顯異常。
        </p>
      </section>

      <section className="rounded-2xl border border-stone-100 bg-white p-3 shadow-sm">
        <p className="text-[11px] font-bold text-stone-900">看診重點</p>
        <ul className="mt-2 space-y-1">
          {FOCUS_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2 rounded-lg bg-stone-50 px-2 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden />
              <span className="text-[10px] font-medium text-stone-700">{item}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="mt-3 w-full rounded-xl bg-orange-400 py-2 text-[11px] font-bold text-white">
          匯出 PDF
        </button>
      </section>
    </MockScreenShell>
  );
}
