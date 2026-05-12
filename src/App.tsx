import { useEffect, useMemo, useState } from 'react';

type Lang = 'zh' | 'en';

type Cat = {
  id: string;
  name: string;
  emoji: string;
};

type CheckItem = {
  id: string;
  labelKey: string;
  emoji: string;
};

type DailyRecord = Record<string, boolean | string | string[]>;
type MonthlyRecord = Record<string, boolean>;
type Page = 'today' | 'history' | 'abnormal' | 'cats';

type AbnormalRecord = {
  date: string;
  abnormalNote: string;
  abnormalPhotos: string[];
};

const CATS_KEY = 'cat-calendar-cats';
const SELECTED_CAT_KEY = 'cat-calendar-selected-cat-id';
const LANG_KEY = 'cat-calendar-lang';
const MAX_PHOTOS = 3;

const dailyItems: CheckItem[] = [
  { id: 'feedMorning', labelKey: 'feedMorning', emoji: '🍖' },
  { id: 'feedNight', labelKey: 'feedNight', emoji: '🌙' },
  { id: 'litterMorning', labelKey: 'litterMorning', emoji: '🚽' },
  { id: 'litterNight', labelKey: 'litterNight', emoji: '🧹' },
  { id: 'pee', labelKey: 'pee', emoji: '💧' },
  { id: 'poop', labelKey: 'poop', emoji: '💩' },
  { id: 'waterCan', labelKey: 'waterCan', emoji: '🥫' },
  { id: 'snack', labelKey: 'snack', emoji: '🍪' },
  { id: 'brushHair', labelKey: 'brushHair', emoji: '🪮' },
  { id: 'brushTeeth', labelKey: 'brushTeeth', emoji: '🪥' },
];

const monthlyItems: CheckItem[] = [
  { id: 'changeLitter', labelKey: 'changeLitter', emoji: '🧹' },
  { id: 'deworming', labelKey: 'deworming', emoji: '💊' },
  { id: 'vaccine', labelKey: 'vaccine', emoji: '💉' },
  { id: 'vetVisit', labelKey: 'vetVisit', emoji: '🏥' },
  { id: 'bath', labelKey: 'bath', emoji: '🛁' },
  { id: 'nailTrim', labelKey: 'nailTrim', emoji: '✂️' },
  { id: 'catFood', labelKey: 'catFood', emoji: '🍚' },
];

const text = {
  zh: {
    appTitle: '貓咪日記',
    appSubtitle: 'Cat Calendar',
    today: '今日',
    history: '歷史',
    abnormal: '異常',
    cats: '貓咪',
    currentCat: '目前照顧',
    switchCat: '切換貓咪',
    date: '日期',
    month: '月份',
    todayProgress: '今日完成度',
    monthlyProgress: '本月完成度',
    dailyCare: '每日照顧',
    dailyCareDesc: '適合每天快速確認的照顧項目',
    abnormalRecord: '異常狀況紀錄',
    abnormalDesc: '有嘔吐、拉肚子、食慾變差、精神不好等狀況時，可以寫在這裡',
    abnormalPlaceholder: '例如：今天吐了 1 次，便便偏軟，食慾比平常差一點。',
    abnormalSaved: '已記錄異常狀況',
    noAbnormal: '沒有異常可以留空',
    abnormalPhotos: '異常照片',
    abnormalPhotosDesc: '可放嘔吐物、便便、傷口、皮膚、眼睛等照片，方便給獸醫看',
    dailyNote: '今日備註',
    dailyNoteDesc: '可以記錄心情、活動、食量變化或其他小事',
    dailyNotePlaceholder: '例如：今天很黏人，玩逗貓棒玩很久。',
    dailyPhotos: '今日照片',
    dailyPhotosDesc: '可放可愛日常、睡姿、玩耍或成長紀錄照片',
    addPhoto: '新增照片',
    photoLimit: '最多 3 張，照片會自動壓縮並保存在本機瀏覽器',
    monthlyCare: '本月定期照顧',
    monthlyCareDesc: '驅蟲、換貓砂、疫苗、看診這類不是每天做的項目',
    clearMonth: '清除本月紀錄',
    clearToday: '清除今日紀錄',
    historyTitle: '歷史紀錄',
    historyDesc: '查看過去每日照顧狀況、異常紀錄與照片',
    noHistory: '目前還沒有這隻貓的歷史紀錄',
    completed: '完成',
    abnormalSummary: '異常彙整',
    abnormalSummaryDesc: '彙整有填寫異常狀況或異常照片的日期，方便看診時給獸醫參考',
    copyForVet: '複製給獸醫',
    printPdf: '列印 / 存 PDF',
    noAbnormalHistory: '目前還沒有這隻貓的異常紀錄',
    photo: '照片',
    todayNoteTitle: '今日備註',
    myCats: '我的貓咪',
    catsDesc: '新增、切換不同貓咪，每隻貓會分開保存紀錄',
    addCat: '新增貓咪',
    catNamePlaceholder: '輸入貓咪名字，例如：火火',
    add: '新增',
    catList: '貓咪列表',
    selected: '目前選擇中',
    tapToSwitch: '點擊切換到這隻貓',
    delete: '刪除',
    savedLocal: '紀錄與照片會保存在這台手機 / 電腦的瀏覽器內',
    langButton: 'EN',
    removePhoto: '刪除',
    close: '關閉',
    copied: '已複製異常彙整，可以貼給獸醫或傳到 LINE',
    copyFailed: '複製失敗，請手動選取內容複製',
    noReport: '目前沒有異常紀錄可以複製',
    photoCannotCopy: '照片無法直接複製到文字訊息，請在異常彙整頁面截圖或列印給獸醫。',
    needCatName: '請先輸入貓咪名字',
    keepOneCat: '至少要保留一隻貓咪',
    confirmDeleteCat: '確定要刪除',
    deleteCatNote: '已保存的紀錄不會自動刪除，但畫面上不會再顯示這隻貓。',
    confirmClearToday: '確定要清除今天的紀錄嗎？',
    confirmClearMonth: '確定要清除本月定期照顧紀錄嗎？',
    photoTooMany: '照片最多只能放 3 張',
    photoLoadFail: '照片讀取失敗，請換一張照片試試',
    feedMorning: '早上餵食',
    feedNight: '晚上餵食',
    litterMorning: '早上挖貓砂',
    litterNight: '晚上挖貓砂',
    pee: '今天有尿尿',
    poop: '今天有大便',
    waterCan: '補水罐 / 飲水確認',
    snack: '零食確認',
    brushHair: '梳毛確認',
    brushTeeth: '刷牙確認',
    changeLitter: '本月換貓砂',
    deworming: '本月驅蟲',
    vaccine: '疫苗 / 預防針確認',
    vetVisit: '看診 / 回診確認',
    bath: '本月洗澡確認',
    nailTrim: '剪指甲確認',
    catFood: '本月貓糧 / 貓砂補貨確認',
  },
  en: {
    appTitle: 'Cat Diary',
    appSubtitle: 'Cat Calendar',
    today: 'Today',
    history: 'History',
    abnormal: 'Health',
    cats: 'Cats',
    currentCat: 'Current cat',
    switchCat: 'Switch',
    date: 'Date',
    month: 'Month',
    todayProgress: 'Today progress',
    monthlyProgress: 'Monthly progress',
    dailyCare: 'Daily care',
    dailyCareDesc: 'Quick daily checklist for your cat care routine',
    abnormalRecord: 'Abnormal condition notes',
    abnormalDesc: 'Record vomiting, diarrhea, low appetite, low energy, or anything unusual',
    abnormalPlaceholder: 'Example: Vomited once today. Stool was soft. Appetite was lower than usual.',
    abnormalSaved: 'Abnormal condition saved',
    noAbnormal: 'Leave blank if everything looks normal',
    abnormalPhotos: 'Abnormal photos',
    abnormalPhotosDesc: 'Add photos of vomit, stool, wounds, skin, eyes, or anything useful for the vet',
    dailyNote: 'Daily note',
    dailyNoteDesc: 'Record mood, activity, appetite changes, or small memories',
    dailyNotePlaceholder: 'Example: Very clingy today and played with the toy for a long time.',
    dailyPhotos: 'Daily photos',
    dailyPhotosDesc: 'Add cute moments, sleeping poses, playtime, or growth memories',
    addPhoto: 'Add photo',
    photoLimit: 'Up to 3 photos. Photos are compressed and saved in this browser',
    monthlyCare: 'Monthly care',
    monthlyCareDesc: 'Deworming, full litter change, vaccines, vet visits, and other periodic tasks',
    clearMonth: 'Clear month',
    clearToday: 'Clear today',
    historyTitle: 'History',
    historyDesc: 'Review daily care, abnormal notes, and photos',
    noHistory: 'No history for this cat yet',
    completed: 'Completed',
    abnormalSummary: 'Vet summary',
    abnormalSummaryDesc: 'Shows dates with abnormal notes or photos for vet visits',
    copyForVet: 'Copy for vet',
    printPdf: 'Print / PDF',
    noAbnormalHistory: 'No abnormal records for this cat yet',
    photo: 'Photos',
    todayNoteTitle: 'Daily note',
    myCats: 'My cats',
    catsDesc: 'Add and switch cats. Each cat has separate records',
    addCat: 'Add cat',
    catNamePlaceholder: 'Enter cat name, e.g. Momo',
    add: 'Add',
    catList: 'Cat list',
    selected: 'Selected',
    tapToSwitch: 'Tap to switch to this cat',
    delete: 'Delete',
    savedLocal: 'Records and photos are saved in this phone / computer browser',
    langButton: '中',
    removePhoto: 'Remove',
    close: 'Close',
    copied: 'Vet summary copied. You can paste it to your vet or LINE.',
    copyFailed: 'Copy failed. Please select and copy manually.',
    noReport: 'No abnormal records to copy yet',
    photoCannotCopy: 'Photos cannot be copied into plain text. Please screenshot or print the Vet summary page.',
    needCatName: 'Please enter a cat name first',
    keepOneCat: 'At least one cat is required',
    confirmDeleteCat: 'Delete',
    deleteCatNote: 'Saved records will not be removed automatically, but this cat will no longer appear.',
    confirmClearToday: 'Clear today’s record?',
    confirmClearMonth: 'Clear this month’s periodic care record?',
    photoTooMany: 'You can add up to 3 photos',
    photoLoadFail: 'Photo failed to load. Please try another photo.',
    feedMorning: 'Morning feeding',
    feedNight: 'Evening feeding',
    litterMorning: 'Morning litter scooping',
    litterNight: 'Evening litter scooping',
    pee: 'Pee today',
    poop: 'Poop today',
    waterCan: 'Water / wet food check',
    snack: 'Snack check',
    brushHair: 'Brushing check',
    brushTeeth: 'Teeth brushing check',
    changeLitter: 'Full litter change',
    deworming: 'Deworming',
    vaccine: 'Vaccine check',
    vetVisit: 'Vet visit / follow-up',
    bath: 'Bath check',
    nailTrim: 'Nail trim check',
    catFood: 'Food / litter refill check',
  },
};

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

function loadLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY);
  return saved === 'en' ? 'en' : 'zh';
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

function getPhotoList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }

  return [];
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

function getAbnormalHistory(catId: string): AbnormalRecord[] {
  return getAllDailyHistory(catId)
    .map((record) => {
      const abnormalNote =
        typeof record.data.abnormalNote === 'string'
          ? record.data.abnormalNote.trim()
          : '';
      const abnormalPhotos = getPhotoList(record.data.abnormalPhotos);

      return {
        date: record.date,
        abnormalNote,
        abnormalPhotos,
      };
    })
    .filter(
      (record) =>
        record.abnormalNote.length > 0 || record.abnormalPhotos.length > 0
    );
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('read error'));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('image error'));

      img.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('canvas error'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };

      img.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

export default function App() {
  const today = todayKey();
  const month = monthKey();

  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [cats, setCats] = useState<Cat[]>(() => loadCats());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const tr = text[lang];

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

  const abnormalPhotos = getPhotoList(daily.abnormalPhotos);
  const dailyPhotos = getPhotoList(daily.dailyPhotos);

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

  const abnormalHistory = useMemo(() => {
    historyRefreshKey;
    if (!selectedCat) return [];
    return getAbnormalHistory(selectedCat.id);
  }, [historyRefreshKey, selectedCat]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

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

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

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
      alert(tr.needCatName);
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
      alert(tr.keepOneCat);
      return;
    }

    if (
      !confirm(
        `${tr.confirmDeleteCat}「${target.name}」？\n${tr.deleteCatNote}`
      )
    ) {
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

  const addPhotos = async (
    key: 'abnormalPhotos' | 'dailyPhotos',
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    const currentPhotos = getPhotoList(daily[key]);
    const availableSlots = MAX_PHOTOS - currentPhotos.length;

    if (availableSlots <= 0) {
      alert(tr.photoTooMany);
      return;
    }

    const selectedFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, availableSlots);

    try {
      const compressedPhotos = await Promise.all(
        selectedFiles.map((file) => compressImage(file))
      );

      setDaily((prev) => ({
        ...prev,
        [key]: [...getPhotoList(prev[key]), ...compressedPhotos].slice(
          0,
          MAX_PHOTOS
        ),
      }));
    } catch {
      alert(tr.photoLoadFail);
    }
  };

  const removePhoto = (
    key: 'abnormalPhotos' | 'dailyPhotos',
    index: number
  ) => {
    setDaily((prev) => {
      const nextPhotos = getPhotoList(prev[key]).filter((_, i) => i !== index);
      return {
        ...prev,
        [key]: nextPhotos,
      };
    });
  };

  const resetToday = () => {
    if (confirm(tr.confirmClearToday)) {
      setDaily({});
    }
  };

  const resetMonth = () => {
    if (confirm(tr.confirmClearMonth)) {
      setMonthly({});
    }
  };

  const copyAbnormalReport = async () => {
    if (!selectedCat) return;

    if (abnormalHistory.length === 0) {
      alert(tr.noReport);
      return;
    }

    const report = [
      `${lang === 'zh' ? '貓咪' : 'Cat'}：${selectedCat.name}`,
      tr.abnormalSummary,
      `${lang === 'zh' ? '產生日期' : 'Created'}：${today}`,
      '',
      ...abnormalHistory.map((record) => {
        const photoText =
          record.abnormalPhotos.length > 0
            ? `\n${tr.photo}：${record.abnormalPhotos.length}`
            : '';

        return `【${record.date}】\n${record.abnormalNote || '-'}${photoText}`;
      }),
      '',
      tr.photoCannotCopy,
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(report);
      alert(tr.copied);
    } catch {
      alert(tr.copyFailed);
    }
  };

  const renderPhotoSection = (
    title: string,
    desc: string,
    photos: string[],
    keyName: 'abnormalPhotos' | 'dailyPhotos',
    tone: 'red' | 'orange'
  ) => {
    const buttonClass =
      tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-orange-200 bg-orange-50 text-orange-700';

    return (
      <div className="mt-4">
        <div className="mb-3">
          <h3 className="font-bold">{title}</h3>
          <p className="text-sm text-stone-500">{desc}</p>
          <p className="mt-1 text-xs text-stone-400">{tr.photoLimit}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <div
              key={`${keyName}-${index}`}
              className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setSelectedPhoto(photo)}
                className="block aspect-square w-full overflow-hidden"
              >
                <img
                  src={photo}
                  alt={`${title} ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>

              <button
                type="button"
                onClick={() => removePhoto(keyName, index)}
                className="w-full bg-white px-2 py-2 text-xs font-bold text-stone-500"
              >
                {tr.removePhoto}
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <label
              className={`flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center text-sm font-bold ${buttonClass}`}
            >
              + {tr.addPhoto}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addPhotos(keyName, e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
      </div>
    );
  };

  const renderCatSwitcher = () => (
    <div className="mb-5 rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-stone-400">{tr.currentCat}</p>
          <h2 className="text-xl font-bold">
            {selectedCat?.emoji ?? '🐱'} {selectedCat?.name ?? '我的貓咪'}
          </h2>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={toggleLanguage}
            className="rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-stone-700"
          >
            {tr.langButton}
          </button>

          <button
            onClick={() => setPage('cats')}
            className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700"
          >
            {tr.switchCat}
          </button>
        </div>
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
        <h1 className="mt-2 text-2xl font-bold">{tr.appTitle}</h1>
        <p className="mt-1 text-sm font-medium text-orange-600">
          {tr.appSubtitle}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {selectedCat?.name ?? '我的貓咪'}｜{tr.date}：{today}
        </p>

        <div className="mt-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>{tr.todayProgress}</span>
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
          <h2 className="text-lg font-bold">{tr.dailyCare}</h2>
          <p className="text-sm text-stone-500">{tr.dailyCareDesc}</p>
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
                <span className="font-medium">
                  {tr[item.labelKey as keyof typeof tr]}
                </span>
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
          <h2 className="text-lg font-bold">{tr.abnormalRecord}</h2>
          <p className="text-sm text-stone-500">{tr.abnormalDesc}</p>
        </div>

        <textarea
          value={abnormalNote}
          onChange={(e) => updateDailyText('abnormalNote', e.target.value)}
          placeholder={tr.abnormalPlaceholder}
          className="min-h-28 w-full resize-none rounded-2xl border border-red-100 bg-red-50 p-4 text-sm outline-none focus:border-red-300"
        />

        {abnormalNote.trim() ? (
          <p className="mt-2 text-sm font-medium text-red-600">
            {tr.abnormalSaved}
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-400">{tr.noAbnormal}</p>
        )}

        {renderPhotoSection(
          tr.abnormalPhotos,
          tr.abnormalPhotosDesc,
          abnormalPhotos,
          'abnormalPhotos',
          'red'
        )}
      </section>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-bold">{tr.dailyNote}</h2>
          <p className="text-sm text-stone-500">{tr.dailyNoteDesc}</p>
        </div>

        <textarea
          value={dailyNote}
          onChange={(e) => updateDailyText('dailyNote', e.target.value)}
          placeholder={tr.dailyNotePlaceholder}
          className="min-h-24 w-full resize-none rounded-2xl border border-stone-100 bg-stone-50 p-4 text-sm outline-none focus:border-orange-300"
        />

        {renderPhotoSection(
          tr.dailyPhotos,
          tr.dailyPhotosDesc,
          dailyPhotos,
          'dailyPhotos',
          'orange'
        )}
      </section>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{tr.monthlyCare}</h2>
            <p className="text-sm text-stone-500">{tr.monthlyCareDesc}</p>
            <p className="mt-1 text-sm text-stone-500">
              {selectedCat?.name ?? '我的貓咪'}｜{tr.month}：{month}
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
                <span className="font-medium">
                  {tr[item.labelKey as keyof typeof tr]}
                </span>
              </div>
              <span className="text-2xl">
                {monthly[item.id] ? '✅' : '⬜'}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>{tr.monthlyProgress}</span>
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
          {tr.clearMonth}
        </button>
      </section>

      <button
        onClick={resetToday}
        className="mb-6 w-full rounded-2xl bg-stone-800 py-4 font-bold text-white shadow-sm"
      >
        {tr.clearToday}
      </button>
    </>
  );

  const renderHistoryPage = () => (
    <>
      {renderCatSwitcher()}

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl">📅</div>
        <h1 className="mt-2 text-2xl font-bold">{tr.historyTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">{tr.historyDesc}</p>
      </div>

      {history.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">
          {tr.noHistory}
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
            const recordAbnormalPhotos = getPhotoList(
              record.data.abnormalPhotos
            );
            const recordDailyPhotos = getPhotoList(record.data.dailyPhotos);

            return (
              <div
                key={record.date}
                className="rounded-3xl bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{record.date}</h2>
                    <p className="text-sm text-stone-500">
                      {tr.completed} {done}/{dailyItems.length}（{percent}%）
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
                      {tr[item.labelKey as keyof typeof tr]}
                      <span className="ml-1">
                        {record.data[item.id] === true ? '✅' : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {recordAbnormalNote.trim() && (
                  <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                    <div className="mb-1 font-bold">⚠️ {tr.abnormalRecord}</div>
                    <p className="whitespace-pre-wrap">
                      {recordAbnormalNote}
                    </p>
                  </div>
                )}

                {recordAbnormalPhotos.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-2 text-sm font-bold text-red-700">
                      {tr.abnormalPhotos}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {recordAbnormalPhotos.map((photo, index) => (
                        <button
                          key={`history-abnormal-${record.date}-${index}`}
                          onClick={() => setSelectedPhoto(photo)}
                          className="aspect-square overflow-hidden rounded-2xl bg-red-50"
                        >
                          <img
                            src={photo}
                            alt={`${tr.abnormalPhotos} ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {recordDailyNote.trim() && (
                  <div className="mt-3 rounded-2xl bg-stone-50 p-4 text-sm text-stone-700">
                    <div className="mb-1 font-bold">📝 {tr.todayNoteTitle}</div>
                    <p className="whitespace-pre-wrap">{recordDailyNote}</p>
                  </div>
                )}

                {recordDailyPhotos.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-2 text-sm font-bold text-stone-700">
                      {tr.dailyPhotos}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {recordDailyPhotos.map((photo, index) => (
                        <button
                          key={`history-daily-${record.date}-${index}`}
                          onClick={() => setSelectedPhoto(photo)}
                          className="aspect-square overflow-hidden rounded-2xl bg-stone-50"
                        >
                          <img
                            src={photo}
                            alt={`${tr.dailyPhotos} ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const renderAbnormalPage = () => (
    <>
      {renderCatSwitcher()}

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl">⚠️</div>
        <h1 className="mt-2 text-2xl font-bold">{tr.abnormalSummary}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {selectedCat?.name ?? '我的貓咪'}｜{tr.abnormalSummaryDesc}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={copyAbnormalReport}
          className="rounded-2xl bg-orange-400 py-4 font-bold text-white shadow-sm"
        >
          {tr.copyForVet}
        </button>

        <button
          onClick={() => window.print()}
          className="rounded-2xl bg-stone-800 py-4 font-bold text-white shadow-sm"
        >
          {tr.printPdf}
        </button>
      </div>

      {abnormalHistory.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">
          {tr.noAbnormalHistory}
        </div>
      ) : (
        <div className="space-y-4">
          {abnormalHistory.map((record) => (
            <div
              key={record.date}
              className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-red-700">
                  {record.date}
                </h2>
                <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-600">
                  {tr.abnormal}
                </span>
              </div>

              {record.abnormalNote && (
                <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">
                  {record.abnormalNote}
                </p>
              )}

              {record.abnormalPhotos.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-sm font-bold text-red-700">
                    {tr.abnormalPhotos}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {record.abnormalPhotos.map((photo, index) => (
                      <button
                        key={`abnormal-${record.date}-${index}`}
                        onClick={() => setSelectedPhoto(photo)}
                        className="aspect-square overflow-hidden rounded-2xl bg-red-50"
                      >
                        <img
                          src={photo}
                          alt={`${tr.abnormalPhotos} ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderCatsPage = () => (
    <>
      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl">🐱</div>
        <h1 className="mt-2 text-2xl font-bold">{tr.myCats}</h1>
        <p className="mt-1 text-sm text-stone-500">{tr.catsDesc}</p>
      </div>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">{tr.addCat}</h2>
        <div className="flex gap-2">
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder={tr.catNamePlaceholder}
            className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-orange-300"
          />
          <button
            onClick={addCat}
            className="rounded-2xl bg-orange-400 px-5 py-3 font-bold text-white"
          >
            {tr.add}
          </button>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-lg font-bold">{tr.catList}</h2>
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
                        ? tr.selected
                        : tr.tapToSwitch}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => deleteCat(cat.id)}
                  className="rounded-full bg-stone-100 px-3 py-2 text-sm font-bold text-stone-500"
                >
                  {tr.delete}
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
        <div className="mb-5 grid grid-cols-4 gap-2 rounded-3xl bg-white p-2 shadow-sm">
          <button
            onClick={() => setPage('today')}
            className={`rounded-2xl py-3 text-xs font-bold transition ${
              page === 'today'
                ? 'bg-orange-400 text-white'
                : 'text-stone-500'
            }`}
          >
            {tr.today}
          </button>

          <button
            onClick={() => setPage('history')}
            className={`rounded-2xl py-3 text-xs font-bold transition ${
              page === 'history'
                ? 'bg-orange-400 text-white'
                : 'text-stone-500'
            }`}
          >
            {tr.history}
          </button>

          <button
            onClick={() => setPage('abnormal')}
            className={`rounded-2xl py-3 text-xs font-bold transition ${
              page === 'abnormal'
                ? 'bg-orange-400 text-white'
                : 'text-stone-500'
            }`}
          >
            {tr.abnormal}
          </button>

          <button
            onClick={() => setPage('cats')}
            className={`rounded-2xl py-3 text-xs font-bold transition ${
              page === 'cats'
                ? 'bg-orange-400 text-white'
                : 'text-stone-500'
            }`}
          >
            {tr.cats}
          </button>
        </div>

        {page === 'today' && renderTodayPage()}
        {page === 'history' && renderHistoryPage()}
        {page === 'abnormal' && renderAbnormalPage()}
        {page === 'cats' && renderCatsPage()}

        <p className="mt-6 text-center text-xs text-stone-400">
          {tr.savedLocal}
        </p>
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-full max-w-full">
            <img
              src={selectedPhoto}
              alt="preview"
              className="max-h-[80vh] max-w-full rounded-3xl object-contain"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="mt-4 w-full rounded-2xl bg-white py-3 font-bold text-stone-800"
            >
              {tr.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
