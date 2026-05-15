import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AssistantContext,
  type AssistantCareBundleJson,
  buildSevenDayAnalysis,
} from './aiCareAssistant';
import { buildLocalAiQuota, getOrCreateClientId, getAiPlan, setAiPlan } from './aiClient';
import {
  AssistantApiError,
  type AssistantHealthPayload,
  buildAssistantHealthFromLocal,
  fetchAssistantHealth,
  generateAssistantCareBundleOpenAi,
  generateAssistantQaOpenAi,
  getCareBundleContextHash,
  isAssistantCareBundleNetworkBlocked,
  isAssistantDailyQuotaExhausted,
  mergeAssistantQuotaFromSnapshot,
  peekCareBundleCache,
} from './openaiAssistant';
import {
  createDefaultSharedCareState,
  defaultOwnerName,
  DEMO_MEMBER_NAME,
  generateInviteCode,
  getCareDisplayName,
  loadSharedCareMock,
  makeActivityId,
  nowTimeLabel,
  saveSharedCareMock,
  setCareDisplayName,
  type SharedCareCatState,
} from './sharedCareMock';
import { useSupabaseAuth } from './useSupabaseAuth';
import {
  deleteCatForOwner,
  fetchCatsForUser,
  insertCatForOwner,
  isCloudCatId,
  mergeCloudCatsWithLocal,
  updateCatForOwner,
} from './supabaseCats';
import type { CareEventRow } from './supabaseDaily';
import {
  careEventCreatedOnLocalDate,
  fetchCareEventsForCat,
  fetchDailyRecordRow,
  formatCareEventTimeLabel,
  insertCareEventRow,
  mergeCloudDailyPreferCloud,
  stripPhotoFieldsFromDaily,
  upsertDailyRecordCloud,
  type DailyJson,
} from './supabaseDaily';

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
type Page = 'today' | 'weight' | 'vet' | 'history' | 'cats' | 'assistant' | 'settings' | 'sharedCare';
type AppPlan = 'free' | 'pro';

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
    historyOrderNote: '排序：最新日期在最上方；可用下方快速跳轉，不必一直往下滑。',
    historyJumpLabel: '快速跳轉到日期',
    historyJumpGo: '前往',
    historyPickDateFirst: '請先選擇日期',
    historyJumpNoMatch: '找不到此日期的紀錄',
    historyBackLatest: '回到最新',
    historyRoadmap: '快速跳轉仍可使用。進階篩選與搜尋見下方（Pro 功能規劃中）。',
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
    backupTitle: '備份 / 匯出資料',
    backupDesc: '匯出目前所有貓咪、每日紀錄、體重、照片與設定。資料會下載成 JSON 檔，換手機或清除瀏覽器前建議先備份。',
    exportBackup: '匯出備份',
    importBackup: '匯入備份',
    importBackupDesc: '匯入之前下載的 JSON 備份檔，會覆蓋目前瀏覽器中的貓咪日記資料。',
    exportDone: '備份檔已下載',
    importDone: '備份已匯入，頁面將重新整理',
    importFailed: '匯入失敗，請確認檔案是貓咪日記匯出的 JSON 備份',
    privacyTitle: '隱私政策',
    privacyDesc: '目前版本不需要登入，資料主要保存在你的手機 / 電腦瀏覽器內，不會主動上傳到伺服器。',
    privacyPoint1: '我們不會要求你填寫真實姓名、電話或地址。',
    privacyPoint2: '貓咪資料、體重、異常紀錄、備註與照片會保存在本機瀏覽器。',
    privacyPoint3: '如果你清除瀏覽器資料、換手機或更換瀏覽器，紀錄可能會消失，請先使用備份匯出。',
    privacyPoint4: '列印、截圖、複製獸醫報告或備份檔分享出去後，請自行注意照片與健康紀錄隱私。',
    copyPrivacy: '複製隱私政策',
    privacyCopied: '隱私政策已複製',
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
    assistantNav: '照護',
    assistantTitle: 'AI 照護助理',
    assistantLead: '依紀錄整理趨勢與提醒；僅供參考，不能取代獸醫。',
    assistantToday: '健康小結',
    assistantSeven: '照護感想',
    assistantVetAi: '給獸醫的重點',
    assistantAsk: '隨口問問',
    assistantAskHint: '我會依你存的紀錄陪聊力所能及的小問題，無法代替看診。',
    assistantAskPlaceholder: '例如：這週喝水感覺怎樣？體重需要多留意嗎？',
    assistantSend: '送出',
    assistantReplyLabel: '回覆',
    aiChecking: '稍等一下…',
    assistantLocalSevenTitle: '最近 7 天摘要',
    assistantSevenExpandMore: '展開更多 ↓',
    assistantSevenCollapse: '收合 ↑',
    assistantAnalysisCardTitle: '照護分析',
    aiGenerateWeek: '生成 AI 照護分析',
    aiAnalysisCardSubtitle: '分析最近 7 天紀錄並產生觀察與提醒。',
    aiBundleCurrentHint: '已使用今日分析，可直接查看結果',
    aiDataStaleHint: '資料已更新，可重新生成分析',
    aiNeedServerEnvDev: '小幫手暫時醒不過來，請確認本機環境已依說明啟動後重新整理。',
    aiNeedServerEnvProd: '小幫手暫時無法使用，請稍後再試；若剛完成設定，請稍待部署完成。',
    aiAssistantUnreachableDev: '目前連不上服務，請確認開發環境已啟動後重新整理。',
    aiAssistantUnreachableProd: '目前連不上服務，請稍後再試或重新整理頁面。',
    aiEmptyHint: '尚未生成分析，點下方按鈕即可開始。',
    aiAskEmpty: '先寫下想問的內容好嗎？',
    aiOpenAiBusy: '正在整理…',
    aiOpenAiFail: '這次沒成功：',
    assistantSendBusy: '處理中…',
    aiQuotaLine: '今天剩餘 AI 次數：{{remaining}} / {{limit}}',
    aiQuotaExhaustedTitle: '今日 AI 次數已用完',
    aiQuotaExhaustedUpgradeFree: '升級 Pro 可獲得更多 AI 次數',
    settingsTitle: '方案與設定',
    settingsBack: '返回貓咪',
    authAccountSection: '帳號與登入（Supabase）',
    authNotConfigured:
      '尚未設定雲端帳號：請在 `.env` 或部署環境加入 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY，並在 Supabase 執行 `supabase/migrations` 內的 SQL，然後重新啟動前端。',
    authLoggedInStrip: '已登入',
    authOpenSettingsToSignIn: '到「方案與設定」可註冊或登入。',
    authCurrentAccount: '目前帳號',
    authSignOut: '登出',
    authEmail: '電子郵件',
    authPassword: '密碼',
    authDisplayNameOptional: '顯示名稱（選填，僅註冊）',
    authSignIn: '登入',
    authSignUp: '註冊新帳號',
    authSwitchToSignUp: '還沒帳號？改為註冊',
    authSwitchToSignIn: '已有帳號？改為登入',
    authProcessing: '處理中…',
    authErrNotConfigured: '尚未連線 Supabase。',
    authErrInvalid: '帳號或密碼不正確。',
    authErrEmailNotConfirmed: '請先到信箱完成驗證，再登入。',
    authErrAlreadyReg: '此信箱已註冊，請改為登入。',
    authErrWeak: '密碼不符合要求，請改用更長或更複雜的密碼。',
    authErrGeneric: '發生錯誤：',
    authErrMissingFields: '請輸入電子郵件與密碼。',
    authSignUpSent: '若註冊成功，請檢查信箱（含垃圾信）並完成驗證後再登入。',
    authSignedInOk: '登入成功。',
    authSignedOutOk: '已登出。',
    authLocalDataHint: '貓咪與每日紀錄仍儲存在本機，尚未上傳至雲端（下一階段開放）。',
    catsCloudLoading: '正在同步雲端貓咪…',
    catsCloudLoadErr: '雲端貓咪載入失敗：',
    catsCloudSaveErr: '無法寫入雲端：',
    catsCloudDeleteErr: '無法從雲端刪除：',
    careEventDailyUpdated: '更新了今日照護紀錄',
    settingsPlanSection: '訂閱方案（測試）',
    settingsPlanCurrent: '目前方案',
    settingsPlanFree: '免費版',
    settingsPlanProTest: 'Pro 測試版',
    settingsPlanHint: '此處僅供開發測試，不會連結 App Store 或刷卡付款。',
    settingsSwitchPro: '切換成 Pro 測試版',
    settingsSwitchFree: '切回免費版',
    settingsPlanServerHint:
      '若切換為 Pro 後 AI 每日上限仍顯示 3 次，請在助理伺服器設定 AI_TRUST_CLIENT_PLAN=1（測試用），或將裝置 ID 加入 AI_PRO_CLIENT_IDS。',
    settingsPaymentNote: '目前未串接金流，不會實際收費。',
    settingsClientIdCaption: '本裝置 ID（加入伺服器 AI_PRO_CLIENT_IDS 時使用）',
    planMultiCatUpgrade: '多貓照護是 Pro 功能。升級後可管理多隻貓咪，並獲得更多 AI 分析次數。',
    planFreeMultiCatBanner: '免費版僅支援 1 隻貓。你目前有超過 1 隻貓咪，請刪減貓咪或切換至 Pro 測試版。',
    openSettings: '方案與設定',
    sharedCareTitle: '共同照護',
    sharedCareNavHint: '與家人／室友共享同一隻貓的紀錄（示範流程）',
    sharedCareBack: '返回',
    sharedCareDemoBanner:
      '示範模式：尚未連接雲端。邀請碼與成員僅存在此瀏覽器，重新整理後仍會保留（同一分頁工作階段內）。正式版將使用 Supabase 同步。',
    sharedCareMembersTitle: '共享成員',
    sharedCareRoleOwner: '主人',
    sharedCareRoleMember: '成員',
    sharedCareInviteSection: '邀請',
    sharedCareGenerateInvite: '產生邀請碼',
    sharedCareInviteCodeLabel: '邀請碼',
    sharedCareCopyCode: '複製邀請碼',
    sharedCareCopyLink: '複製邀請連結',
    sharedCareCopied: '已複製',
    sharedCareCopyFail: '無法自動複製，請手動選取邀請碼或連結。',
    sharedCareJoinSection: '使用邀請碼加入',
    sharedCareJoinPlaceholder: '輸入邀請碼，例如 ABC123',
    sharedCareJoinSubmit: '加入',
    sharedCareJoinOk: '已加入（示範）',
    sharedCareJoinNeedCode: '請先由主人產生邀請碼。',
    sharedCareJoinWrong: '邀請碼不正確或已失效（示範）。',
    sharedCareJoinDuplicate: '你已經在成員列表中。',
    sharedCareActivityTitle: '最近動態',
    sharedCareActivityEmpty: '尚無動態。產生邀請碼或加入後會顯示在此。',
    sharedCareActivityGenerated: '產生了新的邀請碼',
    sharedCareActivityJoined: '透過邀請碼加入',
    sharedCareDisplayNameHint: '在共同照護頁顯示的名稱（儲存在本機）',
    sharedCareDisplayNameLabel: '我的稱呼',
    sharedCareSaveName: '儲存',
    sharedCareTodayFeedTitle: '今日照護動態',
    sharedCareTodayFeedDemo: '以下為示範文案；連接雲端後會顯示真實紀錄。',
    sharedCareDemoLine1: 'Wayne 於 21:30 記錄了晚餐',
    sharedCareDemoLine2: 'Amy 上傳了異常照片',
    proTeaserHistorySearch: '歷史篩選與搜尋',
    proTeaserComing: '即將推出',
    proTeaserAdvancedWeekly: '進階 AI 週報',
    proTeaserRoadmap: 'Pro 功能規劃中',
    proTeaserAdvancedVet: '進階獸醫報告',
    aiErrRate: '問得太快啦，休息一下再試。',
    aiAssistantApiErrorPrefix: 'AI 服務錯誤：',
    aiDisclaimerFoot:
      'AI 僅提供照護觀察與提醒，\n不能作為診斷或治療依據。\n如症狀持續或惡化，請諮詢獸醫。',
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
    historyOrderNote: 'Newest dates appear first. Use jump-to-date below to avoid endless scrolling.',
    historyJumpLabel: 'Jump to date',
    historyJumpGo: 'Go',
    historyPickDateFirst: 'Pick a date first',
    historyJumpNoMatch: 'No saved record for that date',
    historyBackLatest: 'Back to latest',
    historyRoadmap: 'Jump-to-date still works. Advanced filter & search is planned for Pro — see below.',
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
    backupTitle: 'Backup / Export data',
    backupDesc: 'Export all cats, daily records, weights, photos, and settings as a JSON file. Please back up before switching phones or clearing browser data.',
    exportBackup: 'Export backup',
    importBackup: 'Import backup',
    importBackupDesc: 'Import a JSON backup file downloaded from Cat Diary. This will overwrite current Cat Diary data in this browser.',
    exportDone: 'Backup file downloaded',
    importDone: 'Backup imported. The page will reload.',
    importFailed: 'Import failed. Please choose a valid Cat Diary JSON backup file.',
    privacyTitle: 'Privacy policy',
    privacyDesc: 'This version does not require login. Records are mainly saved in your phone / computer browser and are not actively uploaded to a server.',
    privacyPoint1: 'We do not ask for your real name, phone number, or address.',
    privacyPoint2: 'Cat profile, weight, abnormal notes, daily notes, and photos are saved in this local browser.',
    privacyPoint3: 'If you clear browser data, switch phones, or change browsers, records may be lost. Please export a backup first.',
    privacyPoint4: 'After you print, screenshot, copy a vet report, or share a backup file, please manage the privacy of photos and health records yourself.',
    copyPrivacy: 'Copy privacy policy',
    privacyCopied: 'Privacy policy copied',
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
    assistantNav: 'Care',
    assistantTitle: 'AI Care Assistant',
    assistantLead: 'Trends from your logs; reference only—not vet advice.',
    assistantToday: 'Health snapshot',
    assistantSeven: 'Care notes',
    assistantVetAi: 'For your vet',
    assistantAsk: 'Ask a small question',
    assistantAskHint: 'I answer from what you have saved — not a substitute for an exam.',
    assistantAskPlaceholder: 'Example: How did hydration feel this week?',
    assistantSend: 'Send',
    assistantReplyLabel: 'Reply',
    aiChecking: 'One moment…',
    assistantLocalSevenTitle: 'Last 7 days summary',
    assistantSevenExpandMore: 'Show more ↓',
    assistantSevenCollapse: 'Show less ↑',
    assistantAnalysisCardTitle: 'Care analysis',
    aiGenerateWeek: 'Generate AI care analysis',
    aiAnalysisCardSubtitle: 'Looks at the last week of logs and turns them into observations and reminders.',
    aiBundleCurrentHint: 'You already have today’s analysis — scroll down to read it.',
    aiDataStaleHint: 'Your logs changed — you can generate a fresh analysis.',
    aiNeedServerEnvDev: 'The companion is waking up — please start your local setup, then refresh.',
    aiNeedServerEnvProd: 'The companion is unavailable right now — try again shortly after setup finishes.',
    aiAssistantUnreachableDev: 'We could not reach the service — start your local environment and refresh.',
    aiAssistantUnreachableProd: 'We could not reach the service — please try again in a little while.',
    aiEmptyHint: 'No analysis yet — tap the button below to begin.',
    aiAskEmpty: 'Write a little question first.',
    aiOpenAiBusy: 'Putting it together…',
    aiOpenAiFail: 'Something went wrong: ',
    assistantSendBusy: 'Working…',
    aiQuotaLine: 'AI uses remaining today: {{remaining}} / {{limit}}',
    aiQuotaExhaustedTitle: "Today's AI quota is used up.",
    aiQuotaExhaustedUpgradeFree: 'Upgrade to Pro for more daily AI uses.',
    settingsTitle: 'Plan & settings',
    settingsBack: 'Back to cats',
    authAccountSection: 'Account (Supabase)',
    authNotConfigured:
      'Cloud sign-in is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to `.env` or your host, run the SQL in `supabase/migrations` on your Supabase project, then restart the dev server.',
    authLoggedInStrip: 'Signed in',
    authOpenSettingsToSignIn: 'Open Plan & settings to sign in or register.',
    authCurrentAccount: 'Account',
    authSignOut: 'Sign out',
    authEmail: 'Email',
    authPassword: 'Password',
    authDisplayNameOptional: 'Display name (optional, signup only)',
    authSignIn: 'Sign in',
    authSignUp: 'Create account',
    authSwitchToSignUp: 'No account? Switch to sign up',
    authSwitchToSignIn: 'Have an account? Switch to sign in',
    authProcessing: 'Working…',
    authErrNotConfigured: 'Supabase is not configured.',
    authErrInvalid: 'Invalid email or password.',
    authErrEmailNotConfirmed: 'Please confirm your email from the inbox, then sign in.',
    authErrAlreadyReg: 'This email is already registered — try signing in.',
    authErrWeak: 'Password does not meet requirements — try a longer password.',
    authErrGeneric: 'Something went wrong: ',
    authErrMissingFields: 'Please enter email and password.',
    authSignUpSent: 'If signup succeeded, check your inbox (and spam), confirm your email, then sign in.',
    authSignedInOk: 'Signed in successfully.',
    authSignedOutOk: 'Signed out.',
    authLocalDataHint: 'Cats and daily logs still stay on this device; cloud sync comes in a later phase.',
    catsCloudLoading: 'Syncing cats from the cloud…',
    catsCloudLoadErr: 'Could not load cats from the cloud: ',
    catsCloudSaveErr: 'Could not save to the cloud: ',
    catsCloudDeleteErr: 'Could not delete from the cloud: ',
    careEventDailyUpdated: 'Updated today’s care log',
    settingsPlanSection: 'Plan (test mode)',
    settingsPlanCurrent: 'Current plan',
    settingsPlanFree: 'Free',
    settingsPlanProTest: 'Pro (test)',
    settingsPlanHint: 'For development testing only — no App Store or card checkout.',
    settingsSwitchPro: 'Switch to Pro (test)',
    settingsSwitchFree: 'Switch back to Free',
    settingsPlanServerHint:
      'If the daily AI limit stays at 3 after switching to Pro, set AI_TRUST_CLIENT_PLAN=1 on your assistant server (testing), or add this device ID to AI_PRO_CLIENT_IDS.',
    settingsPaymentNote: 'No billing is connected — nothing is charged.',
    settingsClientIdCaption: 'This device ID (for AI_PRO_CLIENT_IDS on the server)',
    planMultiCatUpgrade:
      'Multiple cats are a Pro feature. Upgrade to manage more than one cat and get more daily AI analysis.',
    planFreeMultiCatBanner:
      'Free supports one cat only. You currently have more than one — delete extras or switch to Pro (test).',
    openSettings: 'Plan & settings',
    sharedCareTitle: 'Shared care',
    sharedCareNavHint: 'Share one cat’s log with family or roommates (demo flow).',
    sharedCareBack: 'Back',
    sharedCareDemoBanner:
      'Demo mode: not connected to the cloud yet. Invite codes and members stay in this browser (sessionStorage). A future version will sync via Supabase.',
    sharedCareMembersTitle: 'Members',
    sharedCareRoleOwner: 'Owner',
    sharedCareRoleMember: 'Member',
    sharedCareInviteSection: 'Invite',
    sharedCareGenerateInvite: 'Generate invite code',
    sharedCareInviteCodeLabel: 'Invite code',
    sharedCareCopyCode: 'Copy code',
    sharedCareCopyLink: 'Copy invite link',
    sharedCareCopied: 'Copied',
    sharedCareCopyFail: 'Could not copy automatically — select the code or link manually.',
    sharedCareJoinSection: 'Join with a code',
    sharedCareJoinPlaceholder: 'Enter code, e.g. ABC123',
    sharedCareJoinSubmit: 'Join',
    sharedCareJoinOk: 'Joined (demo)',
    sharedCareJoinNeedCode: 'Ask the owner to generate an invite code first.',
    sharedCareJoinWrong: 'Code doesn’t match (demo).',
    sharedCareJoinDuplicate: 'You’re already in the member list.',
    sharedCareActivityTitle: 'Recent activity',
    sharedCareActivityEmpty: 'No activity yet. Generate a code or join to see entries here.',
    sharedCareActivityGenerated: 'generated a new invite code',
    sharedCareActivityJoined: 'joined with an invite code',
    sharedCareDisplayNameHint: 'Name shown on shared care (stored locally)',
    sharedCareDisplayNameLabel: 'My display name',
    sharedCareSaveName: 'Save',
    sharedCareTodayFeedTitle: 'Today’s care feed',
    sharedCareTodayFeedDemo: 'Sample lines below; real entries will appear after cloud sync.',
    sharedCareDemoLine1: 'Wayne logged dinner at 21:30',
    sharedCareDemoLine2: 'Amy uploaded an abnormal photo',
    proTeaserHistorySearch: 'History filter & search',
    proTeaserComing: 'Coming soon',
    proTeaserAdvancedWeekly: 'Advanced AI weekly report',
    proTeaserRoadmap: 'Planned for Pro',
    proTeaserAdvancedVet: 'Advanced vet report',
    aiErrRate: 'A little too fast — take a short break and try again.',
    aiAssistantApiErrorPrefix: 'AI service error: ',
    aiDisclaimerFoot:
      'The assistant shares care observations and reminders only —\nnot diagnosis or treatment.\nIf symptoms persist or worsen, please see a veterinarian.',
  },
};

function aiStatusHint(lang: Lang, kind: 'off' | 'key'): string {
  const tr = text[lang];
  const dev = import.meta.env.DEV;
  if (kind === 'off') return dev ? tr.aiAssistantUnreachableDev : tr.aiAssistantUnreachableProd;
  return dev ? tr.aiNeedServerEnvDev : tr.aiNeedServerEnvProd;
}

function aiQuotaExhaustedMessage(lang: Lang, appPlan: AppPlan): string {
  const t = text[lang];
  if (appPlan === 'free') {
    return `${t.aiQuotaExhaustedTitle}\n\n${t.aiQuotaExhaustedUpgradeFree}`;
  }
  return t.aiQuotaExhaustedTitle;
}

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

/** monthKey: YYYY-MM → section title for history page */
function formatHistoryMonthHeading(lang: Lang, monthKey: string): string {
  const [ys, ms] = monthKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  if (lang === 'zh') return `${y}年${m}月`;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

/** One weight per calendar day; if duplicates exist in storage, keep the last entry in file order (newest wins). */
function dedupeWeightRecordsByDate(records: WeightRecord[]): WeightRecord[] {
  const byDate = new Map<string, WeightRecord>();
  for (const r of records) {
    byDate.set(r.date, r);
  }
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
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

    return dedupeWeightRecordsByDate(
      parsed
        .map((item) => ({
          id: typeof item.id === 'string' ? item.id : makeId(),
          date: typeof item.date === 'string' ? item.date : todayKey(),
          weight: Number(item.weight),
          note: typeof item.note === 'string' ? item.note : '',
        }))
        .filter((item) => Number.isFinite(item.weight) && item.weight > 0)
    );
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

/** Local 7-day summary → short lines for app-style bullets. */
function splitSevenDaySummaryIntoLines(raw: string): string[] {
  const text = raw.replace(/\r/g, '').trim();
  if (!text) return [];
  const out: string[] = [];
  for (const block of text.split(/\n\s*\n/).map((b) => b.replace(/\n+/g, ' ').trim()).filter(Boolean)) {
    const innerLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (innerLines.length > 1 && innerLines.every((line) => /^[•‧·◦○\-\*]/.test(line))) {
      innerLines.forEach((l) => {
        const t = l.replace(/^[•‧·◦○\-\*]\s*/, '').trim();
        if (t) out.push(t);
      });
      continue;
    }
    if (block.length <= 76) {
      out.push(block);
      continue;
    }
    if (/[。．]/.test(block)) {
      block
        .split(/[。．]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => out.push(s));
      continue;
    }
    const bits = block.split(/\.\s+/).map((s) => s.trim()).filter(Boolean);
    if (bits.length >= 2) {
      bits.forEach((b, i) => {
        const t = i < bits.length - 1 && !b.endsWith('.') ? `${b}.` : b;
        if (t) out.push(t);
      });
    } else {
      out.push(block.length > 140 ? `${block.slice(0, 137)}…` : block);
    }
  }
  return out.filter(Boolean);
}

function sevenDaySummaryNeedsExpand(lines: string[]): boolean {
  if (lines.length >= 4) return true;
  const total = lines.reduce((n, l) => n + l.length, 0);
  if (total > 200) return true;
  if (lines.some((l) => l.length > 96)) return true;
  return false;
}

function formatAuthErrorMessage(lang: Lang, err: unknown): string {
  const t = text[lang];
  if (err instanceof Error && err.message === 'not_configured') return t.authErrNotConfigured;
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: string }).message ?? '')
      : String(err ?? '');
  const low = msg.toLowerCase();
  if (low.includes('invalid login credentials')) return t.authErrInvalid;
  if (low.includes('email not confirmed')) return t.authErrEmailNotConfirmed;
  if (low.includes('already registered') || low.includes('user already registered')) return t.authErrAlreadyReg;
  if (low.includes('password')) return t.authErrWeak;
  return `${t.authErrGeneric}${msg}`;
}

export default function App() {
  const today = todayKey();
  const month = monthKey();

  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [cats, setCats] = useState<Cat[]>(() => loadCats());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const tr = text[lang];

  const supabaseAuth = useSupabaseAuth();
  const authDisplayLabel = useMemo(() => {
    const u = supabaseAuth.user;
    if (!u) return '';
    const n = supabaseAuth.profile?.display_name?.trim();
    return n || u.email || '';
  }, [supabaseAuth.user, supabaseAuth.profile]);

  const [selectedCatId, setSelectedCatId] = useState<string>(() => {
    const savedCats = loadCats();
    const savedSelectedId = localStorage.getItem(SELECTED_CAT_KEY);

    if (savedSelectedId && savedCats.some((cat) => cat.id === savedSelectedId)) {
      return savedSelectedId;
    }

    return savedCats[0]?.id ?? 'default-cat';
  });

  const selectedCat = cats.find((cat) => cat.id === selectedCatId) ?? cats[0];

  const useCloudDaily = useMemo(
    () =>
      Boolean(supabaseAuth.user && supabaseAuth.supabase && selectedCat && isCloudCatId(selectedCat.id)),
    [supabaseAuth.user, supabaseAuth.supabase, selectedCat?.id]
  );

  const [page, setPage] = useState<Page>('today');
  const [newCatName, setNewCatName] = useState('');
  const [multiCatHint, setMultiCatHint] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [historyJumpDate, setHistoryJumpDate] = useState('');
  const [historyJumpHint, setHistoryJumpHint] = useState<string | null>(null);
  const [historyFabVisible, setHistoryFabVisible] = useState(false);
  const [aiClientId] = useState(() => getOrCreateClientId());
  const [appPlan, setAppPlan] = useState<AppPlan>(() => getAiPlan());
  const applyLocalAssistantQuota = useCallback(
    (plan: AppPlan, clientId: string, usageDate: string, prev: AssistantHealthPayload | null) => {
      const q = buildLocalAiQuota(plan, clientId, usageDate);
      return {
        openaiReady: prev?.openaiReady ?? false,
        planEffective: plan,
        dailyLimit: q.dailyLimit,
        dailyUsed: q.dailyUsed,
        dailyRemaining: q.dailyRemaining,
      };
    },
    []
  );
  const [weightDate, setWeightDate] = useState(today);
  const [weightValue, setWeightValue] = useState('');
  const [weightNote, setWeightNote] = useState('');

  const [sharedCareMap, setSharedCareMap] = useState<Record<string, SharedCareCatState>>(() => loadSharedCareMock());
  const [sharedCareJoinInput, setSharedCareJoinInput] = useState('');
  const [sharedCareFeedback, setSharedCareFeedback] = useState<string | null>(null);
  const [sharedCareCopied, setSharedCareCopied] = useState(false);
  const [sharedCareDisplayNameInput, setSharedCareDisplayNameInput] = useState(() => getCareDisplayName());
  const sharedCareCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchSharedCare = useCallback((catId: string, updater: (prev: SharedCareCatState) => SharedCareCatState) => {
    setSharedCareMap((map) => {
      const prev = map[catId] ?? createDefaultSharedCareState(lang);
      const next = updater(prev);
      const merged = { ...map, [catId]: next };
      saveSharedCareMock(merged);
      return merged;
    });
  }, [lang]);

  const flashSharedCareCopied = useCallback(() => {
    setSharedCareCopied(true);
    if (sharedCareCopyTimerRef.current) clearTimeout(sharedCareCopyTimerRef.current);
    sharedCareCopyTimerRef.current = setTimeout(() => setSharedCareCopied(false), 2000);
  }, []);

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayNameReg, setAuthDisplayNameReg] = useState('');
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authFormError, setAuthFormError] = useState<string | null>(null);
  const [catsCloudBusy, setCatsCloudBusy] = useState(false);
  const [catsCloudErr, setCatsCloudErr] = useState<string | null>(null);
  const [cloudCareEvents, setCloudCareEvents] = useState<CareEventRow[]>([]);
  const lastCloudDailyStripRef = useRef('');
  const cloudDailyFetchSeqRef = useRef(0);
  const cloudDailyHydratingRef = useRef(false);

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

  const historyMonthGroups = useMemo(() => {
    const groups: { monthKey: string; records: { date: string; data: DailyRecord }[] }[] = [];
    for (const record of history) {
      const mk = record.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.monthKey === mk) last.records.push(record);
      else groups.push({ monthKey: mk, records: [record] });
    }
    return groups;
  }, [history]);

  const historyDateBounds = useMemo(() => {
    if (!history.length) return { min: '', max: '' };
    return { min: history[history.length - 1].date, max: history[0].date };
  }, [history]);

  const assistantLast14 = useMemo(() => {
    if (!selectedCat) return [];
    const out: { date: string; data: DailyRecord }[] = [];
    for (let i = 0; i < 14; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = formatDateLocal(d);
      const data = ds === today ? daily : loadDailyRecord(selectedCat.id, ds);
      out.push({ date: ds, data });
    }
    return out;
  }, [selectedCat, today, daily, historyRefreshKey]);

  const assistantContext = useMemo((): AssistantContext | null => {
    if (!selectedCat) return null;
    const last7Days = assistantLast14.slice(0, 7);
    return {
      lang,
      today,
      monthKey: month,
      catId: selectedCat.id,
      cat: {
        name: selectedCat.name,
        emoji: selectedCat.emoji,
        chronicNote: selectedCat.chronicNote,
        allergyNote: selectedCat.allergyNote,
        vetClinic: selectedCat.vetClinic,
        profileNote: selectedCat.profileNote,
      },
      catsCount: cats.length,
      todayDaily: daily,
      last7Days,
      recentDaysForAi: assistantLast14,
      weightRecords: weightRecords.map((w) => ({
        id: w.id,
        date: w.date,
        weight: w.weight,
        note: w.note,
      })),
      monthlyCare: monthly,
    };
  }, [lang, today, month, selectedCat, cats.length, daily, assistantLast14, weightRecords, monthly]);

  const [assistantSevenExpanded, setAssistantSevenExpanded] = useState(false);

  useEffect(() => {
    setAssistantSevenExpanded(false);
  }, [assistantContext?.catId, assistantContext?.today, lang]);

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [aiCareBundle, setAiCareBundle] = useState<AssistantCareBundleJson | null>(null);
  const [aiBundleSavedHash, setAiBundleSavedHash] = useState<string | null>(null);
  const [aiBundleLoading, setAiBundleLoading] = useState(false);
  const [aiQaLoading, setAiQaLoading] = useState(false);
  const [openAiErr, setOpenAiErr] = useState<string | null>(null);
  const [assistantApiReady, setAssistantApiReady] = useState<boolean | null>(null);
  /** false = health fetch failed; true = got JSON (openaiReady may still be false). */
  const [assistantHealthReachable, setAssistantHealthReachable] = useState<boolean | null>(null);
  const [assistantQuota, setAssistantQuota] = useState<AssistantHealthPayload | null>(() =>
    buildAssistantHealthFromLocal(getAiPlan(), getOrCreateClientId(), todayKey())
  );
  const persistAppPlan = (p: AppPlan) => {
    setAiPlan(p);
    setAppPlan(p);
    setAssistantQuota((prev) => applyLocalAssistantQuota(p, aiClientId, today, prev));
  };
  const summariesAbortRef = useRef<AbortController | null>(null);
  const qaAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAssistantQuota((prev) => applyLocalAssistantQuota(appPlan, aiClientId, today, prev));
  }, [appPlan, aiClientId, today, applyLocalAssistantQuota]);

  useEffect(() => {
    if (page !== 'assistant') return;
    let cancelled = false;
    setAssistantApiReady((ready) => (ready === true ? true : null));
    setAssistantHealthReachable(null);
    fetchAssistantHealth(aiClientId, today, undefined, appPlan).then((h) => {
      if (cancelled) return;
      if (!h) {
        setAssistantHealthReachable(false);
        setAssistantApiReady(false);
        setAssistantQuota((prev) => applyLocalAssistantQuota(appPlan, aiClientId, today, prev));
        return;
      }
      setAssistantHealthReachable(true);
      setAssistantQuota(h);
      setAssistantApiReady(h.openaiReady);
    });
    return () => {
      cancelled = true;
    };
  }, [page, lang, aiClientId, today, appPlan, applyLocalAssistantQuota]);

  useEffect(() => {
    setAiQuestion('');
    setAiReply('');
    setOpenAiErr(null);
  }, [selectedCatId]);

  useEffect(() => {
    setAiCareBundle(null);
    setAiBundleSavedHash(null);
  }, [lang, today, selectedCatId]);

  useEffect(() => {
    if (page !== 'assistant') return;
    const ctx = assistantContext;
    if (!ctx) return;
    const meta = {
      clientId: aiClientId,
      catId: ctx.catId,
      usageDate: ctx.today,
      plan: appPlan,
    };
    const cached = peekCareBundleCache(ctx, meta);
    if (cached) {
      setAiCareBundle(cached);
      setAiBundleSavedHash(getCareBundleContextHash(ctx));
    }
  }, [page, assistantContext?.catId, assistantContext?.today, assistantContext?.lang, aiClientId, appPlan]);

  useEffect(
    () => () => {
      summariesAbortRef.current?.abort();
      qaAbortRef.current?.abort();
    },
    []
  );

  const runOpenAiCareBundle = useCallback(async () => {
    const ctx = assistantContext;
    if (!ctx) return;
    if (assistantApiReady !== true) {
      setOpenAiErr(
        assistantHealthReachable === false ? aiStatusHint(lang, 'off') : aiStatusHint(lang, 'key')
      );
      return;
    }
    summariesAbortRef.current?.abort();
    const ac = new AbortController();
    summariesAbortRef.current = ac;
    setAiBundleLoading(true);
    setOpenAiErr(null);
    const meta = {
      clientId: aiClientId,
      catId: ctx.catId,
      usageDate: ctx.today,
      plan: appPlan,
    };
    const hasCache = peekCareBundleCache(ctx, meta) != null;
    if (isAssistantCareBundleNetworkBlocked(assistantQuota, hasCache)) {
      setOpenAiErr(aiQuotaExhaustedMessage(lang, appPlan));
      setAiBundleLoading(false);
      return;
    }
    try {
      const { bundle, quota } = await generateAssistantCareBundleOpenAi(ctx, meta, ac.signal);
      setAiCareBundle(bundle);
      setAiBundleSavedHash(getCareBundleContextHash(ctx));
      if (quota) {
        setAssistantQuota((prev) =>
          mergeAssistantQuotaFromSnapshot(prev, quota, appPlan, aiClientId, ctx.today)
        );
      } else {
        const h = await fetchAssistantHealth(aiClientId, ctx.today, undefined, appPlan);
        if (h) setAssistantQuota(h);
        else setAssistantQuota((prev) => applyLocalAssistantQuota(appPlan, aiClientId, ctx.today, prev));
      }
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      if (e instanceof AssistantApiError) {
        if (e.code === 'QUOTA') setOpenAiErr(aiQuotaExhaustedMessage(lang, appPlan));
        else if (e.code === 'RATE') setOpenAiErr(text[lang].aiErrRate);
        else if (e.code === 'OPENAI')
          setOpenAiErr(`${text[lang].aiAssistantApiErrorPrefix}${e.message}`);
        else if (e.code === 'NO_API_KEY') setOpenAiErr(aiStatusHint(lang, 'key'));
        else setOpenAiErr(`${text[lang].aiOpenAiFail}${e.message}`);
      } else {
        setOpenAiErr(`${text[lang].aiOpenAiFail}${e instanceof Error ? e.message : String(e)}`);
      }
    } finally {
      setAiBundleLoading(false);
    }
  }, [
    assistantContext,
    lang,
    assistantApiReady,
    assistantHealthReachable,
    aiClientId,
    assistantQuota,
    appPlan,
    applyLocalAssistantQuota,
  ]);

  const runOpenAiQa = useCallback(async () => {
    const ctx = assistantContext;
    if (!ctx) return;
    const q = aiQuestion.trim();
    if (!q) {
      setOpenAiErr(text[lang].aiAskEmpty);
      setAiReply('');
      return;
    }
    if (assistantApiReady !== true) {
      setOpenAiErr(
        assistantHealthReachable === false ? aiStatusHint(lang, 'off') : aiStatusHint(lang, 'key')
      );
      setAiReply('');
      return;
    }
    if (isAssistantDailyQuotaExhausted(assistantQuota)) {
      setOpenAiErr(aiQuotaExhaustedMessage(lang, appPlan));
      setAiReply('');
      return;
    }
    qaAbortRef.current?.abort();
    const ac = new AbortController();
    qaAbortRef.current = ac;
    setAiQaLoading(true);
    setOpenAiErr(null);
    try {
      const { answer, quota } = await generateAssistantQaOpenAi(
        ctx,
        q,
        {
          clientId: aiClientId,
          catId: ctx.catId,
          usageDate: ctx.today,
          plan: appPlan,
        },
        ac.signal
      );
      setAiReply(`${answer.trim()}\n\n${text[lang].aiDisclaimerFoot}`);
      if (quota) {
        setAssistantQuota((prev) =>
          mergeAssistantQuotaFromSnapshot(prev, quota, appPlan, aiClientId, ctx.today)
        );
      } else {
        const h = await fetchAssistantHealth(aiClientId, ctx.today, undefined, appPlan);
        if (h) setAssistantQuota(h);
        else setAssistantQuota((prev) => applyLocalAssistantQuota(appPlan, aiClientId, ctx.today, prev));
      }
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      if (e instanceof AssistantApiError) {
        if (e.code === 'QUOTA') setOpenAiErr(aiQuotaExhaustedMessage(lang, appPlan));
        else if (e.code === 'RATE') setOpenAiErr(text[lang].aiErrRate);
        else if (e.code === 'OPENAI')
          setOpenAiErr(`${text[lang].aiAssistantApiErrorPrefix}${e.message}`);
        else if (e.code === 'NO_API_KEY') setOpenAiErr(aiStatusHint(lang, 'key'));
        else setOpenAiErr(`${text[lang].aiOpenAiFail}${e.message}`);
      } else {
        setOpenAiErr(`${text[lang].aiOpenAiFail}${e instanceof Error ? e.message : String(e)}`);
      }
      setAiReply('');
    } finally {
      setAiQaLoading(false);
    }
  }, [
    assistantContext,
    aiQuestion,
    lang,
    assistantApiReady,
    assistantHealthReachable,
    aiClientId,
    appPlan,
    assistantQuota,
    applyLocalAssistantQuota,
  ]);

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
    if (!supabaseAuth.authReady) return;
    if (!supabaseAuth.user || !supabaseAuth.supabase) {
      setCatsCloudBusy(false);
      setCatsCloudErr(null);
      setCats(loadCats());
      return;
    }

    let cancelled = false;
    void (async () => {
      const sb = supabaseAuth.supabase;
      if (!sb) {
        setCatsCloudBusy(false);
        return;
      }
      setCatsCloudBusy(true);
      setCatsCloudErr(null);
      const { data: cloudList, error } = await fetchCatsForUser(sb);
      if (cancelled) return;
      if (error) {
        setCatsCloudErr(error.message);
        setCatsCloudBusy(false);
        return;
      }
      const merged = mergeCloudCatsWithLocal(cloudList, loadCats());
      setCats(merged);
      setSelectedCatId((prev) => {
        const next = merged.some((c) => c.id === prev) ? prev : merged[0]?.id ?? prev;
        if (next !== prev) {
          queueMicrotask(() => {
            if (cancelled) return;
            const d = todayKey();
            const mk = monthKey();
            setDaily(loadDailyRecord(next, d));
            setMonthly(loadMonthlyRecord(next, mk));
            setWeightRecords(loadWeightRecords(next));
            setHistoryRefreshKey((k) => k + 1);
          });
        }
        return next;
      });
      setCatsCloudBusy(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabaseAuth.authReady, supabaseAuth.user?.id, supabaseAuth.supabase]);

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
    if (!useCloudDaily || !selectedCat || !supabaseAuth.supabase) return;
    const sb = supabaseAuth.supabase;
    const mySeq = ++cloudDailyFetchSeqRef.current;
    cloudDailyHydratingRef.current = true;
    let cancelled = false;
    void (async () => {
      const { data: cloudPart, error } = await fetchDailyRecordRow(sb, selectedCat.id, today);
      if (cancelled || mySeq !== cloudDailyFetchSeqRef.current) {
        cloudDailyHydratingRef.current = false;
        return;
      }
      if (error) {
        console.warn('[daily_records fetch]', error.message);
        cloudDailyHydratingRef.current = false;
        return;
      }
      const localFull = loadDailyRecord(selectedCat.id, today) as unknown as DailyJson;
      const merged = mergeCloudDailyPreferCloud(cloudPart as DailyJson | null, localFull) as DailyRecord;
      setDaily(merged);
      lastCloudDailyStripRef.current = JSON.stringify(stripPhotoFieldsFromDaily(merged as unknown as DailyJson));
      cloudDailyHydratingRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [useCloudDaily, selectedCat?.id, today, supabaseAuth.supabase]);

  useEffect(() => {
    if (!useCloudDaily || !selectedCat || !supabaseAuth.supabase) {
      setCloudCareEvents([]);
      return;
    }
    void fetchCareEventsForCat(supabaseAuth.supabase, selectedCat.id).then(({ data, error }) => {
      if (!error) setCloudCareEvents(data);
    });
  }, [useCloudDaily, selectedCat?.id, supabaseAuth.supabase]);

  useEffect(() => {
    if (!useCloudDaily || !selectedCat || !supabaseAuth.user?.id || !supabaseAuth.supabase) return;
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user.id;
    const handle = window.setTimeout(() => {
      if (cloudDailyHydratingRef.current) return;
      const strip = stripPhotoFieldsFromDaily(daily as unknown as DailyJson);
      const json = JSON.stringify(strip);
      if (json === lastCloudDailyStripRef.current) return;
      void (async () => {
        const { error } = await upsertDailyRecordCloud(sb, {
          catId: selectedCat.id,
          recordDate: today,
          data: strip,
          updatedBy: uid,
        });
        if (error) {
          console.warn('[daily_records upsert]', error.message);
          return;
        }
        lastCloudDailyStripRef.current = json;
        const actor =
          supabaseAuth.profile?.display_name?.trim() || supabaseAuth.user?.email || 'User';
        const summary = text[lang].careEventDailyUpdated;
        const { error: evErr } = await insertCareEventRow(sb, {
          catId: selectedCat.id,
          actor,
          action: 'daily_save',
          summary,
        });
        if (evErr) console.warn('[care_events]', evErr.message);
        const res = await fetchCareEventsForCat(sb, selectedCat.id);
        if (!res.error) setCloudCareEvents(res.data);
      })();
    }, 550);
    return () => window.clearTimeout(handle);
  }, [
    daily,
    useCloudDaily,
    selectedCat?.id,
    today,
    supabaseAuth.user?.id,
    supabaseAuth.supabase,
    supabaseAuth.profile?.display_name,
    supabaseAuth.user?.email,
    lang,
  ]);

  useEffect(() => {
    if (!selectedCat) return;
    localStorage.setItem(
      monthlyStorageKey(selectedCat.id, month),
      JSON.stringify(monthly)
    );
  }, [monthly, selectedCat, month]);

  useEffect(() => {
    if (appPlan === 'pro') setMultiCatHint(null);
  }, [appPlan]);

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
  };

  const handleAuthSignOut = useCallback(async () => {
    setAuthFormError(null);
    setAuthMessage(null);
    const { error } = await supabaseAuth.signOut();
    if (error) setAuthFormError(formatAuthErrorMessage(lang, error));
    else setAuthMessage(text[lang].authSignedOutOk);
  }, [supabaseAuth, lang]);

  const handleAuthSubmit = useCallback(async () => {
    setAuthFormError(null);
    setAuthMessage(null);
    const email = authEmail.trim();
    if (!email || !authPassword) {
      setAuthFormError(text[lang].authErrMissingFields);
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === 'signIn') {
        const { error } = await supabaseAuth.signInWithEmail(email, authPassword);
        if (error) setAuthFormError(formatAuthErrorMessage(lang, error));
        else {
          setAuthMessage(text[lang].authSignedInOk);
          setAuthPassword('');
        }
      } else {
        const { error } = await supabaseAuth.signUpWithEmail(
          email,
          authPassword,
          authDisplayNameReg.trim() || undefined
        );
        if (error) setAuthFormError(formatAuthErrorMessage(lang, error));
        else {
          setAuthMessage(text[lang].authSignUpSent);
          setAuthPassword('');
        }
      }
    } finally {
      setAuthBusy(false);
    }
  }, [authEmail, authPassword, authDisplayNameReg, authMode, supabaseAuth, lang]);

  const updateSelectedCat = (patch: Partial<Cat>) => {
    if (!selectedCat) return;
    const next: Cat = { ...selectedCat, ...patch };
    setCats((prev) => prev.map((cat) => (cat.id === selectedCat.id ? next : cat)));
    if (supabaseAuth.user && supabaseAuth.supabase && isCloudCatId(selectedCat.id)) {
      void updateCatForOwner(supabaseAuth.supabase, next).then(({ error }) => {
        if (error) console.warn('[cats cloud update]', error.message);
      });
    }
  };

  const addCat = async () => {
    const name = newCatName.trim();

    if (!name) {
      alert(tr.needCatName);
      return;
    }

    if (appPlan === 'free' && cats.length >= 1) {
      setMultiCatHint(tr.planMultiCatUpgrade);
      return;
    }
    setMultiCatHint(null);

    const base: Cat = {
      id: supabaseAuth.user && supabaseAuth.supabase ? crypto.randomUUID() : makeId(),
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

    if (supabaseAuth.user && supabaseAuth.supabase) {
      const { data, error } = await insertCatForOwner(supabaseAuth.supabase, supabaseAuth.user.id, base);
      if (error) {
        alert(`${tr.catsCloudSaveErr}${error.message}`);
        return;
      }
      if (!data) return;
      const created = data as Cat;
      setCats((prev) => [...prev, created]);
      setNewCatName('');
      setSelectedCatId(created.id);
      setDaily({});
      setMonthly({});
      setWeightRecords([]);
      setHistoryRefreshKey((v) => v + 1);
      setPage('cats');
      return;
    }

    setCats((prev) => [...prev, base]);
    setNewCatName('');
    setSelectedCatId(base.id);
    setDaily({});
    setMonthly({});
    setWeightRecords([]);
    setHistoryRefreshKey((v) => v + 1);
    setPage('cats');
  };

  const deleteCat = async (catId: string) => {
    const target = cats.find((cat) => cat.id === catId);
    if (!target) return;

    if (cats.length <= 1) {
      alert(tr.keepOneCat);
      return;
    }

    if (!confirm(`${tr.confirmDeleteCat}「${target.name}」？\n${tr.deleteCatNote}`)) {
      return;
    }

    if (supabaseAuth.user && supabaseAuth.supabase && isCloudCatId(catId)) {
      const { error } = await deleteCatForOwner(supabaseAuth.supabase, catId);
      if (error) {
        alert(`${tr.catsCloudDeleteErr}${error.message}`);
        return;
      }
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

    setWeightRecords((prev) => {
      const d = nextRecord.date;
      const withoutSameDay = prev.filter((r) => r.date !== d);
      return [nextRecord, ...withoutSameDay].sort((a, b) => b.date.localeCompare(a.date));
    });
    setWeightValue('');
    setWeightNote('');
  };

  const deleteWeightRecord = (id: string) => {
    if (!confirm(tr.deleteWeightConfirm)) return;
    setWeightRecords((prev) => prev.filter((record) => record.id !== id));
  };

  const exportBackup = () => {
    const backupData: Record<string, string> = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cat-calendar-')) {
        backupData[key] = localStorage.getItem(key) ?? '';
      }
    }

    const payload = {
      app: 'cat-calendar',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: backupData,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cat-calendar-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    alert(tr.exportDone);
  };

  const importBackup = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onerror = () => alert(tr.importFailed);

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed?.data;

        if (parsed?.app !== 'cat-calendar' || !data || typeof data !== 'object') {
          throw new Error('invalid backup');
        }

        const keys = Object.keys(data).filter((key) => key.startsWith('cat-calendar-'));
        if (keys.length === 0) throw new Error('empty backup');

        keys.forEach((key) => {
          const value = data[key];
          localStorage.setItem(
            key,
            typeof value === 'string' ? value : JSON.stringify(value)
          );
        });

        alert(tr.importDone);
        window.location.reload();
      } catch {
        alert(tr.importFailed);
      }
    };

    reader.readAsText(file);
  };

  const copyPrivacyPolicy = async () => {
    const policy = [
      tr.privacyTitle,
      '',
      tr.privacyDesc,
      '',
      `1. ${tr.privacyPoint1}`,
      `2. ${tr.privacyPoint2}`,
      `3. ${tr.privacyPoint3}`,
      `4. ${tr.privacyPoint4}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(policy);
      alert(tr.privacyCopied);
    } catch {
      alert(tr.copyFailed);
    }
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

  useEffect(() => {
    setHistoryJumpHint(null);
    setHistoryJumpDate('');
  }, [selectedCatId, historyRefreshKey]);

  useEffect(() => {
    if (page !== 'history') {
      setHistoryFabVisible(false);
      return;
    }
    const threshold = 280;
    const onScroll = () => {
      setHistoryFabVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [page, history.length]);

  const scrollHistoryToLatest = useCallback(() => {
    document.getElementById('history-latest-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollHistoryToPickedDate = useCallback(() => {
    const d = historyJumpDate.trim();
    if (!d) {
      setHistoryJumpHint(text[lang].historyPickDateFirst);
      return;
    }
    const el = document.getElementById(`history-day-${d}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHistoryJumpHint(null);
    } else {
      setHistoryJumpHint(text[lang].historyJumpNoMatch);
    }
  }, [historyJumpDate, lang]);

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

  const renderTodayPage = () => {
    const sharedCareToday = selectedCat
      ? sharedCareMap[selectedCat.id] ?? createDefaultSharedCareState(lang)
      : null;
    const todayCloudFeed = useCloudDaily
      ? cloudCareEvents.filter((e) => careEventCreatedOnLocalDate(e.created_at, today)).slice(0, 12)
      : [];

    return (
    <>
      {renderCatSwitcher()}

      <section className="mb-5 rounded-3xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm">
        <h2 className="text-base font-bold text-stone-900">{tr.sharedCareTodayFeedTitle}</h2>
        <p className="mt-1 text-xs text-stone-500">{tr.sharedCareTodayFeedDemo}</p>
        <ul className="mt-3 space-y-2 text-sm text-stone-700">
          {todayCloudFeed.map((e) => (
            <li key={e.id}>
              <span className="font-semibold text-stone-900">{e.actor}</span>
              <span className="text-stone-400"> · {formatCareEventTimeLabel(e.created_at)}</span>
              <span> — {e.summary}</span>
            </li>
          ))}
          {(sharedCareToday?.activities ?? []).slice(0, 8).map((a) => (
            <li key={a.id}>
              <span className="font-semibold text-stone-900">{a.actor}</span>
              <span className="text-stone-400"> · {a.timeLabel}</span>
              <span> — {a.summary}</span>
            </li>
          ))}
          {!todayCloudFeed.length && !sharedCareToday?.activities?.length ? (
            <>
              <li>{tr.sharedCareDemoLine1}</li>
              <li>{tr.sharedCareDemoLine2}</li>
            </>
          ) : null}
        </ul>
      </section>

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

        <div className="grid grid-cols-2 gap-3">
          {dailyItems.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleDaily(item.id)}
              className={`flex min-h-[78px] w-full items-center justify-between rounded-2xl border p-3 text-left shadow-sm transition active:scale-[0.98] ${
                daily[item.id] === true ? 'border-green-200 bg-green-50' : 'border-stone-100 bg-white'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-2xl">{item.emoji}</span>
                <span className="text-sm font-bold leading-snug text-stone-700">{tr[item.labelKey as keyof typeof tr]}</span>
              </div>
              <span className="ml-2 shrink-0 text-xl">{daily[item.id] === true ? '✅' : '⬜'}</span>
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

        <div className="grid grid-cols-2 gap-3">
          {monthlyItems.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleMonthly(item.id)}
              className={`flex min-h-[78px] w-full items-center justify-between rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                monthly[item.id] ? 'border-blue-200 bg-blue-50' : 'border-stone-100 bg-stone-50'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-2xl">{item.emoji}</span>
                <span className="text-sm font-bold leading-snug text-stone-700">{tr[item.labelKey as keyof typeof tr]}</span>
              </div>
              <span className="ml-2 shrink-0 text-xl">{monthly[item.id] ? '✅' : '⬜'}</span>
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
  };

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

  const renderHistoryPage = () => {
    const renderHistoryDayCard = (record: { date: string; data: DailyRecord }) => {
      const done = dailyItems.filter((item) => record.data[item.id] === true).length;
      const percent = Math.round((done / dailyItems.length) * 100);
      const recordAbnormalNote = typeof record.data.abnormalNote === 'string' ? record.data.abnormalNote : '';
      const recordDailyNote = typeof record.data.dailyNote === 'string' ? record.data.dailyNote : '';
      const recordAbnormalPhotos = getPhotoList(record.data.abnormalPhotos);
      const recordDailyPhotos = getPhotoList(record.data.dailyPhotos);

      return (
        <div
          key={record.date}
          id={`history-day-${record.date}`}
          className="scroll-mt-32 rounded-3xl bg-white p-5 shadow-sm"
        >
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
    };

    return (
      <>
        {renderCatSwitcher()}

        <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
          <div className="text-4xl">📅</div>
          <h1 className="mt-2 text-2xl font-bold">{tr.historyTitle}</h1>
          <p className="mt-1 text-sm text-stone-500">{tr.historyDesc}</p>
          <p className="mt-2 text-xs leading-5 text-stone-400">{tr.historyOrderNote}</p>
        </div>

        {history.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">{tr.noHistory}</div>
        ) : (
          <>
            <div className="sticky top-0 z-30 mb-4 space-y-2 rounded-2xl border border-stone-200 bg-orange-50/95 p-4 shadow-md backdrop-blur-sm">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor="history-jump-date" className="mb-1 block text-xs font-bold text-stone-600">
                    {tr.historyJumpLabel}
                  </label>
                  <input
                    id="history-jump-date"
                    type="date"
                    className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-300"
                    min={historyDateBounds.min}
                    max={historyDateBounds.max}
                    value={historyJumpDate}
                    onChange={(e) => {
                      setHistoryJumpDate(e.target.value);
                      setHistoryJumpHint(null);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={scrollHistoryToPickedDate}
                  className="shrink-0 rounded-2xl bg-stone-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm"
                >
                  {tr.historyJumpGo}
                </button>
              </div>
              {historyJumpHint ? <p className="text-xs font-medium text-amber-800">{historyJumpHint}</p> : null}
              <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 px-3 py-2 text-xs leading-5 text-stone-500">
                {tr.historyRoadmap}
              </div>
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-dashed border-stone-300 bg-stone-100/60 px-3 py-2.5 text-left text-xs text-stone-500"
              >
                <span className="block font-bold text-stone-600">{tr.proTeaserHistorySearch}</span>
                <span className="mt-0.5 block text-stone-400">{tr.proTeaserRoadmap}</span>
              </button>
            </div>

            <div id="history-latest-anchor" className="h-0 w-full scroll-mt-28" aria-hidden />

            {historyMonthGroups.map((group) => (
              <div key={group.monthKey} className="mb-8">
                <h3 className="mb-3 flex items-center gap-2 text-stone-800">
                  <span className="h-px min-w-[1rem] flex-1 bg-stone-300" />
                  <span className="shrink-0 rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold tracking-wide text-white">
                    {formatHistoryMonthHeading(lang, group.monthKey)}
                  </span>
                  <span className="h-px min-w-[1rem] flex-1 bg-stone-300" />
                </h3>
                <div className="space-y-4">{group.records.map((record) => renderHistoryDayCard(record))}</div>
              </div>
            ))}
          </>
        )}

        {historyFabVisible && history.length > 0 ? (
          <button
            type="button"
            onClick={scrollHistoryToLatest}
            className="fixed bottom-28 right-5 z-40 flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-orange-700 shadow-lg transition hover:bg-orange-50"
          >
            <span className="text-base" aria-hidden>
              ↑
            </span>
            {tr.historyBackLatest}
          </button>
        ) : null}
      </>
    );
  };

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

      <div className="mb-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50/90 p-4 shadow-sm">
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed text-left"
        >
          <span className="block text-sm font-bold text-stone-600">{tr.proTeaserAdvancedVet}</span>
          <span className="mt-1 block text-xs text-stone-500">{tr.proTeaserRoadmap}</span>
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
      <label className="mb-0.5 block text-[11px] font-bold text-stone-500">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => updateSelectedCat({ [keyName]: e.target.value })}
        placeholder={placeholder}
        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-orange-300"
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
      <label className="mb-0.5 block text-[11px] font-bold text-stone-500">{label}</label>
      <textarea
        value={value ?? ''}
        onChange={(e) => updateSelectedCat({ [keyName]: e.target.value })}
        placeholder={placeholder}
        className="min-h-[4.5rem] w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-3 text-[13px] outline-none focus:border-orange-300"
      />
    </div>
  );

  const renderAssistantPage = () => {
    if (!assistantContext) return null;

    const apiReady = assistantApiReady === true;
    const apiChecking = assistantApiReady === null;
    const qaBusy = aiQaLoading || aiBundleLoading;
    const currentCtxHash = getCareBundleContextHash(assistantContext);
    const dataStale =
      Boolean(aiCareBundle) && aiBundleSavedHash != null && currentCtxHash !== aiBundleSavedHash;
    const quotaLine =
      assistantQuota && assistantQuota.dailyLimit > 0
        ? tr.aiQuotaLine
            .replace('{{remaining}}', String(assistantQuota.dailyRemaining))
            .replace('{{limit}}', String(assistantQuota.dailyLimit))
        : null;

    const bundleMeta = {
      clientId: aiClientId,
      catId: assistantContext.catId,
      usageDate: assistantContext.today,
      plan: appPlan,
    };
    const careHasCache = peekCareBundleCache(assistantContext, bundleMeta) != null;
    const bundleNetBlocked = isAssistantCareBundleNetworkBlocked(assistantQuota, careHasCache);
    const qaBlocked = isAssistantDailyQuotaExhausted(assistantQuota);
    const quotaExhaustedNotice =
      apiReady &&
      assistantQuota != null &&
      assistantQuota.dailyLimit > 0 &&
      assistantQuota.dailyRemaining <= 0;

    const dataFreshBundle = Boolean(aiCareBundle && !dataStale);

    const sevenDayLines = splitSevenDaySummaryIntoLines(buildSevenDayAnalysis(assistantContext));
    const sevenDayExpandable = sevenDaySummaryNeedsExpand(sevenDayLines);
    const sevenDayCollapsed = sevenDayExpandable && !assistantSevenExpanded;

    const renderAiBlock = (title: string, body: string) => (
      <section className="mb-4 rounded-2xl border border-stone-100 border-l-4 border-l-orange-300 bg-white px-4 py-3.5 shadow-sm">
        <h3 className="mb-1.5 text-sm font-semibold text-stone-900">{title}</h3>
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-stone-700">{body}</div>
      </section>
    );

    return (
      <>
        {renderCatSwitcher()}

        <section className="mb-3 rounded-xl border border-orange-100/80 bg-white px-2.5 py-1.5 shadow-sm">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 text-base leading-none shadow-inner"
              aria-hidden
            >
              {assistantContext.cat.emoji?.trim() || '🐾'}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs font-bold leading-tight text-stone-900">{tr.assistantTitle}</h1>
              <p className="mt-0.5 text-[11px] leading-snug text-stone-500">{tr.assistantLead}</p>
            </div>
          </div>
        </section>

        {quotaLine ? (
          <p className="mb-3 text-[12px] leading-snug text-stone-500">{quotaLine}</p>
        ) : null}

        {quotaExhaustedNotice ? (
          <div className="mb-3 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-[12px] leading-snug text-amber-950">
            <p className="m-0 font-medium">{tr.aiQuotaExhaustedTitle}</p>
            {appPlan === 'free' ? (
              <p className="mt-1.5 m-0 text-[11px] text-amber-900/90">{tr.aiQuotaExhaustedUpgradeFree}</p>
            ) : null}
          </div>
        ) : null}

        <section className="mb-4 rounded-2xl border border-stone-100 bg-white px-3.5 py-3.5 shadow-sm">
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-base"
              aria-hidden
            >
              📋
            </span>
            <h2 className="text-[15px] font-semibold text-stone-900">{tr.assistantLocalSevenTitle}</h2>
          </div>
          <div className={sevenDayCollapsed ? 'relative max-h-[5.35rem] overflow-hidden' : 'relative'}>
            <ul className="m-0 list-none space-y-2 p-0">
              {sevenDayLines.map((line, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-snug text-stone-700">
                  <span className="mt-0.5 shrink-0 text-orange-400" aria-hidden>
                    •
                  </span>
                  <span className="min-w-0 flex-1">{line}</span>
                </li>
              ))}
            </ul>
            {sevenDayCollapsed ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/90 to-transparent"
                aria-hidden
              />
            ) : null}
          </div>
          {sevenDayExpandable ? (
            <button
              type="button"
              onClick={() => setAssistantSevenExpanded((prev) => !prev)}
              className="mt-2 w-full rounded-lg py-1.5 text-[13px] font-medium text-orange-600 transition hover:bg-orange-50/80 active:scale-[0.99]"
            >
              {assistantSevenExpanded ? tr.assistantSevenCollapse : tr.assistantSevenExpandMore}
            </button>
          ) : null}
        </section>

        <section className="mb-4 rounded-2xl border border-orange-100/60 bg-gradient-to-b from-white via-white to-orange-50/35 px-3.5 py-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-base"
              aria-hidden
            >
              ✨
            </span>
            <h2 className="text-[15px] font-semibold text-stone-900">{tr.assistantAnalysisCardTitle}</h2>
          </div>

          {apiChecking || !apiReady ? (
            <p className="mb-3 text-sm leading-snug text-stone-500">
              {apiChecking ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" aria-hidden />
                  {tr.aiChecking}
                </span>
              ) : (
                <span>{assistantHealthReachable === false ? aiStatusHint(lang, 'off') : aiStatusHint(lang, 'key')}</span>
              )}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!apiReady || aiBundleLoading || bundleNetBlocked}
            onClick={runOpenAiCareBundle}
            className="w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 py-3 text-[14px] font-semibold text-white shadow-md shadow-orange-200/50 transition hover:from-orange-500 hover:to-orange-600 disabled:opacity-45 disabled:shadow-none sm:w-auto sm:min-w-[200px] sm:px-8"
          >
            {aiBundleLoading ? tr.aiOpenAiBusy : tr.aiGenerateWeek}
          </button>

          <p className="mt-3 text-[13px] leading-snug text-stone-500">{tr.aiAnalysisCardSubtitle}</p>

          {dataStale && !aiBundleLoading ? (
            <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-[13px] leading-snug text-amber-950">
              {tr.aiDataStaleHint}
            </p>
          ) : null}

          {!dataStale && dataFreshBundle && !aiBundleLoading ? (
            <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-[13px] leading-snug text-emerald-900">
              {tr.aiBundleCurrentHint}
            </p>
          ) : null}

          {apiReady && !aiCareBundle && !aiBundleLoading && !dataStale ? (
            <p className="mt-3 text-[13px] leading-snug text-stone-500">{tr.aiEmptyHint}</p>
          ) : null}

          {openAiErr ? (
            <p className="mt-3 whitespace-pre-line rounded-xl border border-red-100 bg-red-50/90 px-3 py-2.5 text-[13px] leading-snug text-red-900">
              {openAiErr}
            </p>
          ) : null}
        </section>

        <section className="mb-4 rounded-2xl border border-dashed border-stone-200 bg-white px-3.5 py-3 shadow-sm">
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-left opacity-85"
          >
            <span className="block text-sm font-bold text-stone-600">{tr.proTeaserAdvancedWeekly}</span>
            <span className="mt-0.5 block text-xs text-stone-500">{tr.proTeaserComing}</span>
          </button>
        </section>

        {apiReady && aiBundleLoading ? (
          <section className="mb-4 flex items-center gap-2.5 rounded-2xl border border-orange-100 bg-orange-50/50 px-3.5 py-3 text-[13px] leading-snug text-stone-700">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-orange-400" aria-hidden />
            {tr.aiOpenAiBusy}
          </section>
        ) : null}

        {aiCareBundle ? (
          <div className="mb-4">
            {renderAiBlock(tr.assistantToday, aiCareBundle.healthSummary.trim())}
            {renderAiBlock(tr.assistantSeven, aiCareBundle.sevenDayAnalysis.trim())}
            {renderAiBlock(tr.assistantVetAi, aiCareBundle.vetReport.trim())}
            <p className="mx-auto max-w-md px-1 text-center text-[11px] leading-snug text-stone-400">
              {tr.aiDisclaimerFoot}
            </p>
          </div>
        ) : null}

        <section className="mb-4 rounded-2xl border border-stone-100 bg-white px-3.5 py-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-base" aria-hidden>
              💬
            </span>
            <h2 className="text-[15px] font-semibold text-stone-900">{tr.assistantAsk}</h2>
          </div>
          <p className="mb-3 text-[13px] leading-snug text-stone-500">{tr.assistantAskHint}</p>
          <textarea
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            placeholder={tr.assistantAskPlaceholder}
            disabled={qaBusy || !apiReady || qaBlocked}
            className="min-h-[5.5rem] w-full resize-none rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-[13px] leading-snug text-stone-800 outline-none transition focus:border-orange-300 focus:bg-white disabled:opacity-60"
          />
          <button
            type="button"
            disabled={qaBusy || !apiReady || qaBlocked}
            onClick={runOpenAiQa}
            className="mt-3 w-full rounded-full border border-orange-200 bg-white py-3 text-[14px] font-semibold text-orange-600 shadow-sm transition hover:bg-orange-50 disabled:opacity-60"
          >
            {aiQaLoading ? tr.assistantSendBusy : tr.assistantSend}
          </button>
          {aiReply ? (
            <div className="mt-4 rounded-xl border border-stone-100 bg-stone-50/80 p-3.5">
              <p className="mb-2 text-[11px] font-medium text-stone-500">{tr.assistantReplyLabel}</p>
              <div className="whitespace-pre-line text-[13px] leading-relaxed text-stone-800">{aiReply}</div>
            </div>
          ) : null}
        </section>
      </>
    );
  };


  const renderSharedCarePage = () => {
    if (!selectedCat) return null;
    const t = text[lang];
    const sc = sharedCareMap[selectedCat.id] ?? createDefaultSharedCareState(lang);
    const ownerName = sc.members.find((m) => m.role === 'owner')?.name ?? defaultOwnerName(lang);

    const onGenerateInvite = () => {
      const code = generateInviteCode();
      const timeLabel = nowTimeLabel();
      patchSharedCare(selectedCat.id, (prev) => {
        const on = prev.members.find((m) => m.role === 'owner')?.name ?? defaultOwnerName(lang);
        return {
          ...prev,
          inviteCode: code,
          activities: [
            {
              id: makeActivityId(),
              actor: on,
              summary: `${t.sharedCareActivityGenerated} · ${code}`,
              timeLabel,
            },
            ...prev.activities,
          ].slice(0, 50),
        };
      });
      setSharedCareFeedback(null);
    };

    const onCopyCode = async () => {
      if (!sc.inviteCode) return;
      try {
        await navigator.clipboard.writeText(sc.inviteCode);
        flashSharedCareCopied();
      } catch {
        setSharedCareFeedback(t.sharedCareCopyFail);
      }
    };

    const onCopyLink = async () => {
      if (!sc.inviteCode) return;
      try {
        const u = new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost');
        u.searchParams.set('invite', sc.inviteCode);
        await navigator.clipboard.writeText(u.toString());
        flashSharedCareCopied();
      } catch {
        setSharedCareFeedback(t.sharedCareCopyFail);
      }
    };

    const onJoin = () => {
      const code = sharedCareJoinInput.trim().toUpperCase();
      const cur = sharedCareMap[selectedCat.id] ?? createDefaultSharedCareState(lang);
      if (!cur.inviteCode) {
        setSharedCareFeedback(t.sharedCareJoinNeedCode);
        return;
      }
      if (code !== cur.inviteCode) {
        setSharedCareFeedback(t.sharedCareJoinWrong);
        return;
      }
      if (cur.members.some((m) => m.id === 'demo-guest-mvp')) {
        setSharedCareFeedback(t.sharedCareJoinDuplicate);
        return;
      }
      const timeLabel = nowTimeLabel();
      patchSharedCare(selectedCat.id, (prev) => ({
        ...prev,
        members: [
          ...prev.members,
          { id: 'demo-guest-mvp', name: DEMO_MEMBER_NAME, role: 'member' },
        ],
        activities: [
          {
            id: makeActivityId(),
            actor: DEMO_MEMBER_NAME,
            summary: t.sharedCareActivityJoined,
            timeLabel,
          },
          ...prev.activities,
        ].slice(0, 50),
      }));
      setSharedCareFeedback(t.sharedCareJoinOk);
      setSharedCareJoinInput('');
    };

    const onSaveDisplayName = () => {
      const raw = sharedCareDisplayNameInput.trim();
      setCareDisplayName(raw);
      const display = raw || defaultOwnerName(lang);
      patchSharedCare(selectedCat.id, (prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === 'local-owner' ? { ...m, name: display } : m)),
      }));
    };

    return (
      <>
        {renderCatSwitcher()}
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setPage('cats')}
            className="mb-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-bold text-stone-700"
          >
            ← {t.sharedCareBack}
          </button>
          <h1 className="text-xl font-bold text-stone-900">{t.sharedCareTitle}</h1>
          <p className="mt-1 text-sm text-stone-500">{selectedCat.name}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-amber-800">{t.sharedCareNavHint}</p>
        </section>

        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-950">
          {t.sharedCareDemoBanner}
        </div>

        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <label className="mb-1 block text-[11px] font-bold text-stone-500">{t.sharedCareDisplayNameLabel}</label>
          <p className="mb-2 text-[11px] text-stone-400">{t.sharedCareDisplayNameHint}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={sharedCareDisplayNameInput}
              onChange={(e) => setSharedCareDisplayNameInput(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-orange-300"
              placeholder={defaultOwnerName(lang)}
            />
            <button
              type="button"
              onClick={onSaveDisplayName}
              className="shrink-0 rounded-xl bg-orange-400 px-4 py-2 text-sm font-bold text-white"
            >
              {t.sharedCareSaveName}
            </button>
          </div>
        </section>

        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-stone-900">{t.sharedCareMembersTitle}</h2>
          <ul className="space-y-2">
            {sc.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2"
              >
                <span className="font-semibold text-stone-900">{m.name}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    m.role === 'owner' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {m.role === 'owner' ? t.sharedCareRoleOwner : t.sharedCareRoleMember}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-stone-400">
            {t.sharedCareRoleOwner}：{ownerName}
          </p>
        </section>

        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-stone-900">{t.sharedCareInviteSection}</h2>
          <button
            type="button"
            onClick={onGenerateInvite}
            className="mb-3 w-full rounded-xl bg-orange-400 py-3 text-sm font-bold text-white shadow-sm"
          >
            {t.sharedCareGenerateInvite}
          </button>
          <div className="mb-2">
            <span className="text-[11px] font-bold text-stone-500">{t.sharedCareInviteCodeLabel}</span>
            <p className="mt-1 font-mono text-lg font-bold tracking-widest text-stone-900">{sc.inviteCode ?? '—'}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!sc.inviteCode}
              onClick={onCopyCode}
              className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-bold text-stone-700 disabled:opacity-45"
            >
              {sharedCareCopied ? t.sharedCareCopied : t.sharedCareCopyCode}
            </button>
            <button
              type="button"
              disabled={!sc.inviteCode}
              onClick={onCopyLink}
              className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-bold text-stone-700 disabled:opacity-45"
            >
              {sharedCareCopied ? t.sharedCareCopied : t.sharedCareCopyLink}
            </button>
          </div>
        </section>

        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-bold text-stone-900">{t.sharedCareJoinSection}</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={sharedCareJoinInput}
              onChange={(e) => setSharedCareJoinInput(e.target.value.toUpperCase())}
              placeholder={t.sharedCareJoinPlaceholder}
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[13px] uppercase outline-none focus:border-orange-300"
            />
            <button
              type="button"
              onClick={onJoin}
              className="shrink-0 rounded-xl bg-stone-800 px-4 py-2 text-sm font-bold text-white"
            >
              {t.sharedCareJoinSubmit}
            </button>
          </div>
          {sharedCareFeedback ? <p className="mt-2 text-[13px] font-medium text-orange-700">{sharedCareFeedback}</p> : null}
        </section>

        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-bold text-stone-900">{t.sharedCareActivityTitle}</h2>
          {useCloudDaily && cloudCareEvents.length > 0 ? (
            <ul className="mb-3 space-y-2">
              {cloudCareEvents.map((e) => (
                <li key={e.id} className="text-[13px] leading-snug text-stone-700">
                  <span className="font-semibold text-stone-900">{e.actor}</span>
                  <span className="text-stone-400"> · {formatCareEventTimeLabel(e.created_at)}</span>
                  <span> — {e.summary}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {sc.activities.length === 0 && !(useCloudDaily && cloudCareEvents.length > 0) ? (
            <p className="text-sm text-stone-500">{t.sharedCareActivityEmpty}</p>
          ) : sc.activities.length > 0 ? (
            <ul className="space-y-2">
              {sc.activities.map((a) => (
                <li key={a.id} className="text-[13px] leading-snug text-stone-700">
                  <span className="font-semibold text-stone-900">{a.actor}</span>
                  <span className="text-stone-400"> · {a.timeLabel}</span>
                  <span> — {a.summary}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </>
    );
  };


  const renderSettingsPage = () => (
    <>
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setPage('cats')}
          className="mb-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-bold text-stone-700"
        >
          ← {tr.settingsBack}
        </button>
        <h1 className="text-xl font-bold text-stone-900">{tr.settingsTitle}</h1>
      </section>

      <section className="mb-4 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.authAccountSection}</h2>
        {!supabaseAuth.configured ? (
          <p className="text-xs leading-relaxed text-stone-600">{tr.authNotConfigured}</p>
        ) : !supabaseAuth.authReady ? (
          <p className="text-sm text-stone-500">{tr.authProcessing}</p>
        ) : supabaseAuth.user ? (
          <>
            <p className="text-sm text-stone-700">
              <span className="font-bold text-stone-500">{tr.authCurrentAccount}</span>{' '}
              <span className="font-semibold text-orange-700">{authDisplayLabel}</span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-stone-500">{tr.authLocalDataHint}</p>
            <button
              type="button"
              onClick={() => void handleAuthSignOut()}
              className="mt-3 w-full rounded-xl border border-stone-300 bg-white py-2.5 text-sm font-bold text-stone-700"
            >
              {tr.authSignOut}
            </button>
          </>
        ) : (
          <>
            <p className="mb-3 text-[11px] leading-relaxed text-stone-500">{tr.authLocalDataHint}</p>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${authMode === 'signIn' ? 'bg-orange-400 text-white' : 'bg-stone-100 text-stone-600'}`}
                onClick={() => {
                  setAuthMode('signIn');
                  setAuthFormError(null);
                  setAuthMessage(null);
                }}
              >
                {tr.authSignIn}
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${authMode === 'signUp' ? 'bg-orange-400 text-white' : 'bg-stone-100 text-stone-600'}`}
                onClick={() => {
                  setAuthMode('signUp');
                  setAuthFormError(null);
                  setAuthMessage(null);
                }}
              >
                {tr.authSignUp}
              </button>
            </div>
            <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.authEmail}</label>
            <input
              type="email"
              autoComplete="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="mb-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-orange-300"
            />
            <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.authPassword}</label>
            <input
              type="password"
              autoComplete={authMode === 'signIn' ? 'current-password' : 'new-password'}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="mb-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-orange-300"
            />
            {authMode === 'signUp' ? (
              <>
                <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.authDisplayNameOptional}</label>
                <input
                  type="text"
                  value={authDisplayNameReg}
                  onChange={(e) => setAuthDisplayNameReg(e.target.value)}
                  className="mb-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-orange-300"
                />
              </>
            ) : null}
            {authFormError ? <p className="mb-2 text-[13px] font-medium text-red-600">{authFormError}</p> : null}
            {authMessage ? <p className="mb-2 text-[13px] font-medium text-green-700">{authMessage}</p> : null}
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void handleAuthSubmit()}
              className="w-full rounded-xl bg-orange-400 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-55"
            >
              {authBusy ? tr.authProcessing : authMode === 'signIn' ? tr.authSignIn : tr.authSignUp}
            </button>
          </>
        )}
      </section>

      <section className="mb-4 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.settingsPlanSection}</h2>
        <p className="text-sm text-stone-700">
          {tr.settingsPlanCurrent}：
          <span className="font-bold text-orange-600">
            {appPlan === 'pro' ? tr.settingsPlanProTest : tr.settingsPlanFree}
          </span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-stone-500">{tr.settingsPlanHint}</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-500">{tr.settingsPaymentNote}</p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {appPlan === 'free' ? (
            <button
              type="button"
              onClick={() => persistAppPlan('pro')}
              className="rounded-xl bg-orange-400 px-4 py-3 text-sm font-bold text-white shadow-sm"
            >
              {tr.settingsSwitchPro}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => persistAppPlan('free')}
              className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-700"
            >
              {tr.settingsSwitchFree}
            </button>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-stone-400">{tr.settingsPlanServerHint}</p>
        <p className="mt-2 text-[11px] font-medium text-stone-500">{tr.settingsClientIdCaption}</p>
        <p className="mt-1 break-all rounded-lg bg-stone-50 px-2 py-1.5 font-mono text-[11px] text-stone-600">{aiClientId}</p>
      </section>

      <section className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.sharedCareTitle}</h2>
        <p className="mb-3 text-xs leading-relaxed text-stone-500">{tr.sharedCareNavHint}</p>
        <button
          type="button"
          onClick={() => setPage('sharedCare')}
          className="w-full rounded-xl bg-orange-400 px-4 py-3 text-sm font-bold text-white shadow-sm"
        >
          {tr.sharedCareTitle}
        </button>
      </section>
    </>
  );

  const renderCatsPage = () => (
    <>
      <section className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage('settings')}
            className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800 shadow-sm"
          >
            ⚙ {tr.openSettings}
          </button>
        </div>
        {supabaseAuth.configured && supabaseAuth.authReady && supabaseAuth.user ? (
          <div className="max-w-[58%] text-right text-[11px] leading-snug text-stone-600">
            <span className="font-bold text-stone-500">{tr.authLoggedInStrip}</span>{' '}
            <span className="font-semibold text-orange-700">{authDisplayLabel}</span>
          </div>
        ) : supabaseAuth.configured && supabaseAuth.authReady && !supabaseAuth.user ? (
          <p className="max-w-[58%] text-right text-[10px] leading-snug text-stone-400">{tr.authOpenSettingsToSignIn}</p>
        ) : null}
      </section>

      {appPlan === 'free' && cats.length > 1 ? (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-950 shadow-sm">
          {tr.planFreeMultiCatBanner}
        </div>
      ) : null}

      {supabaseAuth.user && supabaseAuth.supabase ? (
        catsCloudBusy ? (
          <div className="mb-3 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-[12px] text-sky-900 shadow-sm">
            {tr.catsCloudLoading}
          </div>
        ) : catsCloudErr ? (
          <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] leading-snug text-red-900 shadow-sm">
            {tr.catsCloudLoadErr}
            {catsCloudErr}
          </div>
        ) : null
      ) : null}

      <section className="mb-4 rounded-2xl bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.catList}</h2>
        <div className="space-y-2">
          {cats.map((cat) => (
            <div
              key={cat.id}
              className={`rounded-2xl border p-2.5 shadow-sm ${selectedCat?.id === cat.id ? 'border-orange-200 bg-orange-50' : 'border-stone-100 bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => selectCat(cat.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  {cat.profilePhoto ? (
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-orange-50">
                      <img src={cat.profilePhoto} alt={cat.name} className="h-full w-full object-cover" />
                    </span>
                  ) : (
                    <span className="text-2xl leading-none">{cat.emoji}</span>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold">{cat.name}</h3>
                    <p className="text-xs text-stone-500">{selectedCat?.id === cat.id ? tr.selected : tr.tapToSwitch}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    selectCat(cat.id);
                    setPage('sharedCare');
                  }}
                  className="shrink-0 rounded-full bg-orange-100 px-2 py-1.5 text-[11px] font-bold leading-tight text-orange-800"
                >
                  {tr.sharedCareTitle}
                </button>

                <button
                  onClick={() => deleteCat(cat.id)}
                  className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1.5 text-xs font-bold text-stone-500"
                >
                  {tr.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.addCat}</h2>
        <div className="flex gap-2">
          <input
            value={newCatName}
            onChange={(e) => {
              setNewCatName(e.target.value);
              setMultiCatHint(null);
            }}
            placeholder={tr.catNamePlaceholder}
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-orange-300"
          />
          <button
            type="button"
            onClick={addCat}
            disabled={appPlan === 'free' && cats.length >= 1}
            className="shrink-0 rounded-xl bg-orange-400 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {tr.add}
          </button>
        </div>
        {appPlan === 'free' && cats.length >= 1 ? (
          <p className="mt-2 text-[12px] leading-snug text-amber-900">{tr.planMultiCatUpgrade}</p>
        ) : null}
        {multiCatHint ? <p className="mt-2 text-[12px] leading-snug text-red-800">{multiCatHint}</p> : null}
      </section>

      <div className="mb-3 flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2 shadow-sm">
        <span className="text-2xl leading-none" aria-hidden>
          🐱
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-bold leading-tight text-stone-900">{tr.myCats}</h1>
          <p className="text-[11px] leading-snug text-stone-500">{tr.catsDesc}</p>
        </div>
      </div>

      <section className="mb-4 rounded-2xl bg-white p-3.5 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.catProfile}</h2>
        <p className="mb-3 text-[12px] leading-snug text-stone-500">{tr.catProfileDesc}</p>

        <div className="mb-3 flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-orange-50">
            {selectedCat?.profilePhoto ? (
              <button onClick={() => setSelectedPhoto(selectedCat.profilePhoto ?? null)} className="h-full w-full">
                <img src={selectedCat.profilePhoto} alt={selectedCat.name} className="h-full w-full object-cover" />
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl">🐱</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-bold text-stone-500">{tr.profilePhoto}</p>
            <label className="inline-block cursor-pointer rounded-xl bg-orange-100 px-3 py-2 text-xs font-bold text-orange-700">
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

        <div className="space-y-2">
          {renderProfileInput(tr.name, selectedCat?.name, 'name', tr.catNamePlaceholder)}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-bold text-stone-500">{tr.birthday}</label>
              <input
                type="date"
                value={selectedCat?.birthday ?? ''}
                onChange={(e) => updateSelectedCat({ birthday: e.target.value })}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-orange-300"
              />
            </div>
            {renderProfileInput(tr.gender, selectedCat?.gender, 'gender', lang === 'zh' ? '公 / 母' : 'Male / Female')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {renderProfileInput(tr.breed, selectedCat?.breed, 'breed', lang === 'zh' ? '米克斯 / 英短' : 'Mix / British Shorthair')}
            {renderProfileInput(tr.neutered, selectedCat?.neutered, 'neutered', lang === 'zh' ? '已結紮 / 未結紮' : 'Yes / No')}
          </div>
          {renderProfileInput(tr.chipNo, selectedCat?.chipNo, 'chipNo')}
          {renderProfileTextarea(tr.chronicNote, selectedCat?.chronicNote, 'chronicNote', lang === 'zh' ? '例如：腎臟病、心臟病、長期用藥' : 'Example: kidney disease, heart disease, medication')}
          {renderProfileTextarea(tr.allergyNote, selectedCat?.allergyNote, 'allergyNote')}
          {renderProfileInput(tr.vetClinic, selectedCat?.vetClinic, 'vetClinic')}
          {renderProfileTextarea(tr.profileNote, selectedCat?.profileNote, 'profileNote')}
        </div>

        <button
          type="button"
          onClick={() => setPage('sharedCare')}
          className="mt-4 w-full rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm font-bold text-orange-800 shadow-sm"
        >
          {tr.sharedCareTitle}
        </button>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-3.5 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.backupTitle}</h2>
        <p className="mb-3 text-[12px] leading-snug text-stone-500">{tr.backupDesc}</p>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportBackup} className="rounded-xl bg-orange-400 py-2.5 text-sm font-bold text-white shadow-sm">
            {tr.exportBackup}
          </button>

          <label className="cursor-pointer rounded-xl bg-stone-800 py-2.5 text-center text-sm font-bold text-white shadow-sm">
            {tr.importBackup}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                importBackup(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <p className="mt-2 text-[11px] leading-snug text-stone-400">{tr.importBackupDesc}</p>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-3.5 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.privacyTitle}</h2>
        <p className="mb-3 text-[12px] leading-snug text-stone-500">{tr.privacyDesc}</p>

        <div className="space-y-1.5 text-[13px] leading-snug text-stone-700">
          <p>1. {tr.privacyPoint1}</p>
          <p>2. {tr.privacyPoint2}</p>
          <p>3. {tr.privacyPoint3}</p>
          <p>4. {tr.privacyPoint4}</p>
        </div>

        <button
          onClick={copyPrivacyPolicy}
          className="mt-3 w-full rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-bold text-stone-600"
        >
          {tr.copyPrivacy}
        </button>
      </section>
    </>
  );

  return (
    <div className="min-h-screen bg-orange-50 px-4 py-6 text-stone-800">
      <div className="mx-auto max-w-md pb-24">
        <div className="mb-5 flex flex-col gap-2 rounded-3xl bg-white p-2 shadow-sm">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setPage('today')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'today' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
              {tr.today}
            </button>
            <button onClick={() => setPage('weight')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'weight' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
              {tr.weight}
            </button>
            <button onClick={() => setPage('vet')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'vet' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
              {tr.vet}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setPage('history')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'history' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
              {tr.history}
            </button>
            <button onClick={() => setPage('cats')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'cats' || page === 'settings' || page === 'sharedCare' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
              {tr.cats}
            </button>
            <button onClick={() => setPage('assistant')} className={`rounded-2xl py-3 text-xs font-bold transition ${page === 'assistant' ? 'bg-orange-400 text-white' : 'text-stone-500'}`}>
              {tr.assistantNav}
            </button>
          </div>
        </div>

        {supabaseAuth.configured && supabaseAuth.authReady && supabaseAuth.user ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-100 bg-sky-50/80 px-3 py-2.5 text-[12px] text-stone-700 shadow-sm">
            <span>
              <span className="font-bold text-stone-500">{tr.authLoggedInStrip}</span>{' '}
              <span className="font-semibold text-orange-800">{authDisplayLabel}</span>
            </span>
            <button
              type="button"
              onClick={() => void handleAuthSignOut()}
              className="shrink-0 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-bold text-stone-600"
            >
              {tr.authSignOut}
            </button>
          </div>
        ) : null}

        {page === 'today' && renderTodayPage()}
        {page === 'weight' && renderWeightPage()}
        {page === 'vet' && renderVetPage()}
        {page === 'history' && renderHistoryPage()}
        {page === 'cats' && renderCatsPage()}
        {page === 'settings' && renderSettingsPage()}
        {page === 'sharedCare' && renderSharedCarePage()}
        {page === 'assistant' && renderAssistantPage()}

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
