import type { ReactNode } from 'react';
import { APP_STORE_FONT_FAMILY, DEVICE_LOGICAL_W } from './constants';
import { MockMainGridNav, type MockTabId } from './MockMainGridNav';

type MockScreenShellProps = {
  activeTab: MockTabId;
  children: ReactNode;
};

/** In-app screen chrome: status bar + scrollable body + main grid nav (matches production). */
export function MockScreenShell({ activeTab, children }: MockScreenShellProps) {
  return (
    <section
      className="app-store-mock-screen flex h-full flex-col bg-[#faf8f5] text-stone-900"
      style={{ width: DEVICE_LOGICAL_W, fontFamily: APP_STORE_FONT_FAMILY }}
    >
      <header className="flex items-center justify-between px-4 pb-1 pt-2.5">
        <span className="text-[11px] font-semibold tabular-nums text-stone-900">9:41</span>
        <span className="text-[10px] font-semibold text-stone-600" aria-hidden>
          100%
        </span>
      </header>
      <section className="min-h-0 flex-1 overflow-hidden px-3 pb-2 pt-0">{children}</section>
      <div className="px-2 pb-2">
        <MockMainGridNav active={activeTab} />
      </div>
    </section>
  );
}
