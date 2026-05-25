import type { ReactNode } from 'react';
import { APP_STORE_FONT_FAMILY, DEVICE_LOGICAL_W } from './constants';
import { AppStoreMainNav, type AppStoreTabId } from './AppStoreMainNav';

type AppStoreScreenShellProps = {
  activeTab: AppStoreTabId;
  showProBadge?: boolean;
  children: ReactNode;
};

/** Real app chrome: orange page bg, 3×2 main nav, scrollable body. */
export function AppStoreScreenShell({ activeTab, showProBadge, children }: AppStoreScreenShellProps) {
  return (
    <section
      className="app-store-mock-screen flex min-h-full flex-col bg-orange-50 px-4 py-4 text-stone-800"
      style={{ width: DEVICE_LOGICAL_W, fontFamily: APP_STORE_FONT_FAMILY }}
    >
      <AppStoreMainNav active={activeTab} />
      {showProBadge ? (
        <div className="mb-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-white shadow-md shadow-orange-300/40">
            Pro 會員
          </span>
        </div>
      ) : null}
      <section className="min-h-0 flex-1 overflow-hidden">{children}</section>
    </section>
  );
}
