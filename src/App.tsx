import { useEffect, useMemo, useState } from 'react';

type Lang = 'zh' | 'en';

type Cat = {
  id: string;
  name: string;
  emoji: string;
  profilePhoto?: string;
  birthday?: string;
  gender?: string;
  breed?: string;
  neutered?: string;
  chipNo?: string;
  chronicNote?: string;
  allergyNote?: string;
  vetClinic?: string;
  profileNote?: string;
};

type CheckItem = {
  id: string;
  labelKey: string;
  emoji: string;
};

type DailyRecord = Record<string, boolean | string | string[]>;
type MonthlyRecord = Record<string, boolean>;
type Page = 'today' | 'weight' | 'vet' | 'history' | 'cats';

type AbnormalRecord = {
  date: string;
  abnormalNote: string;
  abnormalPhotos: string[];
  dailyNote: string;
  dailyPhotos: string[];
};

type WeightRecord = {
  id: string;
  date: string;
  weight: number;
  note: string;
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
    weight: '體重',
    history: '歷史',
    vet: '獸醫',
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
    vetReport: '獸醫報告',
    vetReportDesc: '整理貓咪資料、體重趨勢、異常狀況、照片與備註，方便看診時給獸醫參考',
    copyForVet: '複製給獸醫',
    printPdf: '列印 / 存 PDF',
    noAbnormalHistory: '目前還沒有這隻貓的異常紀錄',
    photo: '照片',
    todayNoteTitle: '今日備註',
    myCats: '我的貓咪',
    catsDesc: '新增、切換不同貓咪，每隻貓會分開保存紀錄，也可以編輯貓咪個人資料',
    catProfile: '貓咪個人資料',
    catProfileDesc: '基本資料、慢性病、過敏與常用獸醫院，之後可以一起整理給獸醫看',
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
    copied: '獸醫報告已複製，可以貼給獸醫或傳到 LINE',
    copyFailed: '複製失敗，請手動選取內容複製',
    noReport: '目前還沒有可以複製的報告內容',
    photoCannotCopy: '照片無法直接複製到文字訊息，請在獸醫報告頁面截圖或列印給獸醫。',
    needCatName: '請先輸入貓咪名字',
    keepOneCat: '至少要保留一隻貓咪',
    confirmDeleteCat: '確定要刪除',
    deleteCatNote: '已保存的紀錄不會自動刪除，但畫面上不會再顯示這隻貓。',
    confirmClearToday: '確定要清除今天的紀錄嗎？',
    confirmClearMonth: '確定要清除本月定期照顧紀錄嗎？',
    photoTooMany: '照片最多只能放 3 張',
    photoLoadFail: '照片讀取失敗，請換一張照片試試',
    name: '名字',
    birthday: '生日',
    age: '年齡',
    gender: '性別',
    breed: '品種',
    neutered: '結紮狀態',
    chipNo: '晶片號碼',
    chronicNote: '慢性病 / 用藥',
    allergyNote: '過敏 / 禁忌',
    vetClinic: '常用獸醫院',
    profileNote: '其他備註',
    profilePhoto: '貓咪照片',
    selectPhoto: '選擇照片',
    yearsOld: '歲',
    unknown: '未填',
    weightTitle: '體重紀錄',
    weightDesc: '記錄每次量到的體重，線圖可以看出變胖、變瘦或老貓體重下降趨勢',
    addWeight: '新增體重',
    weightKg: '體重 kg',
    weightNote: '體重備註',
    weightPlaceholder: '例如：食慾正常、最近吃比較少、剛看完醫生',
    latestWeight: '最新體重',
    weightChange: '近期變化',
    weightRecords: '體重列表',
    weightChart: '體重線圖',
    noWeight: '目前還沒有體重紀錄',
    needWeight: '請輸入正確體重',
    deleteWeightConfirm: '確定刪除這筆體重紀錄嗎？',
    vetBasicInfo: '基本資料',
    vetWeightInfo: '體重摘要',
    vetAbnormalInfo: '異常與照片',
    vetDailyNotes: '備註 / 日常照片',
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
    weight: 'Weight',
    history: 'History',
    vet: 'Vet',
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
    vetReport: 'Vet report',
    vetReportDesc: 'Collect cat profile, weight trend, abnormal notes, photos, and daily notes for vet visits',
    copyForVet: 'Copy for vet',
    printPdf: 'Print / PDF',
    noAbnormalHistory: 'No abnormal records for this cat yet',
    photo: 'Photos',
    todayNoteTitle: 'Daily note',
    myCats: 'My cats',
    catsDesc: 'Add and switch cats. Each cat has separate records and profile details',
    catProfile: 'Cat profile',
    catProfileDesc: 'Basic info, chronic conditions, allergies, and preferred vet clinic',
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
    copied: 'Vet report copied. You can paste it to your vet or LINE.',
    copyFailed: 'Copy failed. Please select and copy manually.',
    noReport: 'No report content to copy yet',
    photoCannotCopy: 'Photos cannot be copied into plain text. Please screenshot or print the Vet report page.',
    needCatName: 'Please enter a cat name first',
    keepOneCat: 'At least one cat is required',
    confirmDeleteCat: 'Delete',
    deleteCatNote: 'Saved records will not be removed automatically, but this cat will no longer appear.',
    confirmClearToday: 'Clear today’s record?',
    confirmClearMonth: 'Clear this month’s periodic care record?',
    photoTooMany: 'You can add up to 3 photos',
    photoLoadFail: 'Photo failed to load. Please try another photo.',
    name: 'Name',
    birthday: 'Birthday',
    age: 'Age',
    gender: 'Gender',
    breed: 'Breed',
    neutered: 'Neutered',
    chipNo: 'Microchip No.',
    chronicNote: 'Chronic conditions / medication',
    allergyNote: 'Allergies / restrictions',
    vetClinic: 'Preferred vet clinic',
    profileNote: 'Other notes',
    profilePhoto: 'Cat photo',
    selectPhoto: 'Select photo',
    yearsOld: 'years old',
    unknown: 'Not set',
    weightTitle: 'Weight records',
    weightDesc: 'Track each weight entry and use the line chart to see trends',
    addWeight: 'Add weight',
    weightKg: 'Weight kg',
    weightNote: 'Weight note',
    weightPlaceholder: 'Example: Appetite normal, eating less lately, just had a vet visit',
    latestWeight: 'Latest weight',
    weightChange: 'Recent change',
    weightRecords: 'Weight list',
    weightChart: 'Weight chart',
    noWeight: 'No weight records yet',
    needWeight: 'Please enter a valid weight',
    deleteWeightConfirm: 'Delete this weight record?',
    vetBasicInfo: 'Basic info',
    vetWeightInfo: 'Weight summary',
    vetAbnormalInfo: 'Abnormal notes and photos',
    vetDailyNotes: 'Notes / daily photos',
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

function weightStorageKey(catId: string) {
  return `cat-calendar-weights-${catId}`;
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
        return parsed.map((cat) => ({
          id: typeof cat.id === 'string' ? cat.id : makeId(),
          name: typeof cat.name === 'string' ? cat.name : '我的貓咪',
          emoji: typeof cat.emoji === 'string' ? cat.emoji : '🐱',
          profilePhoto: typeof cat.profilePhoto === 'string' ? cat.profilePhoto : '',
          birthday: typeof cat.birthday === 'string' ? cat.birthday : '',
          gender: typeof cat.gender === 'string' ? cat.gender : '',
          breed: typeof cat.breed === 'string' ? cat.breed : '',
          neutered: typeof cat.neutered === 'string' ? cat.neutered : '',
          chipNo: typeof cat.chipNo === 'string' ? cat.chipNo : '',
          chronicNote: typeof cat.chronicNote === 'string' ? cat.chronicNote : '',
          allergyNote: typeof cat.allergyNote === 'string' ? cat.allergyNote : '',
          vetClinic: typeof cat.vetClinic === 'string' ? cat.vetClinic : '',
          profileNote: typeof cat.profileNote === 'string' ? cat.profileNote : '',
        }));
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

function loadWeightRecords(catId: string): WeightRecord[] {
  const saved = localStorage.getItem(weightStorageKey(catId));
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : makeId(),
        date: typeof item.date === 'string' ? item.date : todayKey(),
        weight: Number(item.weight),
        note: typeof item.note === 'string' ? item.note : '',
      }))
      .filter((item) => Number.isFinite(item.weight) && item.weight > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
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
          records.push({ date, data: JSON.parse(raw) });
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
      const dailyNote =
        typeof record.data.dailyNote === 'string' ? record.data.dailyNote.trim() : '';
      const abnormalPhotos = getPhotoList(record.data.abnormalPhotos);
      const dailyPhotos = getPhotoList(record.data.dailyPhotos);

      return {
        date: record.date,
        abnormalNote,
        abnormalPhotos,
        dailyNote,
        dailyPhotos,
      };
    })
    .filter(
      (record) =>
        record.abnormalNote.length > 0 ||
        record.abnormalPhotos.length > 0 ||
        record.dailyNote.length > 0 ||
        record.dailyPhotos.length > 0
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

function calculateAgeText(birthday: string | undefined, lang: Lang, yearsOld: string, unknown: string) {
  if (!birthday) return unknown;
  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return unknown;

  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  const dayDiff = now.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }

  const months = Math.max(
    0,
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
      now.getMonth() -
      birthDate.getMonth() -
      (dayDiff < 0 ? 1 : 0)
  );

  if (years <= 0) {
    return lang === 'zh' ? `約 ${months} 個月` : `about ${months} months`;
  }

  return lang === 'zh' ? `約 ${years} ${yearsOld}` : `about ${years} ${yearsOld}`;
}

function WeightLineChart({ records }: { records: WeightRecord[] }) {
  const points = records.slice().sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < 2) {
    return null;
  }

  const width = 320;
  const height = 180;
  const padX = 34;
  const padY = 24;
  const weights = points.map((item) => item.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight || 1;

  const coordinates = points.map((item, index) => {
    const x =
      padX +
      (index / Math.max(1, points.length - 1)) * (width - padX * 2);
    const y =
      height -
      padY -
      ((item.weight - minWeight) / range) * (height - padY * 2);
    return { x, y, item };
  });

  const path = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="overflow-hidden rounded-3xl bg-white p-4 shadow-sm">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="#e7e5e4" strokeWidth="2" />
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#e7e5e4" strokeWidth="2" />
        <text x={padX} y={18} fontSize="11" fill="#78716c">
          {maxWeight.toFixed(2)}kg
        </text>
        <text x={padX} y={height - 6} fontSize="11" fill="#78716c">
          {minWeight.toFixed(2)}kg
        </text>
        <path d={path} fill="none" stroke="#fb923c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point) => (
          <g key={point.item.id}>
            <circle cx={point.x} cy={point.y} r="5" fill="#fb923c" />
            <text x={point.x} y={point.y - 10} fontSize="10" fill="#44403c" textAnchor="middle">
              {point.item.weight.toFixed(1)}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-stone-400">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
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

  const selectedCat = cats.find((cat) => cat.id === selectedCatId) ?? cats[0];

  const [page, setPage] = useState<Page>('today');
  const [newCatName, setNewCatName] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [weightDate, setWeightDate] = useState(today);
  const [weightValue, setWeightValue] = useState('');
  const [weightNote, setWeightNote] = useState('');

  const [daily, setDaily] = useState<DailyRecord>(() =>
    loadDailyRecord(selectedCatId, today)
  );

  const [monthly, setMonthly] = useState<MonthlyRecord>(() =>
    loadMonthlyRecord(selectedCatId, month)
  );

  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>(() =>
    loadWeightRecords(selectedCatId)
  );

  const abnormalNote =
    typeof daily.abnormalNote === 'string' ? daily.abnormalNote : '';
  const dailyNote = typeof daily.dailyNote === 'string' ? daily.dailyNote : '';
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

  const reportHistory = useMemo(() => {
    historyRefreshKey;
    if (!selectedCat) return [];
    return getAbnormalHistory(selectedCat.id);
  }, [historyRefreshKey, selectedCat]);

  const abnormalOnlyHistory = useMemo(
    () =>
      reportHistory.filter(
        (record) => record.abnormalNote || record.abnormalPhotos.length > 0
      ),
    [reportHistory]
  );

  const latestWeight = weightRecords[0];
  const oldestRecentWeight = weightRecords[Math.min(weightRecords.length - 1, 4)];
  const recentWeightChange =
    latestWeight && oldestRecentWeight && latestWeight.id !== oldestRecentWeight.id
      ? latestWeight.weight - oldestRecentWeight.weight
      : 0;

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

  useEffect(() => {
    if (!selectedCat) return;
    localStorage.setItem(weightStorageKey(selectedCat.id), JSON.stringify(weightRecords));
  }, [weightRecords, selectedCat]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  const selectCat = (catId: string) => {
    setSelectedCatId(catId);
    setDaily(loadDailyRecord(catId, today));
    setMonthly(loadMonthlyRecord(catId, month));
    setWeightRecords(loadWeightRecords(catId));
    setHistoryRefreshKey((v) => v + 1);
    setPage('today');
  };

  const updateSelectedCat = (patch: Partial<Cat>) => {
    if (!selectedCat) return;
    setCats((prev) =>
      prev.map((cat) => (cat.id === selectedCat.id ? { ...cat, ...patch } : cat))
    );
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
      profilePhoto: '',
      birthday: '',
      gender: '',
      breed: '',
      neutered: '',
      chipNo: '',
      chronicNote: '',
      allergyNote: '',
      vetClinic: '',
      profileNote: '',
    };

    setCats((prev) => [...prev, newCat]);
    setNewCatName('');
    setSelectedCatId(newCat.id);
    setDaily({});
    setMonthly({});
    setWeightRecords([]);
    setHistoryRefreshKey((v) => v + 1);
    setPage('cats');
  };

  const deleteCat = (catId: string) => {
    const target = cats.find((cat) => cat.id === catId);
    if (!target) return;

    if (cats.length <= 1) {
      alert(tr.keepOneCat);
      return;
    }

    if (!confirm(`${tr.confirmDeleteCat}「${target.name}」？\n${tr.deleteCatNote}`)) {
      return;
    }

    const nextCats = cats.filter((cat) => cat.id !== catId);
    const nextSelected = selectedCatId === catId ? nextCats[0] : selectedCat;

    setCats(nextCats);

    if (nextSelected) {
      setSelectedCatId(nextSelected.id);
      setDaily(loadDailyRecord(nextSelected.id, today));
      setMonthly(loadMonthlyRecord(nextSelected.id, month));
      setWeightRecords(loadWeightRecords(nextSelected.id));
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
        [key]: [...getPhotoList(prev[key]), ...compressedPhotos].slice(0, MAX_PHOTOS),
      }));
    } catch {
      alert(tr.photoLoadFail);
    }
  };

  const updateProfilePhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    try {
      const photo = await compressImage(file);
      updateSelectedCat({ profilePhoto: photo });
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
      return { ...prev, [key]: nextPhotos };
    });
  };

  const addWeightRecord = () => {
    const value = Number(weightValue);

    if (!Number.isFinite(value) || value <= 0) {
      alert(tr.needWeight);
      return;
    }

    const nextRecord: WeightRecord = {
      id: makeId(),
      date: weightDate || today,
      weight: Math.round(value * 100) / 100,
      note: weightNote.trim(),
    };

    setWeightRecords((prev) =>
      [nextRecord, ...prev].sort((a, b) => b.date.localeCompare(a.date))
    );
    setWeightValue('');
    setWeightNote('');
  };

  const deleteWeightRecord = (id: string) => {
    if (!confirm(tr.deleteWeightConfirm)) return;
    setWeightRecords((prev) => prev.filter((record) => record.id !== id));
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

  const copyVetReport = async () => {
    if (!selectedCat) return;

    const hasProfile = Boolean(
      selectedCat.name || selectedCat.birthday || selectedCat.breed || selectedCat.chronicNote
    );
    const hasReport = hasProfile || weightRecords.length > 0 || reportHistory.length > 0;

    if (!hasReport) {
      alert(tr.noReport);
      return;
    }

    const ageText = calculateAgeText(selectedCat.birthday, lang, tr.yearsOld, tr.unknown);
    const weightLines = weightRecords.slice(0, 10).map((record) => {
      const noteText = record.note ? `｜${record.note}` : '';
      return `${record.date}：${record.weight} kg${noteText}`;
    });

    const abnormalLines = reportHistory.slice(0, 20).map((record) => {
      const abnormalText = record.abnormalNote || '-';
      const dailyText = record.dailyNote ? `\n${tr.todayNoteTitle}：${record.dailyNote}` : '';
      const photoCount = record.abnormalPhotos.length + record.dailyPhotos.length;
      const photoText = photoCount > 0 ? `\n${tr.photo}：${photoCount}` : '';
      return `【${record.date}】\n${abnormalText}${dailyText}${photoText}`;
    });

    const report = [
      `${lang === 'zh' ? '貓咪' : 'Cat'}：${selectedCat.name}`,
      `${tr.date}：${today}`,
      '',
      `【${tr.vetBasicInfo}】`,
      `${tr.age}：${ageText}`,
      `${tr.birthday}：${selectedCat.birthday || tr.unknown}`,
      `${tr.gender}：${selectedCat.gender || tr.unknown}`,
      `${tr.breed}：${selectedCat.breed || tr.unknown}`,
      `${tr.neutered}：${selectedCat.neutered || tr.unknown}`,
      `${tr.chipNo}：${selectedCat.chipNo || tr.unknown}`,
      `${tr.chronicNote}：${selectedCat.chronicNote || tr.unknown}`,
      `${tr.allergyNote}：${selectedCat.allergyNote || tr.unknown}`,
      `${tr.vetClinic}：${selectedCat.vetClinic || tr.unknown}`,
      `${tr.profileNote}：${selectedCat.profileNote || tr.unknown}`,
      '',
      `【${tr.vetWeightInfo}】`,
      latestWeight ? `${tr.latestWeight}：${latestWeight.weight} kg（${latestWeight.date}）` : tr.noWeight,
      weightLines.length > 0 ? weightLines.join('\n') : '',
      '',
      `【${tr.vetAbnormalInfo}】`,
      abnormalLines.length > 0 ? abnormalLines.join('\n\n') : tr.noAbnormalHistory,
      '',
      tr.photoCannotCopy,
    ].join('\n');

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
            <div key={`${keyName}-${index}`} className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm">
              <button type="button" onClick={() => setSelectedPhoto(photo)} className="block aspect-square w-full overflow-hidden">
                <img src={photo} alt={`${title} ${index + 1}`} className="h-full w-full object-cover" />
              </button>

              <button type="button" onClick={() => removePhoto(keyName, index)} className="w-full bg-white px-2 py-2 text-xs font-bold text-stone-500">
                {tr.removePhoto}
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <label className={`flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center text-sm font-bold ${buttonClass}`}>
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
        <div className="flex min-w-0 items-center gap-3">
          {selectedCat?.profilePhoto ? (
            <button onClick={() => setSelectedPhoto(selectedCat.profilePhoto ?? null)} className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-orange-50">
              <img src={selectedCat.profilePhoto} alt={selectedCat.name} className="h-full w-full object-cover" />
            </button>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-3xl">
              {selectedCat?.emoji ?? '🐱'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-400">{tr.currentCat}</p>
            <h2 className="truncate text-xl font-bold">{selectedCat?.name ?? '我的貓咪'}</h2>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button onClick={toggleLanguage} className="rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-stone-700">
            {tr.langButton}
          </button>

          <button onClick={() => setPage('cats')} className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">
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
              selectedCat?.id === cat.id ? 'bg-orange-400 text-white' : 'bg-stone-100 text-stone-600'
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
        <p className="mt-1 text-sm font-medium text-orange-600">{tr.appSubtitle}</p>
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
            <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${dailyPercent}%` }} />
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
                daily[item.id] === true ? 'border-green-200 bg-green-50' : 'border-stone-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <span className="font-medium">{tr[item.labelKey as keyof typeof tr]}</span>
              </div>
              <span className="text-2xl">{daily[item.id] === true ? '✅' : '⬜'}</span>
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
          <p className="mt-2 text-sm font-medium text-red-600">{tr.abnormalSaved}</p>
        ) : (
          <p className="mt-2 text-sm text-stone-400">{tr.noAbnormal}</p>
        )}

        {renderPhotoSection(tr.abnormalPhotos, tr.abnormalPhotosDesc, abnormalPhotos, 'abnormalPhotos', 'red')}
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

        {renderPhotoSection(tr.dailyPhotos, tr.dailyPhotosDesc, dailyPhotos, 'dailyPhotos', 'orange')}
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
                monthly[item.id] ? 'border-blue-200 bg-blue-50' : 'border-stone-100 bg-stone-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <span className="font-medium">{tr[item.labelKey as keyof typeof tr]}</span>
              </div>
              <span className="text-2xl">{monthly[item.id] ? '✅' : '⬜'}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>{tr.monthlyProgress}</span>
            <span>{monthlyPercent}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-blue-100">
            <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${monthlyPercent}%` }} />
          </div>
        </div>

        <button onClick={resetMonth} className="mt-4 w-full rounded-2xl border border-stone-200 bg-white py-3 font-bold text-stone-600">
          {tr.clearMonth}
        </button>
      </section>

      <button onClick={resetToday} className="mb-6 w-full rounded-2xl bg-stone-800 py-4 font-bold text-white shadow-sm">
        {tr.clearToday}
      </button>
    </>
  );

  const renderWeightPage = () => (
    <>
      {renderCatSwitcher()}

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl">⚖️</div>
        <h1 className="mt-2 text-2xl font-bold">{tr.weightTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">{tr.weightDesc}</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-stone-400">{tr.latestWeight}</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">
            {latestWeight ? `${latestWeight.weight} kg` : '--'}
          </p>
          {latestWeight && <p className="mt-1 text-xs text-stone-400">{latestWeight.date}</p>}
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-stone-400">{tr.weightChange}</p>
          <p className={`mt-1 text-2xl font-bold ${recentWeightChange > 0 ? 'text-red-500' : recentWeightChange < 0 ? 'text-blue-500' : 'text-stone-500'}`}>
            {weightRecords.length >= 2 ? `${recentWeightChange > 0 ? '+' : ''}${recentWeightChange.toFixed(2)} kg` : '--'}
          </p>
          <p className="mt-1 text-xs text-stone-400">{weightRecords.length >= 2 ? 'latest vs recent' : tr.noWeight}</p>
        </div>
      </div>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">{tr.addWeight}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-stone-500">{tr.date}</label>
            <input type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value)} className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-orange-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-stone-500">{tr.weightKg}</label>
            <input type="number" inputMode="decimal" value={weightValue} onChange={(e) => setWeightValue(e.target.value)} placeholder="4.8" className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-orange-300" />
          </div>
        </div>
        <textarea value={weightNote} onChange={(e) => setWeightNote(e.target.value)} placeholder={tr.weightPlaceholder} className="mt-3 min-h-20 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm outline-none focus:border-orange-300" />
        <button onClick={addWeightRecord} className="mt-3 w-full rounded-2xl bg-orange-400 py-3 font-bold text-white shadow-sm">
          {tr.addWeight}
        </button>
      </section>

      <section className="mb-5">
        <div className="mb-3">
          <h2 className="text-lg font-bold">{tr.weightChart}</h2>
        </div>
        {weightRecords.length >= 2 ? (
          <WeightLineChart records={weightRecords} />
        ) : (
          <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">{tr.noWeight}</div>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-lg font-bold">{tr.weightRecords}</h2>
        {weightRecords.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">{tr.noWeight}</div>
        ) : (
          <div className="space-y-3">
            {weightRecords.map((record) => (
              <div key={record.id} className="rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-orange-700">{record.weight} kg</h3>
                    <p className="text-sm text-stone-500">{record.date}</p>
                    {record.note && <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{record.note}</p>}
                  </div>
                  <button onClick={() => deleteWeightRecord(record.id)} className="rounded-full bg-stone-100 px-3 py-2 text-sm font-bold text-stone-500">
                    {tr.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
        <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">{tr.noHistory}</div>
      ) : (
        <div className="space-y-4">
          {history.map((record) => {
            const done = dailyItems.filter((item) => record.data[item.id] === true).length;
            const percent = Math.round((done / dailyItems.length) * 100);
            const recordAbnormalNote = typeof record.data.abnormalNote === 'string' ? record.data.abnormalNote : '';
            const recordDailyNote = typeof record.data.dailyNote === 'string' ? record.data.dailyNote : '';
            const recordAbnormalPhotos = getPhotoList(record.data.abnormalPhotos);
            const recordDailyPhotos = getPhotoList(record.data.dailyPhotos);

            return (
              <div key={record.date} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{record.date}</h2>
                    <p className="text-sm text-stone-500">
                      {tr.completed} {done}/{dailyItems.length}（{percent}%）
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">{percent}%</span>
                </div>

                <div className="mb-4 h-3 overflow-hidden rounded-full bg-orange-100">
                  <div className="h-full rounded-full bg-orange-400" style={{ width: `${percent}%` }} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {dailyItems.map((item) => (
                    <div key={item.id} className={`rounded-2xl px-3 py-2 ${record.data[item.id] === true ? 'bg-green-50 text-green-700' : 'bg-stone-50 text-stone-400'}`}>
                      <span className="mr-1">{item.emoji}</span>
                      {tr[item.labelKey as keyof typeof tr]}
                      <span className="ml-1">{record.data[item.id] === true ? '✅' : '—'}</span>
                    </div>
                  ))}
                </div>

                {recordAbnormalNote.trim() && (
                  <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                    <div className="mb-1 font-bold">⚠️ {tr.abnormalRecord}</div>
                    <p className="whitespace-pre-wrap">{recordAbnormalNote}</p>
                  </div>
                )}

                {recordAbnormalPhotos.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-2 text-sm font-bold text-red-700">{tr.abnormalPhotos}</div>
                    <div className="grid grid-cols-3 gap-3">
                      {recordAbnormalPhotos.map((photo, index) => (
                        <button key={`history-abnormal-${record.date}-${index}`} onClick={() => setSelectedPhoto(photo)} className="aspect-square overflow-hidden rounded-2xl bg-red-50">
                          <img src={photo} alt={`${tr.abnormalPhotos} ${index + 1}`} className="h-full w-full object-cover" />
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
                    <div className="mb-2 text-sm font-bold text-stone-700">{tr.dailyPhotos}</div>
                    <div className="grid grid-cols-3 gap-3">
                      {recordDailyPhotos.map((photo, index) => (
                        <button key={`history-daily-${record.date}-${index}`} onClick={() => setSelectedPhoto(photo)} className="aspect-square overflow-hidden rounded-2xl bg-stone-50">
                          <img src={photo} alt={`${tr.dailyPhotos} ${index + 1}`} className="h-full w-full object-cover" />
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

  const renderVetPage = () => (
    <>
      {renderCatSwitcher()}

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl">🏥</div>
        <h1 className="mt-2 text-2xl font-bold">{tr.vetReport}</h1>
        <p className="mt-1 text-sm text-stone-500">{tr.vetReportDesc}</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <button onClick={copyVetReport} className="rounded-2xl bg-orange-400 py-4 font-bold text-white shadow-sm">
          {tr.copyForVet}
        </button>
        <button onClick={() => window.print()} className="rounded-2xl bg-stone-800 py-4 font-bold text-white shadow-sm">
          {tr.printPdf}
        </button>
      </div>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">{tr.vetBasicInfo}</h2>
        <div className="space-y-2 text-sm text-stone-700">
          <p><b>{tr.name}：</b>{selectedCat?.name || tr.unknown}</p>
          <p><b>{tr.age}：</b>{calculateAgeText(selectedCat?.birthday, lang, tr.yearsOld, tr.unknown)}</p>
          <p><b>{tr.birthday}：</b>{selectedCat?.birthday || tr.unknown}</p>
          <p><b>{tr.gender}：</b>{selectedCat?.gender || tr.unknown}</p>
          <p><b>{tr.breed}：</b>{selectedCat?.breed || tr.unknown}</p>
          <p><b>{tr.neutered}：</b>{selectedCat?.neutered || tr.unknown}</p>
          <p><b>{tr.chipNo}：</b>{selectedCat?.chipNo || tr.unknown}</p>
          <p><b>{tr.chronicNote}：</b>{selectedCat?.chronicNote || tr.unknown}</p>
          <p><b>{tr.allergyNote}：</b>{selectedCat?.allergyNote || tr.unknown}</p>
          <p><b>{tr.vetClinic}：</b>{selectedCat?.vetClinic || tr.unknown}</p>
          <p><b>{tr.profileNote}：</b>{selectedCat?.profileNote || tr.unknown}</p>
        </div>
      </section>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">{tr.vetWeightInfo}</h2>
        {latestWeight ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-orange-50 p-4">
                <p className="text-xs font-bold text-orange-700">{tr.latestWeight}</p>
                <p className="mt-1 text-2xl font-bold text-orange-700">{latestWeight.weight} kg</p>
                <p className="mt-1 text-xs text-stone-500">{latestWeight.date}</p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <p className="text-xs font-bold text-stone-500">{tr.weightChange}</p>
                <p className="mt-1 text-2xl font-bold text-stone-700">
                  {weightRecords.length >= 2 ? `${recentWeightChange > 0 ? '+' : ''}${recentWeightChange.toFixed(2)} kg` : '--'}
                </p>
              </div>
            </div>
            {weightRecords.length >= 2 && <WeightLineChart records={weightRecords} />}
          </>
        ) : (
          <p className="text-sm text-stone-500">{tr.noWeight}</p>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-lg font-bold">{tr.vetAbnormalInfo}</h2>
        {abnormalOnlyHistory.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">{tr.noAbnormalHistory}</div>
        ) : (
          <div className="space-y-4">
            {abnormalOnlyHistory.map((record) => (
              <div key={record.date} className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-red-700">{record.date}</h3>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-600">{tr.vet}</span>
                </div>
                {record.abnormalNote && <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">{record.abnormalNote}</p>}
                {record.abnormalPhotos.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {record.abnormalPhotos.map((photo, index) => (
                      <button key={`vet-abnormal-${record.date}-${index}`} onClick={() => setSelectedPhoto(photo)} className="aspect-square overflow-hidden rounded-2xl bg-red-50">
                        <img src={photo} alt={`${tr.abnormalPhotos} ${index + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-lg font-bold">{tr.vetDailyNotes}</h2>
        {reportHistory.filter((record) => record.dailyNote || record.dailyPhotos.length > 0).length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">{tr.noHistory}</div>
        ) : (
          <div className="space-y-4">
            {reportHistory
              .filter((record) => record.dailyNote || record.dailyPhotos.length > 0)
              .map((record) => (
                <div key={`vet-note-${record.date}`} className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="mb-2 text-lg font-bold">{record.date}</h3>
                  {record.dailyNote && <p className="whitespace-pre-wrap text-sm text-stone-700">{record.dailyNote}</p>}
                  {record.dailyPhotos.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {record.dailyPhotos.map((photo, index) => (
                        <button key={`vet-daily-${record.date}-${index}`} onClick={() => setSelectedPhoto(photo)} className="aspect-square overflow-hidden rounded-2xl bg-stone-50">
                          <img src={photo} alt={`${tr.dailyPhotos} ${index + 1}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>
    </>
  );

  const renderProfileInput = (
    label: string,
    value: string | undefined,
    keyName: keyof Cat,
    placeholder = ''
  ) => (
    <div>
      <label className="mb-1 block text-xs font-bold text-stone-500">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => updateSelectedCat({ [keyName]: e.target.value })}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-orange-300"
      />
    </div>
  );

  const renderProfileTextarea = (
    label: string,
    value: string | undefined,
    keyName: keyof Cat,
    placeholder = ''
  ) => (
    <div>
      <label className="mb-1 block text-xs font-bold text-stone-500">{label}</label>
      <textarea
        value={value ?? ''}
        onChange={(e) => updateSelectedCat({ [keyName]: e.target.value })}
        placeholder={placeholder}
        className="min-h-20 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm outline-none focus:border-orange-300"
      />
    </div>
  );

  const renderCatsPage = () => (
    <>
      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-4xl">🐱</div>
        <h1 className="mt-2 text-2xl font-bold">{tr.myCats}</h1>
        <p className="mt-1 text-sm text-stone-500">{tr.catsDesc}</p>
      </div>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">{tr.catProfile}</h2>
        <p className="mb-4 text-sm text-stone-500">{tr.catProfileDesc}</p>

        <div className="mb-5 flex items-center gap-4">
          <div className="h-24 w-24 overflow-hidden rounded-3xl bg-orange-50">
            {selectedCat?.profilePhoto ? (
              <button onClick={() => setSelectedPhoto(selectedCat.profilePhoto ?? null)} className="h-full w-full">
                <img src={selectedCat.profilePhoto} alt={selectedCat.name} className="h-full w-full object-cover" />
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl">🐱</div>
            )}
          </div>
          <div className="flex-1">
            <p className="mb-2 text-xs font-bold text-stone-500">{tr.profilePhoto}</p>
            <label className="inline-block cursor-pointer rounded-2xl bg-orange-100 px-4 py-3 text-sm font-bold text-orange-700">
              {tr.selectPhoto}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  updateProfilePhoto(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          {renderProfileInput(tr.name, selectedCat?.name, 'name', tr.catNamePlaceholder)}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-stone-500">{tr.birthday}</label>
              <input type="date" value={selectedCat?.birthday ?? ''} onChange={(e) => updateSelectedCat({ birthday: e.target.value })} className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-orange-300" />
            </div>
            {renderProfileInput(tr.gender, selectedCat?.gender, 'gender', lang === 'zh' ? '公 / 母' : 'Male / Female')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderProfileInput(tr.breed, selectedCat?.breed, 'breed', lang === 'zh' ? '米克斯 / 英短' : 'Mix / British Shorthair')}
            {renderProfileInput(tr.neutered, selectedCat?.neutered, 'neutered', lang === 'zh' ? '已結紮 / 未結紮' : 'Yes / No')}
          </div>
          {renderProfileInput(tr.chipNo, selectedCat?.chipNo, 'chipNo')}
          {renderProfileTextarea(tr.chronicNote, selectedCat?.chronicNote, 'chronicNote', lang === 'zh' ? '例如：腎臟病、心臟病、長期用藥' : 'Example: kidney disease, heart disease, medication')}
          {renderProfileTextarea(tr.allergyNote, selectedCat?.allergyNote, 'allergyNote')}
          {renderProfileInput(tr.vetClinic, selectedCat?.vetClinic, 'vetClinic')}
          {renderProfileTextarea(tr.profileNote, selectedCat?.profileNote, 'profileNote')}
        </div>
      </section>

      <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">{tr.addCat}</h2>
        <div className="flex gap-2">
          <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder={tr.catNamePlaceholder} className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-orange-300" />
          <button onClick={addCat} className="rounded-2xl bg-orange-400 px-5 py-3 font-bold text-white">
            {tr.add}
          </button>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-lg font-bold">{tr.catList}</h2>
        <div className="space-y-3">
          {cats.map((cat) => (
            <div key={cat.id} className={`rounded-3xl border p-4 shadow-sm ${selectedCat?.id === cat.id ? 'border-orange-200 bg-orange-50' : 'border-stone-100 bg-white'}`}>
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => selectCat(cat.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {cat.profilePhoto ? (
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-orange-50">
                      <img src={cat.profilePhoto} alt={cat.name} className="h-full w-full object-cover" />
                    </span>
                  ) : (
                    <span className="text-3xl">{cat.emoji}</span>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{cat.name}</h3>
                    <p className="text-sm text-stone-500">{selectedCat?.id === cat.id ? tr.selected : tr.tapToSwitch}</p>
                  </div>
                </button>

                <button onClick={() => deleteCat(cat.id)} className="rounded-full bg-stone-100 px-3 py-2 text-sm font-bold text-stone-500">
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
        <div className="mb-5 grid grid-cols-5 gap-2 rounded-3xl bg-white p-2 shadow-sm">
          <button onClick={() => setPage('today')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'today' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
            {tr.today}
          </button>
          <button onClick={() => setPage('weight')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'weight' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
            {tr.weight}
          </button>
          <button onClick={() => setPage('vet')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'vet' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
            {tr.vet}
          </button>
          <button onClick={() => setPage('history')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'history' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
            {tr.history}
          </button>
          <button onClick={() => setPage('cats')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'cats' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
            {tr.cats}
          </button>
        </div>

        {page === 'today' && renderTodayPage()}
        {page === 'weight' && renderWeightPage()}
        {page === 'vet' && renderVetPage()}
        {page === 'history' && renderHistoryPage()}
        {page === 'cats' && renderCatsPage()}

        <p className="mt-6 text-center text-xs text-stone-400">{tr.savedLocal}</p>
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-full max-w-full">
            <img src={selectedPhoto} alt="preview" className="max-h-[80vh] max-w-full rounded-3xl object-contain" />
            <button onClick={() => setSelectedPhoto(null)} className="mt-4 w-full rounded-2xl bg-white py-3 font-bold text-stone-800">
              {tr.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
