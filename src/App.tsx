import { useEffect, useMemo, useState } from 'react';

type Cat = {
  id: string;
  name: string;
  emoji: string;
};

type CheckItem = {
  id: string;
  label: string;
  emoji: string;
};

type DailyRecord = Record<string, boolean | string>;
type MonthlyRecord = Record<string, boolean>;
type Page = 'today' | 'history' | 'cats';

const CATS_KEY = 'cat-calendar-cats';
const SELECTED_CAT_KEY = 'cat-calendar-selected-cat-id';

const dailyItems: CheckItem[] = [
  { id: 'feedMorning', label: '早上餵食', emoji: '🍖' },
  { id: 'feedNight', label: '晚上餵食', emoji: '🌙' },
  { id: 'litterMorning', label: '早上挖貓砂', emoji: '🚽' },
  { id: 'litterNight', label: '晚上挖貓砂', emoji: '🧹' },
  { id: 'pee', label: '今天有尿尿', emoji: '💧' },
  { id: 'poop', label: '今天有大便', emoji: '💩' },
  { id: 'waterCan', label: '補水罐 / 飲水確認', emoji: '🥫' },
  { id: 'snack', label: '零食確認', emoji: '🍪' },
  { id: 'brushHair', label: '梳毛確認', emoji: '🪮' },
  { id: 'brushTeeth', label: '刷牙確認', emoji: '🪥' },
];

const monthlyItems: CheckItem[] = [
  { id: 'changeLitter', label: '本月換貓砂', emoji: '🧹' },
  { id: 'deworming', label: '本月驅蟲', emoji: '💊' },
  { id: 'vaccine', label: '疫苗 / 預防針確認', emoji: '💉' },
  { id: 'vetVisit', label: '看診 / 回診確認', emoji: '🏥' },
  { id: 'bath', label: '本月洗澡確認', emoji: '🛁' },
  { id: 'nailTrim', label: '剪指甲確認', emoji: '✂️' },
  { id: 'catFood', label: '本月貓糧 / 貓砂補貨確認', emoji: '🍚' },
];

function makeId() {
  return `cat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function todayKey() {
  return formatDateLocal(new Date());
}

function monthKey() {
  return formatMonthLocal(new Date());
}

function dailyStorageKey(catId: string, date: string) {
  return `cat-calendar-daily-${catId}-${date}`;
}

function monthlyStorageKey(catId: string, month: string) {
  return `cat-calendar-monthly-${catId}-${month}`;
}

function loadCats(): Cat[] {
  const saved = localStorage.getItem(CATS_KEY);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore broken data
    }
  }

  return [
    {
      id: 'default-cat',
      name: '我的貓咪',
      emoji: '🐱',
    },
  ];
}

function loadDailyRecord(catId: string, date: string): DailyRecord {
  const saved = localStorage.getItem(dailyStorageKey(catId, date));

  if (!saved) return {};

  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function loadMonthlyRecord(catId: string, month: string): MonthlyRecord {
  const saved = localStorage.getItem(monthlyStorageKey(catId, month));

  if (!saved) return {};

  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function getAllDailyHistory(catId: string) {
  const records: { date: string; data: DailyRecord }[] = [];
  const prefix = `cat-calendar-daily-${catId}-`;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key?.startsWith(prefix)) {
      const date = key.replace(prefix, '');
      const raw = localStorage.getItem(key);

      if (raw) {
        try {
          records.push({
            date,
            data: JSON.parse(raw),
          });
        } catch {
          // ignore broken records
        }
      }
    }
  }

  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export default function App() {
  const today = todayKey();
  const month = monthKey();

  const [cats, setCats] = useState<Cat[]>(() => loadCats());

  const [selectedCatId, setSelectedCatId] = useState<string>(() => {
    const savedCats = loadCats();
    const savedSelectedId = localStorage.getItem(SELECTED_CAT_KEY);

    if (savedSelectedId && savedCats.some((cat) => cat.id === savedSelectedId)) {
      return savedSelectedId;
    }

    return savedCats[0]?.id ?? 'default-cat';
  });

  const selectedCat =
    cats.find((cat) => cat.id === selectedCatId) ?? cats[0];

  const [page, setPage] = useState<Page>('today');
  const [newCatName, setNewCatName] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [daily, setDaily] = useState<DailyRecord>(() =>
    loadDailyRecord(selectedCatId, today)
  );

  const [monthly, setMonthly] = useState<MonthlyRecord>(() =>
    loadMonthlyRecord(selectedCatId, month)
  );

  const abnormalNote =
    typeof daily.abnormalNote === 'string' ? daily.abnormalNote : '';

  const dailyNote =
    typeof daily.dailyNote === 'string' ? daily.dailyNote : '';

  const dailyDone = useMemo(
    () => dailyItems.filter((item) => daily[item.id] === true).length,
    [daily]
  );

  const monthlyDone = useMemo(
    () => monthlyItems.filter((item) => monthly[item.id]).length,
    [monthly]
  );

  const dailyPercent = Math.round((dailyDone / dailyItems.length) * 100);
  const monthlyPercent = Math.round((monthlyDone / monthlyItems.length) * 100);

  const history = useMemo(() => {
    historyRefreshKey;
    if (!selectedCat) return [];
    return getAllDailyHistory(selectedCat.id);
  }, [historyRefreshKey, selectedCat]);

  useEffect(() => {
    localStorage.setItem(CATS_KEY, JSON.stringify(cats));
  }, [cats]);

  useEffect(() => {
    localStorage.setItem(SELECTED_CAT_KEY, selectedCatId);
  }, [selectedCatId]);

  useEffect(() => {
    if (!selectedCat) return;
    localStorage.setItem(
      dailyStorageKey(selectedCat.id, today),
      JSON.stringify(daily)
    );
    setHistoryRefreshKey((v) => v + 1);
  }, [daily, selectedCat, today]);

  useEffect(() => {
    if (!selectedCat) return;
    localStorage.setItem(
      monthlyStorageKey(selectedCat.id, month),
      JSON.stringify(monthly)
    );
  }, [monthly, selectedCat, month]);

  const selectCat = (catId: string) => {
    setSelectedCatId(catId);
    setDaily(loadDailyRecord(catId, today));
    setMonthly(loadMonthlyRecord(catId, month));
    setHistoryRefreshKey((v) => v + 1);
    setPage('today');
  };

  const addCat = () => {
    const name = newCatName.trim();

    if (!name) {
      alert('請先輸入貓咪名字');
      return;
    }

    const newCat: Cat = {
      id: makeId(),
      name,
      emoji: '🐱',
    };

    setCats((prev) => [...prev, newCat]);
    setNewCatName('');
    setSelectedCatId(newCat.id);
    setDaily({});
    setMonthly({});
    setHistoryRefreshKey((v) => v + 1);
    setPage('today');
  };

  const deleteCat = (catId: string) => {
    const target = cats.find((cat) => cat.id === catId);

    if (!target) return;

    if (cats.length <= 1) {
      alert('至少要保留一隻貓咪');
      return;
    }

    if (!confirm(`確定要刪除「${target.name}」嗎？\n已保存的紀錄不會自動刪除，但畫面上不會再顯示這隻貓。`)) {
      return;
    }

    const nextCats = cats.filter((cat) => cat.id !== catId);
    const nextSelected = selectedCatId === catId ? nextCats[0] : selectedCat;

    setCats(nextCats);

    if (nextSelected) {
      setSelectedCatId(nextSelected.id);
      setDaily(loadDailyRecord(nextSelected.id, today));
      setMonthly(loadMonthlyRecord(nextSelected.id, month));
      setHistoryRefreshKey((v) => v + 1);
    }
  };

  const toggleDaily = (id: string) => {
    setDaily((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMonthly = (id: string) => {
    setMonthly((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateDailyText = (key: string, value: string) => {
    setDaily((prev) => ({ ...prev, [key]: value }));
  };

  const resetToday = () => {
    if (confirm(`確定要清除「${selectedCat?.name ?? '目前貓咪'}」今天的紀錄嗎？`)) {
      setDaily({});
    }
  };

  const resetMonth = () => {
    if (confirm(`確定要清除「${selectedCat?.name ?? '目前貓咪'}」本月定期照顧紀錄嗎？`)) {
      setMonthly({});
    }
  };

  const renderCatSwitcher = () => (
    <div className="mb-5 rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-stone-400">目前照顧</p>
          <h2 className="text-xl font-bold">
            {selectedCat?.emoji ?? '🐱'} {selectedCat?.name ?? '我的貓咪'}
          </h2>
        </div>
        <button
          onClick={() => setPage('cats')}
          className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700"
        >
          切換貓咪
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {cats.map((cat) => (
          <button
            key={cat.id}
            onClick={() => selectCat(cat.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              selectedCat?.id === cat.id
                ? 'bg-orange-400 text-white'
                : 'bg-stone-100 text-stone-600'
            }`}
          >
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>
    </div>
  );

  const renderTodayPage = () => (
    <>
      {renderCatSwitcher()}

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl">🐾</div>
        <h1 className="mt-2 text-2xl font-bold">貓咪日記</h1>
        <p className="mt-1 text-sm font-medium text-orange-600">
          Cat Calendar
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {selectedCat?.name ?? '我的貓咪'}｜日期：{today}
        </p>

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
        <div className="mb-3">
          <h2 className="text-lg font-bold">每日照顧</h2>
          <p className="text-sm text-stone-500">
            適合每天快速確認的照顧項目
          </p>
        </div>

        <div className="space-y-3">
          {dailyItems.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleDaily(item.id)}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left shadow-sm transition ${
                daily[item.id] === true
                  ? 'border-green-200 bg-green-50'
                  : 'border-stone-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              <span className="text-2xl">
                {daily[item.id] === true ? '✅' : '⬜'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-bold">異常狀況紀錄</h2>
          <p className="text-sm text-stone-500">
            有嘔吐、拉肚子、食慾變差、精神不好等狀況時，可以寫在這裡
          </p>
        </div>

        <textarea
          value={abnormalNote}
          onChange={(e) => updateDailyText('abnormalNote', e.target.value)}
          placeholder={`例如：${selectedCat?.name ?? '貓咪'}今天吐了 1 次，便便偏軟，食慾比平常差一點。`}
          className="min-h-28 w-full resize-none rounded-2xl border border-red-100 bg-red-50 p-4 text-sm outline-none focus:border-red-300"
        />

        {abnormalNote.trim() ? (
          <p className="mt-2 text-sm font-medium text-red-600">
            已記錄異常狀況
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-400">
            沒有異常可以留空
          </p>
        )}
      </section>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-bold">今日備註</h2>
          <p className="text-sm text-stone-500">
            可以記錄心情、活動、食量變化或其他小事
          </p>
        </div>

        <textarea
          value={dailyNote}
          onChange={(e) => updateDailyText('dailyNote', e.target.value)}
          placeholder={`例如：${selectedCat?.name ?? '貓咪'}今天很黏人，玩逗貓棒玩很久。`}
          className="min-h-24 w-full resize-none rounded-2xl border border-stone-100 bg-stone-50 p-4 text-sm outline-none focus:border-orange-300"
        />
      </section>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">本月定期照顧</h2>
            <p className="text-sm text-stone-500">
              驅蟲、換貓砂、疫苗、看診這類不是每天做的項目
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {selectedCat?.name ?? '我的貓咪'}｜月份：{month}
            </p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
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

        <button
          onClick={resetMonth}
          className="mt-4 w-full rounded-2xl border border-stone-200 bg-white py-3 font-bold text-stone-600"
        >
          清除本月紀錄
        </button>
      </section>

      <button
        onClick={resetToday}
        className="mb-6 w-full rounded-2xl bg-stone-800 py-4 font-bold text-white shadow-sm"
      >
        清除今日紀錄
      </button>
    </>
  );

  const renderHistoryPage = () => (
    <>
      {renderCatSwitcher()}

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl">📅</div>
        <h1 className="mt-2 text-2xl font-bold">歷史紀錄</h1>
        <p className="mt-1 text-sm text-stone-500">
          查看 {selectedCat?.name ?? '目前貓咪'} 過去每日照顧狀況與異常紀錄
        </p>
      </div>

      {history.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">
          目前還沒有這隻貓的歷史紀錄
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((record) => {
            const done = dailyItems.filter(
              (item) => record.data[item.id] === true
            ).length;
            const percent = Math.round((done / dailyItems.length) * 100);
            const recordAbnormalNote =
              typeof record.data.abnormalNote === 'string'
                ? record.data.abnormalNote
                : '';
            const recordDailyNote =
              typeof record.data.dailyNote === 'string'
                ? record.data.dailyNote
                : '';

            return (
              <div
                key={record.date}
                className="rounded-3xl bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{record.date}</h2>
                    <p className="text-sm text-stone-500">
                      完成 {done}/{dailyItems.length} 項（{percent}%）
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                    {percent}%
                  </span>
                </div>

                <div className="mb-4 h-3 overflow-hidden rounded-full bg-orange-100">
                  <div
                    className="h-full rounded-full bg-orange-400"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {dailyItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl px-3 py-2 ${
                        record.data[item.id] === true
                          ? 'bg-green-50 text-green-700'
                          : 'bg-stone-50 text-stone-400'
                      }`}
                    >
                      <span className="mr-1">{item.emoji}</span>
                      {item.label}
                      <span className="ml-1">
                        {record.data[item.id] === true ? '✅' : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {recordAbnormalNote.trim() && (
                  <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                    <div className="mb-1 font-bold">⚠️ 異常狀況</div>
                    <p className="whitespace-pre-wrap">
                      {recordAbnormalNote}
                    </p>
                  </div>
                )}

                {recordDailyNote.trim() && (
                  <div className="mt-3 rounded-2xl bg-stone-50 p-4 text-sm text-stone-700">
                    <div className="mb-1 font-bold">📝 今日備註</div>
                    <p className="whitespace-pre-wrap">{recordDailyNote}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const renderCatsPage = () => (
    <>
      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl">🐱</div>
        <h1 className="mt-2 text-2xl font-bold">我的貓咪</h1>
        <p className="mt-1 text-sm text-stone-500">
          新增、切換不同貓咪，每隻貓會分開保存紀錄
        </p>
      </div>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">新增貓咪</h2>
        <div className="flex gap-2">
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="輸入貓咪名字，例如：火火"
            className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-orange-300"
          />
          <button
            onClick={addCat}
            className="rounded-2xl bg-orange-400 px-5 py-3 font-bold text-white"
          >
            新增
          </button>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-lg font-bold">貓咪列表</h2>
        <div className="space-y-3">
          {cats.map((cat) => (
            <div
              key={cat.id}
              className={`rounded-3xl border p-4 shadow-sm ${
                selectedCat?.id === cat.id
                  ? 'border-orange-200 bg-orange-50'
                  : 'border-stone-100 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => selectCat(cat.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="text-3xl">{cat.emoji}</span>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{cat.name}</h3>
                    <p className="text-sm text-stone-500">
                      {selectedCat?.id === cat.id
                        ? '目前選擇中'
                        : '點擊切換到這隻貓'}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => deleteCat(cat.id)}
                  className="rounded-full bg-stone-100 px-3 py-2 text-sm font-bold text-stone-500"
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  return (
    <div className="min-h-screen bg-orange-50 px-4 py-6 text-stone-800">
      <div className="mx-auto max-w-md pb-24">
        <div className="mb-5 grid grid-cols-3 gap-2 rounded-3xl bg-white p-2 shadow-sm">
          <button
            onClick={() => setPage('today')}
            className={`rounded-2xl py-3 text-sm font-bold transition ${
              page === 'today'
                ? 'bg-orange-400 text-white'
                : 'text-stone-500'
            }`}
          >
            今日照顧
          </button>
          <button
            onClick={() => setPage('history')}
            className={`rounded-2xl py-3 text-sm font-bold transition ${
              page === 'history'
                ? 'bg-orange-400 text-white'
                : 'text-stone-500'
            }`}
          >
            歷史紀錄
          </button>
          <button
            onClick={() => setPage('cats')}
            className={`rounded-2xl py-3 text-sm font-bold transition ${
              page === 'cats'
                ? 'bg-orange-400 text-white'
                : 'text-stone-500'
            }`}
          >
            我的貓咪
          </button>
        </div>

        {page === 'today' && renderTodayPage()}
        {page === 'history' && renderHistoryPage()}
        {page === 'cats' && renderCatsPage()}

        <p className="mt-6 text-center text-xs text-stone-400">
          紀錄會保存在這台手機 / 電腦的瀏覽器內
        </p>
      </div>
    </div>
  );
}
