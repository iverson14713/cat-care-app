import { Sparkles } from 'lucide-react';
import { AppStoreCatSwitcher } from '../AppStoreCatSwitcher';
import { AppStoreScreenShell } from '../AppStoreScreenShell';
import { appStoreZh } from '../appStoreCopy';
import {
  DEMO_ABNORMAL_NOTE,
  DEMO_CAT,
  DEMO_DAILY_DONE_IDS,
  DEMO_DAILY_ITEMS,
  DEMO_DAILY_PERCENT,
  DEMO_DATE,
  labelForDailyItem,
} from '../demoData';

/** Mirrors App.tsx renderTodayPage() with static demo data. */
export function AppStoreTodayScreen() {
  const dailyDone = DEMO_DAILY_DONE_IDS.size;

  return (
    <AppStoreScreenShell activeTab="today">
      <AppStoreCatSwitcher />

      <section className="mb-4 overflow-hidden rounded-3xl border border-amber-100 bg-amber-50/60 shadow-sm">
        <div className="flex w-full items-center gap-3 p-4 text-left">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-stone-900">{appStoreZh.sharedCareTodayFeedTitle}</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              2 {appStoreZh.sharedCareTodayFeedCount} · {appStoreZh.sharedCareTodayFeedTap}
            </p>
          </div>
          <span className="shrink-0 text-stone-400" aria-hidden>
            ▼
          </span>
        </div>
      </section>

      <div className="mb-4 rounded-2xl border border-orange-100/90 bg-white px-3.5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-xl">
            {DEMO_CAT.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold leading-tight text-stone-900">{appStoreZh.appTitle}</h1>
            <p className="truncate text-xs text-stone-600">
              {DEMO_CAT.name} · {DEMO_DATE}
            </p>
            <p className="text-[10px] font-medium tracking-wide text-stone-400">{appStoreZh.appSubtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold tabular-nums text-orange-600">{DEMO_DAILY_PERCENT}%</p>
            <p className="text-[10px] text-stone-400">
              {dailyDone}/{DEMO_DAILY_ITEMS.length}
            </p>
          </div>
        </div>
        <div className="mt-2.5">
          <div className="mb-1 text-[11px] font-medium text-stone-500">{appStoreZh.todayProgress}</div>
          <div className="h-1.5 overflow-hidden rounded-full bg-orange-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500"
              style={{ width: `${DEMO_DAILY_PERCENT}%` }}
            />
          </div>
        </div>
      </div>

      <section className="mb-4">
        <div className="mb-2">
          <h2 className="text-base font-bold">{appStoreZh.dailyCare}</h2>
          <p className="text-[12px] text-stone-500">{appStoreZh.dailyCareDesc}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_DAILY_ITEMS.map((item) => {
            const done = DEMO_DAILY_DONE_IDS.has(item.id);
            return (
              <div
                key={item.id}
                className={`flex min-h-[64px] w-full items-center justify-between rounded-xl border p-2.5 text-left shadow-sm ${
                  done ? 'border-green-200 bg-green-50' : 'border-stone-100 bg-white'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-2xl">{item.emoji}</span>
                  <span className="text-sm font-bold leading-snug text-stone-700">
                    {labelForDailyItem(item.labelKey)}
                  </span>
                </div>
                <span className="ml-2 shrink-0 text-xl">{done ? '✅' : '⬜'}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-4 rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{appStoreZh.abnormalRecord}</h2>
            <p className="text-sm text-stone-500">{appStoreZh.abnormalDesc}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-2 text-[12px] font-bold text-violet-800 ring-1 ring-violet-100">
            <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="whitespace-nowrap">{appStoreZh.moreAssistant}</span>
          </span>
        </div>
        <div className="min-h-28 w-full resize-none rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-stone-700">
          {DEMO_ABNORMAL_NOTE}
        </div>
        <p className="mt-2 text-sm font-medium text-red-600">{appStoreZh.abnormalSaved}</p>
      </section>
    </AppStoreScreenShell>
  );
}
