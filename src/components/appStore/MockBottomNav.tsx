import { Bell, Calendar, LayoutGrid, Scale, Stethoscope } from 'lucide-react';
import { APP_STORE_FONT_FAMILY } from './constants';

export type MockTabId = 'today' | 'weight' | 'vet' | 'history' | 'reminders' | 'more';

const TABS: { id: MockTabId; label: string; Icon: typeof Calendar }[] = [
  { id: 'today', label: '今日', Icon: Calendar },
  { id: 'weight', label: '體重', Icon: Scale },
  { id: 'vet', label: '獸醫', Icon: Stethoscope },
  { id: 'history', label: '歷史', Icon: Calendar },
  { id: 'reminders', label: '提醒', Icon: Bell },
  { id: 'more', label: '更多', Icon: LayoutGrid },
];

export function MockBottomNav({ active }: { active: MockTabId }) {
  return (
    <nav
      className="flex shrink-0 border-t border-stone-100 bg-white/95 backdrop-blur-sm"
      style={{ fontFamily: APP_STORE_FONT_FAMILY }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const on = active === id;
        return (
          <span
            key={id}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${on ? 'text-orange-500' : 'text-stone-400'}`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={on ? 2.4 : 2} aria-hidden />
            <span className={`text-[9px] leading-none ${on ? 'font-bold' : 'font-medium'}`}>{label}</span>
          </span>
        );
      })}
    </nav>
  );
}
