import { Bell, Calendar, Clock, Scale, Settings, Stethoscope } from 'lucide-react';
import { APP_STORE_FONT_FAMILY } from './constants';

export type MockTabId = 'today' | 'weight' | 'vet' | 'history' | 'reminders' | 'more';

const ROWS: { id: MockTabId; label: string; Icon: typeof Calendar }[][] = [
  [
    { id: 'today', label: '今日', Icon: Calendar },
    { id: 'weight', label: '體重', Icon: Scale },
    { id: 'vet', label: '獸醫', Icon: Stethoscope },
  ],
  [
    { id: 'history', label: '歷史', Icon: Clock },
    { id: 'reminders', label: '提醒', Icon: Bell },
    { id: 'more', label: '設定', Icon: Settings },
  ],
];

export function MockMainGridNav({ active }: { active: MockTabId }) {
  return (
    <nav
      className="shrink-0 rounded-2xl border border-orange-100/90 bg-white p-1.5 shadow-sm"
      style={{ fontFamily: APP_STORE_FONT_FAMILY }}
    >
      <div className="flex flex-col gap-1.5">
        {ROWS.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`grid grid-cols-3 gap-1 ${rowIndex > 0 ? 'border-t border-orange-100/90 pt-1.5' : ''}`}
          >
            {row.map(({ id, label, Icon }) => {
              const on = active === id;
              return (
                <span
                  key={id}
                  className={`flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 ${
                    on
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 ring-1 ring-orange-300/60'
                      : 'border border-stone-200/90 bg-stone-50 text-stone-800'
                  }`}
                >
                  <Icon className={`h-[15px] w-[15px] ${on ? 'text-white' : 'text-orange-600'}`} strokeWidth={on ? 2.4 : 2} aria-hidden />
                  <span className={`text-[8px] leading-none ${on ? 'font-bold' : 'font-semibold'}`}>{label}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
