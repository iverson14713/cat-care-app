import { useEffect, useMemo, useState } from 'react';

type CheckItem = {
  id: string;
  label: string;
  emoji: string;
};

type DailyRecord = Record<string, boolean>;
type MonthlyRecord = Record<string, boolean>;

const dailyItems: CheckItem[] = [
  { id: 'feedMorning', label: '早上餵食', emoji: '🍖' },
  { id: 'feedNight', label: '晚上餵食', emoji: '🌙' },
  { id: 'litterMorning', label: '早上挖貓砂', emoji: '🚽' },
  { id: 'litterNight', label: '晚上挖貓砂', emoji: '🧹' },
  { id: 'pee', label: '今天有尿尿', emoji: '💧' },
  { id: 'poop', label: '今天有大便', emoji: '💩' },
  { id: 'waterCan', label: '補水罐', emoji: '🥫' },
  { id: 'snack', label: '零食確認', emoji: '🍪' },
  { id: 'brushHair', label: '梳毛確認', emoji: '🪮' },
  { id: 'brushTeeth', label: '刷牙確認', emoji: '🪥' },
];

const monthlyItems: CheckItem[] = [
  { id: 'bath', label: '本月洗澡確認', emoji: '🛁' },
  { id: 'catFood', label: '本月貓糧確認', emoji: '🍚' },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

export default function App() {
  const today = todayKey();
  const month = monthKey();

  const [daily, setDaily] = useState<DailyRecord>(() => {
    const saved = localStorage.getItem(`cat-care-daily-${today}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [monthly, setMonthly] = useState<MonthlyRecord>(() => {
    const saved = localStorage.getItem(`cat-care-monthly-${month}`);
    return saved ? JSON.parse(saved) : {};
  });

  const dailyDone = useMemo(
    () => dailyItems.filter((item) => daily[item.id]).length,
    [daily]
  );

  const monthlyDone = useMemo(
    () => monthlyItems.filter((item) => monthly[item.id]).length,
    [monthly]
  );

  const dailyPercent = Math.round((dailyDone / dailyItems.length) * 100);
  const monthlyPercent = Math.round((monthlyDone / monthlyItems.length) * 100);

  useEffect(() => {
    localStorage.setItem(`cat-care-daily-${today}`, JSON.stringify(daily));
  }, [daily, today]);

  useEffect(() => {
    localStorage.setItem(`cat-care-monthly-${month}`, JSON.stringify(monthly));
  }, [monthly, month]);

  const toggleDaily = (id: string) => {
    setDaily((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMonthly = (id: string) => {
    setMonthly((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetToday = () => {
    if (confirm('確定要清除今天的紀錄嗎？')) {
      setDaily({});
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 px-4 py-6 text-stone-800">
      <div className="mx-auto max-w-md">
        <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
          <div className="text-4xl">🐱</div>
          <h1 className="mt-2 text-2xl font-bold">貓咪每日照護</h1>
          <p className="mt-1 text-sm text-stone-500">日期：{today}</p>

          <div className="mt-4">
            <div className="mb-2 flex justify-between text-sm">
              <span>今日完成度</span>
              <span>
                {dailyDone}/{dailyItems.length}（{dailyPercent}%）
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-orange-100">
              <div
                className="h-full rounded-full bg-orange-400 transition-all"
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
          </div>
        </div>

        <section className="mb-5">
          <h2 className="mb-3 text-lg font-bold">每日確認</h2>
          <div className="space-y-3">
            {dailyItems.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleDaily(item.id)}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left shadow-sm transition ${
                  daily[item.id]
                    ? 'border-green-200 bg-green-50'
                    : 'border-stone-100 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <span className="font-medium">{item.label}</span>
                </div>
                <span className="text-2xl">{daily[item.id] ? '✅' : '⬜'}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">每月確認</h2>
              <p className="text-sm text-stone-500">月份：{month}</p>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
              {monthlyDone}/{monthlyItems.length}
            </span>
          </div>

          <div className="space-y-3">
            {monthlyItems.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleMonthly(item.id)}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                  monthly[item.id]
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-stone-100 bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <span className="font-medium">{item.label}</span>
                </div>
                <span className="text-2xl">
                  {monthly[item.id] ? '✅' : '⬜'}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex justify-between text-sm">
              <span>本月完成度</span>
              <span>{monthlyPercent}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-blue-400 transition-all"
                style={{ width: `${monthlyPercent}%` }}
              />
            </div>
          </div>
        </section>

        <button
          onClick={resetToday}
          className="mb-6 w-full rounded-2xl bg-stone-800 py-4 font-bold text-white shadow-sm"
        >
          清除今日紀錄
        </button>

        <p className="text-center text-xs text-stone-400">
          紀錄會保存在這台手機 / 電腦的瀏覽器內
        </p>
      </div>
    </div>
  );
}
