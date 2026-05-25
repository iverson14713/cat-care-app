import { Bell, Calendar, Clock, Scale, Settings, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { appStoreZh } from './appStoreCopy';

export type AppStoreTabId = 'today' | 'weight' | 'vet' | 'history' | 'reminders' | 'more';

const MAIN_TAB_ROWS: {
  id: AppStoreTabId;
  labelKey: keyof typeof appStoreZh;
  Icon: LucideIcon;
}[][] = [
  [
    { id: 'today', labelKey: 'today', Icon: Calendar },
    { id: 'weight', labelKey: 'weight', Icon: Scale },
    { id: 'vet', labelKey: 'vet', Icon: Stethoscope },
  ],
  [
    { id: 'history', labelKey: 'history', Icon: Clock },
    { id: 'reminders', labelKey: 'remindersNav', Icon: Bell },
    { id: 'more', labelKey: 'more', Icon: Settings },
  ],
];

type AppStoreMainNavProps = {
  active: AppStoreTabId;
};

/** Matches App.tsx main tab grid (not bottom tabs). */
export function AppStoreMainNav({ active }: AppStoreMainNavProps) {
  return (
    <nav
      className="mb-3 select-none rounded-3xl border border-orange-100/90 bg-white p-2.5 shadow-[0_14px_44px_-16px_rgba(234,88,12,0.45)]"
      aria-label="主要功能"
    >
      <div className="flex flex-col gap-2.5">
        {MAIN_TAB_ROWS.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`grid grid-cols-3 gap-2 ${rowIndex > 0 ? 'border-t border-orange-100/90 pt-2.5' : ''}`}
          >
            {row.map((tab) => {
              const on = tab.id === active;
              const TabIcon = tab.Icon;
              const label = appStoreZh[tab.labelKey];
              return (
                <span
                  key={tab.id}
                  className={`relative flex min-h-[5rem] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 pb-3 pt-2.5 ${
                    on
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40 ring-2 ring-orange-300/70'
                      : 'border border-stone-200/90 bg-stone-50 text-stone-800 shadow-sm'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      on ? 'bg-white/20 text-white' : 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-100/80'
                    }`}
                    aria-hidden
                  >
                    <TabIcon className="h-6 w-6" strokeWidth={on ? 2.5 : 2.15} />
                  </span>
                  <span
                    className={`max-w-full px-0.5 text-center text-[15px] leading-tight tracking-wide ${
                      on ? 'font-extrabold text-white' : 'font-bold text-stone-800'
                    }`}
                  >
                    {label}
                  </span>
                  <span
                    className={`absolute inset-x-4 bottom-1.5 h-1 rounded-full ${
                      on ? 'bg-white/95 shadow-sm' : 'h-0 opacity-0'
                    }`}
                    aria-hidden
                  />
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
