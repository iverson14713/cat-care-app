import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = {
  'src/components/appStore/screens/MockTodayScreen.tsx': `import { MockScreenShell } from '../MockScreenShell';

const TASKS = [
  { label: '早餐', done: true },
  { label: '飲水', done: true },
  { label: '清貓砂', done: true },
  { label: '晚餐', done: false },
];

export function MockTodayScreen() {
  return (
    <MockScreenShell activeTab="today">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">今日照護</h1>

      <section className="mb-2.5 rounded-2xl border border-orange-100 bg-white px-3 py-2.5 shadow-sm">
        <header className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-lg font-bold text-orange-600">
            毛
          </span>
          <span className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-stone-900">毛毛 Pet Care</p>
            <p className="text-[10px] text-stone-500">2026-05-19</p>
          </span>
          <span className="text-right">
            <p className="text-base font-bold text-orange-600">75%</p>
          </span>
        </header>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-orange-100">
          <span className="block h-full w-3/4 rounded-full bg-gradient-to-r from-orange-400 to-orange-500" />
        </span>
      </section>

      <h2 className="mb-1.5 text-[12px] font-bold text-stone-900">今日任務</h2>
      <section className="grid grid-cols-2 gap-1.5">
        {TASKS.map((item) => (
          <article
            key={item.label}
            className={\`flex min-h-[48px] items-center justify-between rounded-xl border px-2.5 py-2 \${
              item.done ? 'border-green-200 bg-green-50' : 'border-stone-100 bg-white'
            }\`}
          >
            <span className="text-[11px] font-bold text-stone-700">{item.label}</span>
            <span
              className={\`h-4 w-4 rounded-full border-2 \${
                item.done ? 'border-green-500 bg-green-500' : 'border-stone-300 bg-white'
              }\`}
              aria-hidden
            />
          </article>
        ))}
      </section>

      <section className="mt-2.5 rounded-2xl border border-red-100 bg-white p-2.5 shadow-sm">
        <h3 className="text-[11px] font-bold text-stone-900">異常紀錄</h3>
        <p className="mt-1 rounded-xl border border-red-100 bg-red-50 p-2 text-[10px] leading-snug text-stone-700">
          今天精神良好，食慾正常
        </p>
      </section>
    </MockScreenShell>
  );
}
`,

  'src/components/appStore/screens/MockWeightScreen.tsx': `import { MockScreenShell } from '../MockScreenShell';

const RECORDS = [
  { date: '05/15', weight: '4.6' },
  { date: '05/08', weight: '4.5' },
  { date: '05/01', weight: '4.4' },
];

const BARS = [42, 48, 45, 52, 58, 55, 62];

export function MockWeightScreen() {
  return (
    <MockScreenShell activeTab="weight">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">體重紀錄</h1>

      <section className="mb-2 rounded-2xl bg-white p-3 shadow-sm">
        <p className="text-[11px] text-stone-500">目前體重</p>
        <p className="mt-1 text-2xl font-bold text-orange-600">4.8 kg</p>
        <p className="text-[10px] text-stone-500">2026-05-19</p>
      </section>

      <section className="mb-2 rounded-2xl border border-orange-100 bg-white p-2.5 shadow-sm">
        <p className="mb-2 text-center text-[10px] font-bold text-stone-700">近 7 次體重變化</p>
        <span className="flex h-24 items-end justify-between gap-1 px-1">
          {BARS.map((h, i) => (
            <span
              key={String(i)}
              className="block flex-1 rounded-t-md bg-gradient-to-t from-orange-500 to-orange-300"
              style={{ height: \`\${h}%\` }}
            />
          ))}
        </span>
      </section>

      <section className="space-y-1.5">
        {RECORDS.map((r) => (
          <article
            key={r.date}
            className="flex items-center justify-between rounded-xl border border-stone-100 bg-white px-3 py-2"
          >
            <span className="text-[10px] text-stone-500">{r.date}</span>
            <span className="text-[13px] font-bold text-orange-700">{r.weight} kg</span>
          </article>
        ))}
      </section>
    </MockScreenShell>
  );
}
`,

  'src/components/appStore/screens/MockVetScreen.tsx': `import { MockScreenShell } from '../MockScreenShell';

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
`,

  'src/components/appStore/screens/MockRemindersScreen.tsx': `import { MockScreenShell } from '../MockScreenShell';

const DAILY = [
  { title: '早餐', time: '08:00' },
  { title: '晚餐', time: '09:00' },
];

const SCHEDULED = [{ title: '驅蟲', date: '06/15', time: '10:00' }];

export function MockRemindersScreen() {
  return (
    <MockScreenShell activeTab="reminders">
      <h1 className="mb-2 text-[15px] font-bold text-stone-900">提醒</h1>

      <section className="mb-2 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-white p-2.5">
        <p className="text-[11px] font-bold text-stone-900">日常提醒</p>
        <ul className="mt-1.5 space-y-1">
          {DAILY.map((r) => (
            <li
              key={r.title}
              className="flex items-center justify-between rounded-xl border border-orange-100 bg-white px-2.5 py-2"
            >
              <span className="text-[11px] font-semibold text-stone-900">{r.title}</span>
              <span className="text-[11px] font-bold text-orange-600">{r.time}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-2.5">
        <p className="text-[11px] font-bold text-stone-900">定期照護</p>
        {SCHEDULED.map((r) => (
          <article
            key={r.title}
            className="mt-1.5 flex items-center justify-between rounded-xl border border-sky-100 bg-white px-2.5 py-2"
          >
            <span>
              <span className="block text-[11px] font-semibold text-stone-900">{r.title}</span>
              <span className="block text-[9px] text-stone-500">{r.date}</span>
            </span>
            <span className="text-[11px] font-bold text-sky-700">{r.time}</span>
          </article>
        ))}
      </section>
    </MockScreenShell>
  );
}
`,

  'src/components/appStore/screens/MockAssistantScreen.tsx': `import { MockScreenShell } from '../MockScreenShell';

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
`,

  'src/components/appStore/MockBottomNav.tsx': `import { Bell, Calendar, LayoutGrid, Scale, Stethoscope } from 'lucide-react';
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
            className={\`flex flex-1 flex-col items-center gap-0.5 py-2 \${on ? 'text-orange-500' : 'text-stone-400'}\`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={on ? 2.4 : 2} aria-hidden />
            <span className={\`text-[9px] leading-none \${on ? 'font-bold' : 'font-medium'}\`}>{label}</span>
          </span>
        );
      })}
    </nav>
  );
}
`,
};

for (const [rel, content] of Object.entries(files)) {
  const p = path.join(root, rel);
  fs.writeFileSync(p, content, 'utf8');
  console.log('wrote', rel);
}
