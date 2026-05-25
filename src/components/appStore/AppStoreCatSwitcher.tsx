import { appStoreZh } from './appStoreCopy';
import { DEMO_CAT } from './demoData';

const CATS = [
  DEMO_CAT,
  { id: 'demo-huohuo', name: '火火', emoji: '🐈' },
] as const;

type AppStoreCatSwitcherProps = {
  compact?: boolean;
};

/** Matches App.tsx renderCatSwitcher profile card + pill row. */
export function AppStoreCatSwitcher({ compact }: AppStoreCatSwitcherProps) {
  if (compact) {
    return (
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {CATS.map((cat, i) => (
          <span
            key={cat.id}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
              i === 0 ? 'bg-orange-400 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {cat.emoji} {cat.name}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-3xl">
            {DEMO_CAT.emoji}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-400">{appStoreZh.currentCat}</p>
            <h2 className="truncate text-xl font-bold">{DEMO_CAT.name}</h2>
          </div>
        </div>
        <div className="flex shrink-0 flex-row flex-nowrap items-center justify-end gap-2">
          <span className="whitespace-nowrap rounded-full bg-stone-100 px-3.5 py-2 text-[13px] font-bold text-stone-700">
            EN
          </span>
          <span className="whitespace-nowrap rounded-full bg-orange-100 px-3.5 py-2 text-[13px] font-bold text-orange-700">
            管理寵物
          </span>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATS.map((cat, i) => (
          <span
            key={cat.id}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
              i === 0 ? 'bg-orange-400 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {cat.emoji} {cat.name}
          </span>
        ))}
      </div>
    </div>
  );
}
