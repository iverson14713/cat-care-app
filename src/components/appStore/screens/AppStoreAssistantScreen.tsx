import { Sparkles } from 'lucide-react';
import { AppStoreCatSwitcher } from '../AppStoreCatSwitcher';
import { AppStoreScreenShell } from '../AppStoreScreenShell';
import { appStoreZh } from '../appStoreCopy';

/** Mirrors App.tsx renderAssistantPage() hero + quota + analysis blocks. */
export function AppStoreAssistantScreen() {
  return (
    <AppStoreScreenShell activeTab="more" showProBadge>
      <AppStoreCatSwitcher compact />

      <section className="mb-3 rounded-xl border border-orange-100/80 bg-white px-2.5 py-1.5 shadow-sm">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 text-base leading-none shadow-inner"
            aria-hidden
          >
            🐱
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-bold leading-tight text-stone-900">{appStoreZh.assistantTitle}</h1>
            <p className="mt-0.5 text-[11px] leading-snug text-stone-500">{appStoreZh.assistantLead}</p>
          </div>
        </div>
      </section>

      <section className="mb-3 rounded-2xl border border-orange-100 bg-white px-3.5 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-stone-900">今日 AI 次數</p>
          <p className="text-sm font-semibold text-orange-600">
            <span className="tabular-nums">2</span>
            <span className="text-stone-400"> / 30</span>
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-orange-100">
          <div className="h-full w-[7%] rounded-full bg-gradient-to-r from-orange-400 to-orange-500" />
        </div>
        <p className="mt-2 text-[12px] text-stone-500">今日還可使用 28 次 AI</p>
      </section>

      <section className="mb-4 rounded-2xl border border-stone-100 border-l-4 border-l-orange-300 bg-white px-4 py-3.5 shadow-sm">
        <h3 className="mb-1.5 text-sm font-semibold text-stone-900">{appStoreZh.assistantQuickSummary}</h3>
        <p className="text-[13px] leading-relaxed text-stone-700">
          今日已完成 6 項每日照護。飲食與排便紀錄正常，體重近一週緩升，可持續觀察。
        </p>
      </section>

      <section className="mb-4 rounded-2xl border border-stone-100 border-l-4 border-l-violet-300 bg-white px-4 py-3.5 shadow-sm">
        <h3 className="mb-1.5 text-sm font-semibold text-stone-900">{appStoreZh.assistantCareReminders}</h3>
        <ul className="list-inside list-disc space-y-1 text-[13px] leading-relaxed text-stone-700">
          <li>維持早晚餵食紀錄習慣</li>
          <li>下週可再量一次體重</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-bold text-stone-900">{appStoreZh.aiAnalysisCardTitle}</p>
        <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 px-3 py-3 text-sm text-stone-500">
          {appStoreZh.assistantAskPlaceholder}
        </div>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white"
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          {appStoreZh.assistantSend}
        </button>
      </section>
    </AppStoreScreenShell>
  );
}
