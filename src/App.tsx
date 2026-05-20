import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Bell,
  Calendar,
  Clock,
  Crown,
  Download,
  FileText,
  LayoutGrid,
  Lock,
  Scale,
  Settings,
  Shield,
  Sparkles,
  Stethoscope,
  User,
  type LucideIcon,
} from 'lucide-react';
import { Onboarding } from './components/Onboarding';
import { SkeletonCard, SkeletonLine, Spinner } from './components/SkeletonCard';
import { isOnboardingDone, markOnboardingDone } from './onboardingStorage';
import { AppleSignInButton } from './components/AppleSignInButton';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { OfflineBanner } from './components/OfflineBanner';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { trackEvent } from './services/analytics';
import { handleAppleSignIn } from './services/auth/appleSignIn';
import {
  applyDailyPendingSync,
  clearWeightsPendingSync,
  countPendingSyncItems,
  flushPendingSync,
  markDailyPendingSync,
  markWeightsPendingSync,
} from './services/offlineSync';
import { navigateTo } from './legalNavigate';
import { useAppBootstrap } from './AppBootstrapContext';
import { useToast } from './context/ToastContext';
import {
  type AssistantContext,
  type AssistantCareBundleJson,
  type AssistantWeeklyReportJson,
  buildSevenDayAnalysis,
} from './aiCareAssistant';
import { buildLocalAiQuota, getOrCreateClientId, getAiPlan, setAiPlan } from './aiClient';
import {
  FREE_MAX_ACTIVE_PETS,
  getMaxDailyPhotos,
  type AppPlan,
} from './planLimits';
import { AiDailyQuotaCard } from './components/AiDailyQuotaCard';
import { PremiumUpgradeCard } from './components/PremiumUpgradeCard';
import { PremiumUpsellSheet, type PremiumUpsellReason } from './components/PremiumUpsellSheet';
import { ProSubscriptionPanel } from './components/ProSubscriptionPanel';
import {
  getSubscriptionStatus,
  purchasePro,
  restorePurchases,
  setSubscriptionStatus,
  downgradeToFree,
  type BillingPeriod,
} from './subscription';
import {
  AssistantApiError,
  type AssistantHealthPayload,
  buildAssistantHealthFromLocal,
  fetchAssistantHealth,
  generateAssistantCareBundleOpenAi,
  generateAssistantQaOpenAi,
  generateAssistantWeeklyReportOpenAi,
  normalizeCareBundlePayload,
  getCareBundleContextHash,
  isAssistantCareBundleNetworkBlocked,
  isAssistantDailyQuotaExhausted,
  mergeAssistantQuotaFromSnapshot,
  peekCareBundleCache,
} from './openaiAssistant';
import type { SharedCareMember } from './sharedCareTypes';
import {
  acceptCatInvite,
  createInviteCodeForCat,
  fetchActiveInviteCodeForCat,
  fetchCatMembersWithProfiles,
  fetchMyCatRolesMap,
  fetchMyRoleForCat,
  removeCatMember,
  type CatAccessRole,
} from './supabaseSharedCare';
import { useSupabaseAuth } from './useSupabaseAuth';
import {
  archiveCatForOwner,
  fetchCatsForUser,
  restoreCatForOwner,
  insertCatForOwner,
  isCloudCatId,
  updateCatForOwner,
  type AppCat,
} from './supabaseCats';
import {
  appCatToNormalized,
  CATS_STORAGE_KEY,
  formatArchiveErrorMessage,
  formatRestoreErrorMessage,
  isValidPetForArchive,
  loadRawCatsFromStorage,
  mergeAndNormalizeCats,
  normalizeAllCats,
  normalizeAndPersistCats,
  normalizeCat,
  type NormalizedCat,
} from './catNormalize';
import {
  defaultEmojiForPetType,
  getDailyItemsForPetType,
  getMonthlyItemsForPetType,
  type PetType,
} from './petTypes';
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
import {
  migrateOfflineCatsToCloud,
  pullCloudDataIntoLocal,
  purgeCatLocalStorage,
  pushAiUsageSnapshot,
  pushLocalDataToCloud,
  pushWeeklyReportToCloud,
} from './cloudDataSync';
import { permanentlyDeleteCatForOwner } from './supabaseCatPermanentDelete';
import { upsertDailyPhotosCloud } from './supabasePhotos';
import { upsertUserAiPlan } from './supabaseUserPrefs';
import type { CloudSyncPhase } from './cloudSyncTypes';
import { upsertMonthlyRecordCloud } from './supabaseMonthly';
import { upsertWeightRecordsForCat } from './supabaseWeight';
import { upsertUserReminders } from './supabaseReminders';
import {
  computeHistoryDateRange,
  isHistorySearchModeActive,
  searchHistory,
  type HistoryDatePreset,
  type HistoryFilterChip,
  type HistorySearchHit,
} from './historySearch';
import {
  createCustomReminder,
  createReminderFromTemplate,
  defaultDueDateDaysFromNow,
  formatDueDateDisplay,
  formatReminderSchedule,
  getLocalDateKey,
  getReminderLimit,
  getUpcomingOnceReminders,
  loadReminders,
  remindersWithoutCat,
  processDueReminders,
  reminderAppliesOnDate,
  REMINDER_TEMPLATES,
  saveReminders,
  type Reminder,
  type ReminderKind,
  type ReminderRepeatType,
} from './reminders';
import {
  getNotificationPermission,
  getNotificationServiceStatus,
  getNotificationSupport,
  permissionStatusLabel,
  requestNotificationPermission,
  sendTestNotification,
} from './services/notifications';
import { VetReportPage } from './VetReportPage';
import {
  exportReportElementAsPdf,
  exportReportElementAsPng,
  shareReportText,
} from './vetReportExport';
import { AssistantWeeklyReportView } from './AssistantWeeklyReportView';
import { WeeklyReportErrorBoundary } from './WeeklyReportErrorBoundary';
import {
  formatWeeklyReportPlainText,
  loadSavedWeeklyReport,
  saveWeeklyReport,
  type SavedWeeklyReport,
} from './weeklyReportStorage';
import { normalizeWeeklyReport } from './weeklyReportModel';
import {
  safeGetItem,
  safeLoadJson,
  safeParseJson,
  safeRemoveItem,
  safeSetItem,
  storageError,
} from './safeStorage';

type Lang = 'zh' | 'en';

type Cat = NormalizedCat;

type DailyRecord = Record<string, boolean | string | string[]>;
type MonthlyRecord = Record<string, boolean>;
type Page =
  | 'today'
  | 'weight'
  | 'vet'
  | 'history'
  | 'reminders'
  | 'more'
  | 'cats'
  | 'assistant'
  | 'settings'
  | 'sharedCare';

type MainTabId = 'today' | 'weight' | 'vet' | 'history' | 'reminders' | 'more';

const MAIN_TAB_ROWS: {
  id: MainTabId;
  labelKey: 'today' | 'weight' | 'vet' | 'history' | 'remindersNav' | 'more';
  Icon: LucideIcon;
}[][] = [
  [
    { id: 'today', labelKey: 'today', Icon: Calendar },
    { id: 'weight', labelKey: 'weight', Icon: Scale },
    { id: 'vet', labelKey: 'vet', Icon: Stethoscope },
  ],
  [
    { id: 'history', labelKey: 'history', Icon: Clock },
    { id: 'reminders', labelKey: 'remindersNav', Icon: Bell },
    { id: 'more', labelKey: 'more', Icon: Settings },
  ],
];

const MORE_SUB_PAGES: Page[] = ['more', 'settings', 'assistant'];

type WeightRecord = {
  id: string;
  date: string;
  weight: number;
  note: string;
};

const SELECTED_CAT_KEY = 'cat-calendar-selected-cat-id';
const LANG_KEY = 'cat-calendar-lang';

const text = {
  zh: {
    appTitle: '寵物日曆',
    appSubtitle: 'Pet Calendar',
    navProBadge: 'Pro 會員',
    today: '今日',
    weight: '體重',
    history: '歷史',
    vet: '獸醫',
    more: '設定',
    remindersNav: '提醒',
    moreTitle: '設定',
    moreLead: '帳號、Pro、AI 助理與進階設定',
    moreAccount: '帳號',
    moreAccountDesc: '登入、同步與個人資料',
    morePro: 'Pro 方案',
    moreProDesc: '升級解鎖完整功能',
    morePets: '寵物與檔案',
    morePetsDesc: '寵物列表、基本資料、備份',
    moreArchive: '封存寵物',
    moreArchiveDesc: '查看或恢復已封存的寵物',
    moreAssistant: 'AI 照護助理',
    moreAssistantDesc: '快速分析、週報與隨口問',
    moreExport: '匯出與備份',
    moreExportDesc: '匯出 JSON 備份或還原資料',
    moreAdvanced: '進階設定',
    moreAdvancedDesc: 'AI 額度、備份與方案',
    moreDev: '開發功能',
    moreDevDesc: '本機測試用（僅開發模式）',
    moreBack: '返回設定',
    managePets: '管理寵物',
    catsPageTitle: '寵物管理',
    catsPageLead: '新增、編輯、封存寵物與共同照護',
    catsBack: '返回今日',
    remindersTodaySection: '今日提醒',
    remindersTodayEmpty: '今天沒有啟用中的提醒，可在下方「新增提醒」建立。',
    remindersEnabledSection: '已啟用提醒',
    remindersAddSection: '新增提醒',
    remindersListSection: '提醒列表',
    currentCat: '目前照顧',
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
    monthlyCareDescDog: '驅蟲、環境清潔、疫苗、看診這類不是每天做的項目',
    defaultPetName: '我的寵物',
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
    historyRoadmap: '快速跳轉仍可使用；免費版進階篩選與關鍵字為 Pro 功能，日期請用下方快捷（7 天／30 天／本月）。',
    historySearchTitle: '篩選與搜尋',
    historyAdvancedFilters: '進階篩選',
    historyHideFilters: '收合篩選',
    historyFilterAll: '全部',
    historyFilterAbnormal: '只看異常',
    historyFilterPhoto: '只看有照片',
    historyFilterNote: '只看有備註',
    historyFilterWeight: '只看有體重',
    historySearchPlaceholder: '搜尋異常、備註、體重或寵物名字…',
    historyDateStart: '起始日期',
    historyDateEnd: '結束日期',
    historyPreset7d: '最近 7 天',
    historyPreset30d: '最近 30 天',
    historyPresetMonth: '本月',
    historyTagAbnormal: '異常',
    historyTagPhoto: '照片',
    historyTagNote: '備註',
    historyTagWeight: '體重',
    historyNoResults: '找不到符合條件的紀錄',
    historyFreeSearchNote:
      '免費版可使用「最近 7 天／30 天／本月」篩選日期；關鍵字與進階篩選（異常、照片、備註、體重）為 Pro 功能。',
    historyUnlockFullSearch: '升級 Pro 解鎖完整搜尋',
    historyKeywordProHint: '🔒 關鍵字搜尋為 Pro 功能，點此升級',
    historyClearFilters: '清除篩選',
    noHistory: '目前還沒有這隻寵物的歷史紀錄',
    completed: '完成',
    vetReport: '獸醫報告',
    vetReportDesc: '整理寵物資料、體重趨勢、異常狀況、照片與備註，方便看診時給獸醫參考',
    copyForVet: '複製給獸醫',
    printPdf: '列印 / 存 PDF',
    noAbnormalHistory: '目前還沒有這隻寵物的異常紀錄',
    photo: '照片',
    todayNoteTitle: '今日備註',
    myCats: '我的寵物',
    catsDesc: '新增、切換不同寵物，每隻會分開保存紀錄，也可以編輯寵物個人資料',
    catProfile: '寵物個人資料',
    catProfileDesc: '基本資料、慢性病、過敏與常用獸醫院，之後可以一起整理給獸醫看',
    addCat: '新增寵物',
    catNamePlaceholder: '輸入寵物名字，例如：火火',
    petType: '寵物類型',
    petTypeCat: '貓',
    petTypeDog: '狗',
    add: '新增',
    catList: '寵物列表',
    selected: '目前選擇中',
    tapToSwitch: '點擊切換到這隻寵物',
    delete: '刪除',
    savedLocal: '紀錄與照片會保存在這台手機 / 電腦的瀏覽器內',
    backupTitle: '備份 / 匯出資料',
    backupDesc: '匯出目前所有寵物、每日紀錄、體重、照片與設定。資料會下載成 JSON 檔，換手機或清除瀏覽器前建議先備份。',
    exportBackup: '匯出備份',
    importBackup: '匯入備份',
    importBackupDesc: '匯入之前下載的 JSON 備份檔，會覆蓋目前瀏覽器中的寵物日曆資料。',
    exportDone: '備份檔已下載',
    importDone: '備份已匯入，頁面將重新整理',
    importFailed: '匯入失敗，請確認檔案是寵物日曆匯出的 JSON 備份',
    legalSectionTitle: '法律與隱私',
    legalSectionDesc: '查看完整隱私政策與服務條款。',
    legalPrivacyLink: '隱私政策',
    legalTermsLink: '服務條款',
    moreLegalPrivacy: '隱私政策',
    moreLegalPrivacyDesc: '了解我們如何收集與保護你的資料',
    moreLegalTerms: '服務條款',
    moreLegalTermsDesc: '使用本 App 的相關規範',
    langButton: 'EN',
    removePhoto: '刪除',
    close: '關閉',
    copied: '獸醫報告已複製，可以貼給獸醫或傳到 LINE',
    copyFailed: '複製失敗，請手動選取內容複製',
    noReport: '目前還沒有可以複製的報告內容',
    photoCannotCopy: '照片無法直接複製到文字訊息，請在獸醫報告頁面截圖或列印給獸醫。',
    needCatName: '請先輸入寵物名字',
    keepOneCat: '至少要保留一隻寵物',
    confirmArchiveCat: '確定要封存',
    archiveCatNote:
      '此寵物將從主畫面隱藏，\n歷史紀錄與照片仍會保留，\n之後可於封存寵物中恢復。',
    archive: '封存',
    restoreCat: '恢復',
    archivedCatsSection: '封存寵物',
    archivedCatsEmpty: '目前沒有封存的寵物',
    archivedCatsHint: '封存的寵物不會出現在主畫面，資料仍保留在雲端與本機。',
    catsCloudArchiveErr: '無法封存至雲端：',
    catsCloudRestoreErr: '無法恢復至雲端：',
    permanentlyDelete: '永久刪除',
    permanentDeleteTitle: '永久刪除此寵物？',
    permanentDeleteBody:
      '永久刪除後，\n此寵物的歷史紀錄、照片、AI 報告、\n提醒與照護資料都將無法恢復。',
    cancel: '取消',
    catsCloudPermanentDeleteErr: '無法從雲端永久刪除：',
    permanentDeleteBusy: '刪除中…',
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
    profileGenderTap: '點擊選擇性別',
    profileNeuteredTap: '點擊選擇結紮狀態',
    profilePickGenderTitle: '選擇性別',
    profilePickNeuteredTitle: '選擇結紮狀態',
    petGenderMale: '公',
    petGenderFemale: '母',
    petNeuteredYes: '已結紮',
    petNeuteredNo: '未結紮',
    chipNo: '晶片號碼',
    chronicNote: '慢性病 / 用藥',
    allergyNote: '過敏 / 禁忌',
    vetClinic: '常用獸醫院',
    profileNote: '其他備註',
    profilePhoto: '寵物照片',
    selectPhoto: '選擇照片',
    yearsOld: '歲',
    unknown: '未填',
    weightTitle: '體重紀錄',
    weightDesc: '記錄每次量到的體重，線圖可以看出變胖、變瘦或老年寵物體重下降趨勢',
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
    walkMorning: '早上散步',
    walkNight: '晚上散步',
    pee: '今天有尿尿',
    poop: '今天有大便',
    waterCan: '補水罐 / 飲水確認',
    snack: '零食確認',
    brushHair: '梳毛確認',
    brushTeeth: '刷牙確認',
    changeLitter: '本月換貓砂',
    changeLitterDog: '本月環境清潔確認',
    deworming: '本月驅蟲',
    vaccine: '疫苗 / 預防針確認',
    vetVisit: '看診 / 回診確認',
    bath: '本月洗澡確認',
    nailTrim: '剪指甲確認',
    catFood: '本月貓糧 / 貓砂補貨確認',
    dogFoodStock: '本月狗糧 / 尿墊補貨確認',
    assistantNav: '照護',
    assistantTitle: 'AI 照護助理',
    assistantLead: '依紀錄整理趨勢與提醒；僅供參考，不能取代獸醫。',
    assistantQuickSummary: '今日快覽',
    assistantCareReminders: '照護提醒（1～3 點）',
    assistantAsk: '隨口問問',
    assistantAskHint: '我會依你存的紀錄陪聊力所能及的小問題，無法代替看診。',
    assistantAskPlaceholder: '例如：這週喝水感覺怎樣？體重需要多留意嗎？',
    assistantSend: '送出',
    assistantReplyLabel: '回覆',
    aiChecking: '稍等一下…',
    assistantLocalSevenTitle: '本機週期快覽（非 AI）',
    assistantSevenExpandMore: '展開更多 ↓',
    assistantSevenCollapse: '收合 ↑',
    assistantAnalysisCardTitle: '快速照護分析',
    aiGenerateWeek: '取得快速照護提醒',
    aiAnalysisCardSubtitle: '只看今天與最近幾天，短文字 + 1～3 個照護提醒（非完整週報）。',
    aiBundleCurrentHint: '已有今日快速摘要，可直接查看',
    aiDataStaleHint: '資料已更新，可重新生成分析',
    aiNeedServerEnvDev: '小幫手暫時醒不過來，請確認本機環境已依說明啟動後重新整理。',
    aiNeedServerEnvProd: '小幫手暫時無法使用，請稍後再試；若剛完成設定，請稍待部署完成。',
    aiAssistantUnreachableDev: '目前連不上服務，請確認開發環境已啟動後重新整理。',
    aiAssistantUnreachableProd: '目前連不上服務，請稍後再試或重新整理頁面。',
    aiEmptyHint: '尚未取得快速提醒，點下方按鈕即可開始。',
    aiAskEmpty: '先寫下想問的內容好嗎？',
    aiOpenAiBusy: '正在整理…',
    aiOpenAiFail: '這次沒成功：',
    assistantSendBusy: '處理中…',
    aiQuotaLine: '今日 AI 次數：{{used}} / {{limit}}',
    aiQuotaExhaustedTitle: '今日 AI 次數已用完',
    aiQuotaExhaustedUpgradeFree: '升級 Pro 可獲得更多 AI 次數',
    aiQuotaProExhausted: 'Pro 方案今日 30 次 AI 已用完，請明日再試。',
    settingsTitle: '方案與設定',
    settingsAiQuotaTitle: '今日 AI 次數',
    settingsAiQuotaHint: '含獸醫報告「整理重點」、照護助理、週報與隨口問 AI；每日重新計算。',
    settingsBack: '返回設定',
    settingsOnboardingTitle: '使用導覽',
    settingsOnboardingDesc: '再次查看首次開啟 App 時的功能介紹。',
    settingsReplayOnboarding: '重新觀看導覽',
    authAccountSection: '帳號與登入',
    authNotConfigured: '雲端登入尚未開放。請確認伺服器已完成雲端連線設定後，重新整理此頁面。',
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
    authBootTitle: '正在確認登入狀態…',
    authErrGenericShort: '登入時發生問題，請稍後再試。',
    authErrNotConfigured: '尚未連線雲端服務。',
    authErrInvalid: '帳號或密碼不正確。',
    authErrEmailNotConfirmed: '請先到信箱完成驗證，再登入。',
    authErrAlreadyReg: '此信箱已註冊，請改為登入。',
    authErrWeak: '密碼不符合要求，請改用更長或更複雜的密碼。',
    authErrGeneric: '發生錯誤：',
    authErrMissingFields: '請輸入電子郵件與密碼。',
    authSignUpSent: '若註冊成功，請檢查信箱（含垃圾信）並完成驗證後再登入。',
    authSignedInOk: '登入成功。',
    authSignedOutOk: '已登出。',
    authLocalDataHint: '登入後會與雲端同步寵物、照護紀錄、照片、週報、提醒、AI 用量與協作狀態。',
    authAppleSignIn: '使用 Apple 登入',
    authAppleComingSoon: 'Apple 登入將於 iOS 正式版開放',
    authGoogleSignIn: '使用 Google 登入',
    authGoogleSetupHint:
      '若 Google 登入無反應：請至 Supabase Dashboard → Authentication → Providers → Google 啟用，並設定 Google OAuth Client ID 與 Secret；同時將本站網址與 /auth/callback 加入 Google Cloud 與 Supabase 的 Redirect 白名單。',
    offlineBanner: '目前離線，資料會先保存在本機',
    offlineSyncFailed: '部分資料同步失敗，請稍後重試',
    offlineSyncRetry: '重試同步',
    offlineSyncOk: '離線資料已同步至雲端',
    offlinePendingHint: '有待同步的離線變更',
    bootstrapInitFailed: '部分資料暫時無法載入，已改用本機資料。你可照常使用，稍後會自動再試同步。',
    bootstrapPreparing: '正在準備你的照護資料…',
    catsCloudLoading: '正在同步雲端寵物…',
    petsListSyncing: '正在整理寵物清單…',
    petsListSyncingHint: '同步完成後即可管理與封存寵物',
    catsCloudLoadErr: '雲端寵物載入失敗',
    archiveErrPermission: '你沒有封存這隻寵物的權限（可能為共同照護成員）。',
    cloudSyncLoading: '正在從雲端載入…',
    cloudSyncSyncing: '正在同步照護資料…',
    cloudSyncReady: '已與雲端同步',
    cloudSyncEmpty: '雲端尚無資料（本機資料已保留）',
    cloudSyncFailed: '同步失敗',
    syncErrorFriendly: '同步未完成，請檢查網路後重試。',
    syncToastSyncing: '正在同步資料…',
    syncToastFailed: '部分資料同步失敗，稍後將自動重試',
    toastSaved: '已儲存',
    toastSynced: '已同步',
    toastPhotoOk: '照片上傳成功',
    toastReminderCreated: '提醒已建立',
    toastArchived: '已封存',
    toastRestored: '已恢復',
    toastDeleted: '已刪除',
    toastAiReportDone: 'AI 報告產生完成',
    toastGenericError: '發生問題，請稍後再試。',
    photoUploading: '照片上傳中…',
    emptyPetsTitle: '新增第一隻寵物，開始記錄牠的日常照護',
    emptyPetsCta: '新增寵物',
    emptyHistoryTitle: '還沒有照護紀錄，今天完成一次照護後就會出現在這裡',
    emptyHistoryCta: '前往今日照護',
    emptyPhotosTitle: '還沒有照片，新增一張照片記錄可愛瞬間',
    emptyPhotosCta: '選擇照片',
    emptyRemindersTitle: '還沒有提醒，設定固定照護時間比較不容易忘記',
    emptyRemindersCta: '新增第一則提醒',
    emptyWeeklyTitle: '累積更多照護紀錄後，就能產生 AI 週報',
    emptyWeeklyCta: '前往今日填寫',
    cloudSyncRetry: '重試同步',
    cloudSyncPhotosNote: '照片與照護資料會加密同步至雲端（同一帳號跨裝置可見）。',
    catsCloudSaveErr: '無法寫入雲端：',
    catsCloudDeleteErr: '無法從雲端刪除：',
    careEventDailyUpdated: '更新了今日照護紀錄',
    settingsPlanSection: '訂閱方案',
    settingsPlanCurrent: '目前方案',
    settingsPlanFree: '免費版',
    settingsPlanPro: 'Pro',
    settingsPlanHint: '正式上架後將透過 App Store 訂閱；目前升級為測試開通，不會實際扣款。',
    settingsSwitchPro: '升級 Pro',
    settingsSwitchFree: '切回免費版',
    settingsPlanServerHint: '若畫面上顯示的方案狀態異常，可嘗試重新整理或重新登入帳號。',
    settingsPaymentNote: '正式上架後將透過 App Store 訂閱結帳。',
    restorePurchaseOk: '已恢復 Pro 訂閱（本機）',
    restorePurchaseNone: '找不到可恢復的購買紀錄',
    restorePurchaseFail: '恢復購買失敗，請稍後再試',
    purchaseProOk: '已開通 Pro（測試）',
    settingsClientIdCaption: '裝置識別（排除問題時可能會請你提供）',
    planMultiCatUpgrade: '免費版最多可新增 3 隻寵物。升級 Pro 可管理更多寵物，並享有更多 AI 次數與進階功能。',
    planFreeMultiCatBanner:
      '免費版最多支援 3 隻寵物。你目前的寵物數超過上限，請封存部分寵物或升級 Pro。',
    openSettings: '方案與設定',
    remindersTitle: '提醒',
    remindersBack: '返回更多',
    remindersLead: '本機瀏覽器通知（PWA / 開啟分頁時有效）。',
    remindersNotifyDenied: '尚未開啟通知權限',
    remindersNotifyEnable: '啟用提醒',
    remindersNotifyGranted: '通知已開啟',
    remindersNotifyUnsupported: '此裝置暫不支援通知',
    remindersNotifySectionTitle: '推播與通知',
    remindersNotifyStatusLabel: '通知權限狀態',
    remindersNotifyAllowedLabel: '是否已允許通知',
    remindersNotifyAllowedYes: '是',
    remindersNotifyAllowedNo: '否',
    remindersNotifyChannelLabel: '目前管道',
    remindersNotifyChannelLocal: '本機通知（Local）',
    remindersNotifyChannelRemoteHint: '遠端推播（APNs / FCM）將於正式版 App 啟用',
    remindersNotifyTest: '發送測試通知',
    remindersNotifyTestOk: '已發送測試通知',
    remindersNotifyTestFail: '無法發送，請先允許通知權限',
    remindersCount: '提醒數量',
    remindersAdd: '新增提醒',
    remindersAddCustom: '自訂提醒',
    remindersEmpty: '尚未設定提醒，可從上方快速新增。',
    remindersForCat: '寵物',
    remindersTime: '時間',
    remindersRepeat: '重複',
    remindersTitleField: '標題',
    remindersEnabled: '啟用',
    remindersDelete: '刪除',
    remindersSave: '儲存',
    remindersQuickAdd: '快速新增',
    remindersLimitFree: '免費版最多 3 則提醒；升級 Pro 可設定更多提醒。',
    remindersLimitReached: '已達提醒上限',
    remindersRepeatDaily: '每天',
    remindersRepeatWeekly: '每週',
    remindersRepeatMonthly: '每月',
    remindersRepeatOnce: '指定日期',
    remindersDueDate: '提醒日期',
    remindersUpcomingSection: '即將到期',
    remindersUpcomingEmpty: '沒有之後的指定日期提醒。',
    remindersInterval: '間隔',
    remindersTypeDaily: '每日照護',
    remindersTypeWeight: '體重',
    remindersTypeDeworming: '驅蟲',
    remindersTypeVet: '看獸醫',
    remindersTypeCustom: '自訂',
    sharedCareTitle: '共同照護',
    sharedCareNavHint: '與家人／室友共享同一隻寵物的紀錄，資料同步於雲端。',
    sharedCareBack: '返回',
    sharedCareCloudRequired: '請先登入並選擇已同步至雲端的寵物，才能使用共同照護。',
    sharedCareMembersTitle: '共享成員',
    sharedCareMembersEmpty: '目前尚無共同照護成員',
    sharedCareRoleOwner: '主人',
    sharedCareRoleMember: '成員',
    sharedCareRemoveMember: '移除',
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
    sharedCareJoinOk: '已成功加入共同照護',
    sharedCareJoinWrong: '邀請碼不正確或已失效。',
    sharedCareJoinDuplicate: '你已經是此寵物的成員。',
    sharedCareJoinNeedLogin: '請先登入後再輸入邀請碼。',
    sharedCareActivityTitle: '最近動態',
    sharedCareActivityEmpty: '目前尚無照護動態',
    sharedCareDisplayNameHint: '在共同照護與動態中顯示的名稱（同步至雲端帳號）',
    sharedCareDisplayNameLabel: '我的稱呼',
    sharedCareSaveName: '儲存',
    sharedCareOwnerOnly: '僅主人可執行此操作',
    sharedCareTodayFeedTitle: '今日照護動態',
    sharedCareTodayFeedEmpty: '目前尚無照護動態',
    sharedCareTodayFeedTap: '點開查看',
    sharedCareTodayFeedCollapse: '收合',
    sharedCareTodayFeedCount: '則動態',
    proTeaserHistorySearch: '歷史篩選與搜尋',
    proTeaserComing: '即將推出',
    proTeaserAdvancedWeekly: '進階 AI 週報',
    weeklyCardTitle: 'AI 週報',
    weeklyCardLead:
      'Pro 正式照護週報：完成度、趨勢、異常時間線、體重、與上週比較、下週重點；可儲存、匯出、分享（非診斷、不開藥）。',
    weeklyGenerateBtn: '生成本週 AI 週報',
    weeklySummaryTitle: '本週總結',
    weeklyCompletionTitle: '照護完成度',
    weeklyTrendsTitle: '趨勢',
    weeklyAbnormalTitle: '異常時間線',
    weeklyWeightTitle: '體重變化',
    weeklyVsLastTitle: '與上週比較',
    weeklyNextWeekTitle: '下週照護重點',
    weeklySave: '儲存週報',
    weeklyShare: '分享文字',
    weeklyExportPdf: '匯出 PDF',
    weeklyExportPng: '匯出圖片',
    weeklySavedOk: '週報已儲存於本機',
    weeklyShareOk: '已複製／分享週報文字',
    weeklyShareFail: '無法分享',
    weeklyExportProOnly: '匯出需 Pro',
    weeklyFailed: 'AI 週報暫時無法產生，請稍後再試。',
    weeklySectionEmpty: '此區塊尚無資料',
    weeklyBoundaryFail: '週報顯示發生錯誤，請重新生成或稍後再試。',
    weeklyFreePreview:
      '免費版可在此預覽週報功能說明。升級 Pro 後可一鍵產生完整 AI 週報（會使用 1 次今日 AI 次數）。',
    weeklyUpgrade: '升級 Pro 解鎖週報',
    proTeaserRoadmap: 'Pro 功能規劃中',
    proTeaserAdvancedVet: '進階獸醫報告',
    aiErrRate: '問得太快啦，休息一下再試。',
    aiAssistantGenericFail: 'AI 暫時無法回覆，請稍後再試。',
    aiDisclaimerFoot:
      '以上僅為照護觀察與提醒，不能取代獸醫診斷；若症狀持續或惡化，請諮詢獸醫。',
  },
  en: {
    appTitle: 'Pet Calendar',
    appSubtitle: '',
    navProBadge: 'Pro',
    today: 'Today',
    weight: 'Weight',
    history: 'History',
    vet: 'Vet',
    more: 'Settings',
    remindersNav: 'Reminders',
    moreTitle: 'Settings',
    moreLead: 'Account, Pro, AI assistant, and advanced options',
    moreAccount: 'Account',
    moreAccountDesc: 'Sign in, sync, and profile',
    morePro: 'Pro plan',
    moreProDesc: 'Unlock full features',
    morePets: 'Pets & data',
    morePetsDesc: 'Pet list, profile, and backup',
    moreArchive: 'Archived pets',
    moreArchiveDesc: 'View or restore archived pets',
    moreAssistant: 'AI care assistant',
    moreAssistantDesc: 'Quick analysis, weekly report, and Q&A',
    moreExport: 'Export & backup',
    moreExportDesc: 'Export JSON backup or restore data',
    moreAdvanced: 'Advanced settings',
    moreAdvancedDesc: 'AI quota, backup, and plan',
    moreDev: 'Developer',
    moreDevDesc: 'Local testing only (dev mode)',
    moreBack: 'Back to Settings',
    managePets: 'Manage pets',
    catsPageTitle: 'Pet management',
    catsPageLead: 'Add, edit, archive pets, and shared care',
    catsBack: 'Back to Today',
    remindersTodaySection: "Today's reminders",
    remindersTodayEmpty: 'No enabled reminders for today. Add one in the section below.',
    remindersEnabledSection: 'Enabled reminders',
    remindersAddSection: 'Add reminder',
    remindersListSection: 'All reminders',
    currentCat: 'Current cat',
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
    monthlyCareDesc: 'Deworming, litter change, vaccines, vet visits, and other periodic tasks',
    monthlyCareDescDog: 'Deworming, environment cleaning, vaccines, vet visits, and other periodic tasks',
    defaultPetName: 'My pet',
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
    historyRoadmap:
      'Jump-to-date still works. Advanced filters and keyword search are Pro; free plan uses quick ranges (7 / 30 days / this month).',
    historySearchTitle: 'Filter & search',
    historyAdvancedFilters: 'Advanced filters',
    historyHideFilters: 'Hide filters',
    historyFilterAll: 'All',
    historyFilterAbnormal: 'Abnormal only',
    historyFilterPhoto: 'With photos',
    historyFilterNote: 'With notes',
    historyFilterWeight: 'With weight',
    historySearchPlaceholder: 'Search notes, weight, or cat name…',
    historyDateStart: 'From',
    historyDateEnd: 'To',
    historyPreset7d: 'Last 7 days',
    historyPreset30d: 'Last 30 days',
    historyPresetMonth: 'This month',
    historyTagAbnormal: 'Abnormal',
    historyTagPhoto: 'Photo',
    historyTagNote: 'Note',
    historyTagWeight: 'Weight',
    historyNoResults: 'No records match your filters',
    historyFreeSearchNote:
      'Free plan: use Last 7 / 30 days / This month for dates. Keyword search and advanced chips (abnormal, photos, notes, weight) are Pro.',
    historyUnlockFullSearch: 'Upgrade to Pro for full search',
    historyKeywordProHint: '🔒 Keyword search is Pro — tap to upgrade',
    historyClearFilters: 'Clear filters',
    noHistory: 'No history for this pet yet',
    completed: 'Completed',
    vetReport: 'Vet report',
    vetReportDesc: 'Collect pet profile, weight trend, abnormal notes, photos, and daily notes for vet visits',
    copyForVet: 'Copy for vet',
    printPdf: 'Print / PDF',
    noAbnormalHistory: 'No abnormal records for this pet yet',
    photo: 'Photos',
    todayNoteTitle: 'Daily note',
    myCats: 'My pets',
    catsDesc: 'Add and switch pets. Each pet has separate records and profile details',
    catProfile: 'Pet profile',
    catProfileDesc: 'Basic info, chronic conditions, allergies, and preferred vet clinic',
    addCat: 'Add pet',
    catNamePlaceholder: 'Enter pet name, e.g. Momo',
    petType: 'Pet type',
    petTypeCat: 'Cat',
    petTypeDog: 'Dog',
    add: 'Add',
    catList: 'Pet list',
    selected: 'Selected',
    tapToSwitch: 'Tap to switch to this pet',
    delete: 'Delete',
    savedLocal: 'Records and photos are saved in this phone / computer browser',
    backupTitle: 'Backup / Export data',
    backupDesc: 'Export all pets, daily records, weights, photos, and settings as a JSON file. Please back up before switching phones or clearing browser data.',
    exportBackup: 'Export backup',
    importBackup: 'Import backup',
    importBackupDesc: 'Import a JSON backup file downloaded from Pet Calendar. This will overwrite current Pet Calendar data in this browser.',
    exportDone: 'Backup file downloaded',
    importDone: 'Backup imported. The page will reload.',
    importFailed: 'Import failed. Please choose a valid Pet Calendar JSON backup file.',
    legalSectionTitle: 'Legal & privacy',
    legalSectionDesc: 'Read the full privacy policy and terms of service.',
    legalPrivacyLink: 'Privacy policy',
    legalTermsLink: 'Terms of service',
    moreLegalPrivacy: 'Privacy policy',
    moreLegalPrivacyDesc: 'How we collect and protect your data',
    moreLegalTerms: 'Terms of service',
    moreLegalTermsDesc: 'Rules for using this app',
    langButton: '中',
    removePhoto: 'Remove',
    close: 'Close',
    copied: 'Vet report copied. You can paste it to your vet or LINE.',
    copyFailed: 'Copy failed. Please select and copy manually.',
    noReport: 'No report content to copy yet',
    photoCannotCopy: 'Photos cannot be copied into plain text. Please screenshot or print the Vet report page.',
    needCatName: 'Please enter a pet name first',
    keepOneCat: 'At least one pet is required',
    confirmArchiveCat: 'Archive',
    archiveCatNote:
      'This pet will be hidden from the main screen.\nHistory and photos are kept.\nYou can restore it from Archived pets.',
    archive: 'Archive',
    restoreCat: 'Restore',
    archivedCatsSection: 'Archived pets',
    archivedCatsEmpty: 'No archived pets',
    archivedCatsHint: 'Archived pets are hidden from the main screen; data stays in the cloud and on this device.',
    catsCloudArchiveErr: 'Could not archive in the cloud: ',
    catsCloudRestoreErr: 'Could not restore in the cloud: ',
    permanentlyDelete: 'Delete permanently',
    permanentDeleteTitle: 'Delete this pet permanently?',
    permanentDeleteBody:
      'After permanent deletion,\nall history, photos, AI reports,\nreminders, and care data for this pet cannot be recovered.',
    cancel: 'Cancel',
    catsCloudPermanentDeleteErr: 'Could not permanently delete from cloud: ',
    permanentDeleteBusy: 'Deleting…',
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
    profileGenderTap: 'Tap to select gender',
    profileNeuteredTap: 'Tap to select spay/neuter',
    profilePickGenderTitle: 'Select gender',
    profilePickNeuteredTitle: 'Spay / neuter status',
    petGenderMale: 'Male',
    petGenderFemale: 'Female',
    petNeuteredYes: 'Neutered',
    petNeuteredNo: 'Not neutered',
    chipNo: 'Microchip No.',
    chronicNote: 'Chronic conditions / medication',
    allergyNote: 'Allergies / restrictions',
    vetClinic: 'Preferred vet clinic',
    profileNote: 'Other notes',
    profilePhoto: 'Pet photo',
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
    walkMorning: 'Morning walk',
    walkNight: 'Evening walk',
    pee: 'Pee today',
    poop: 'Poop today',
    waterCan: 'Water / wet food check',
    snack: 'Snack check',
    brushHair: 'Brushing check',
    brushTeeth: 'Teeth brushing check',
    changeLitter: 'Monthly litter change',
    changeLitterDog: 'Monthly environment cleaning check',
    deworming: 'Deworming',
    vaccine: 'Vaccine check',
    vetVisit: 'Vet visit / follow-up',
    bath: 'Bath check',
    nailTrim: 'Nail trim check',
    catFood: 'Cat food / litter refill check',
    dogFoodStock: 'Dog food / pee pad refill check',
    assistantNav: 'Care',
    assistantTitle: 'AI Care Assistant',
    assistantLead: 'Trends from your logs; reference only—not vet advice.',
    assistantQuickSummary: 'Today at a glance',
    assistantCareReminders: 'Care reminders (1–3)',
    assistantAsk: 'Ask a small question',
    assistantAskHint: 'I answer from what you have saved — not a substitute for an exam.',
    assistantAskPlaceholder: 'Example: How did hydration feel this week?',
    assistantSend: 'Send',
    assistantReplyLabel: 'Reply',
    aiChecking: 'One moment…',
    assistantLocalSevenTitle: 'Local week glance (not AI)',
    assistantSevenExpandMore: 'Show more ↓',
    assistantSevenCollapse: 'Show less ↑',
    assistantAnalysisCardTitle: 'Quick care snapshot',
    aiGenerateWeek: 'Get quick care reminders',
    aiAnalysisCardSubtitle: 'Today + recent days only — short text and 1–3 reminders (not a full weekly report).',
    aiBundleCurrentHint: 'You already have today’s quick snapshot — see below.',
    aiDataStaleHint: 'Your logs changed — you can generate a fresh analysis.',
    aiNeedServerEnvDev: 'The companion is waking up — please start your local setup, then refresh.',
    aiNeedServerEnvProd: 'The companion is unavailable right now — try again shortly after setup finishes.',
    aiAssistantUnreachableDev: 'We could not reach the service — start your local environment and refresh.',
    aiAssistantUnreachableProd: 'We could not reach the service — please try again in a little while.',
    aiEmptyHint: 'No quick snapshot yet — tap the button below.',
    aiAskEmpty: 'Write a little question first.',
    aiOpenAiBusy: 'Putting it together…',
    aiOpenAiFail: 'Something went wrong: ',
    assistantSendBusy: 'Working…',
    aiQuotaLine: 'AI uses today: {{used}} / {{limit}}',
    aiQuotaExhaustedTitle: "Today's AI quota is used up.",
    aiQuotaExhaustedUpgradeFree: 'Upgrade to Pro for more daily AI uses.',
    aiQuotaProExhausted: 'All 30 Pro AI uses are used for today. Try again tomorrow.',
    settingsTitle: 'Plan & settings',
    settingsAiQuotaTitle: 'AI uses today',
    settingsAiQuotaHint: 'Shared across vet report highlights, care assistant, weekly report, and Q&A. Resets daily.',
    settingsBack: 'Back to Settings',
    settingsOnboardingTitle: 'App tour',
    settingsOnboardingDesc: 'Watch the first-launch introduction again.',
    settingsReplayOnboarding: 'Replay onboarding',
    authAccountSection: 'Account',
    authNotConfigured:
      'Cloud sign-in is not available yet. Make sure cloud connection is set up on the server, then refresh this page.',
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
    authBootTitle: 'Checking sign-in…',
    authErrGenericShort: 'Something went wrong while signing in. Please try again.',
    authErrNotConfigured: 'Cloud service is not connected.',
    authErrInvalid: 'Invalid email or password.',
    authErrEmailNotConfirmed: 'Please confirm your email from the inbox, then sign in.',
    authErrAlreadyReg: 'This email is already registered — try signing in.',
    authErrWeak: 'Password does not meet requirements — try a longer password.',
    authErrGeneric: 'Something went wrong: ',
    authErrMissingFields: 'Please enter email and password.',
    authSignUpSent: 'If signup succeeded, check your inbox (and spam), confirm your email, then sign in.',
    authSignedInOk: 'Signed in successfully.',
    authSignedOutOk: 'Signed out.',
    authLocalDataHint:
      'When signed in, pets, care logs, photos, weekly reports, reminders, AI usage, and shared care sync via the cloud.',
    authAppleSignIn: 'Sign in with Apple',
    authAppleComingSoon: 'Sign in with Apple will be available in the iOS app',
    authGoogleSignIn: 'Sign in with Google',
    authGoogleSetupHint:
      'If Google sign-in fails: enable Google under Supabase Dashboard → Authentication → Providers, add your OAuth Client ID and Secret, and allow this site URL and /auth/callback in both Google Cloud and Supabase redirect settings.',
    offlineBanner: 'You are offline — data is saved on this device first',
    offlineSyncFailed: 'Some offline changes could not sync. Try again.',
    offlineSyncRetry: 'Retry sync',
    offlineSyncOk: 'Offline changes synced to the cloud',
    offlinePendingHint: 'Offline changes waiting to sync',
    bootstrapInitFailed:
      'Some data could not load — using saved data on this device. You can keep using the app; sync will retry.',
    bootstrapPreparing: 'Preparing your care data…',
    catsCloudLoading: 'Syncing pets from the cloud…',
    petsListSyncing: 'Preparing your pet list…',
    petsListSyncingHint: 'You can manage and archive pets once sync finishes',
    catsCloudLoadErr: 'Could not load pets from the cloud',
    archiveErrPermission: 'You cannot archive this pet (shared care member).',
    cloudSyncLoading: 'Loading from cloud…',
    cloudSyncSyncing: 'Syncing care data…',
    cloudSyncReady: 'Synced with cloud',
    cloudSyncEmpty: 'No cloud data yet (local data kept)',
    cloudSyncFailed: 'Sync failed',
    syncErrorFriendly: 'Sync could not finish. Check your connection and try again.',
    syncToastSyncing: 'Syncing your data…',
    syncToastFailed: 'Some data could not sync. We will retry shortly.',
    toastSaved: 'Saved',
    toastSynced: 'Synced',
    toastPhotoOk: 'Photo uploaded',
    toastReminderCreated: 'Reminder created',
    toastArchived: 'Archived',
    toastRestored: 'Restored',
    toastDeleted: 'Deleted',
    toastAiReportDone: 'AI report is ready',
    toastGenericError: 'Something went wrong. Please try again.',
    photoUploading: 'Uploading photos…',
    emptyPetsTitle: 'Add your first pet to start logging daily care.',
    emptyPetsCta: 'Add a pet',
    emptyHistoryTitle: 'No care history yet. Complete today’s care once and it will show up here.',
    emptyHistoryCta: 'Go to Today',
    emptyPhotosTitle: 'No photos yet — add one to capture a cute moment.',
    emptyPhotosCta: 'Choose photos',
    emptyRemindersTitle: 'No reminders yet — scheduled nudges help you stay on track.',
    emptyRemindersCta: 'Add your first reminder',
    emptyWeeklyTitle: 'Log a bit more daily care to unlock the AI weekly report.',
    emptyWeeklyCta: 'Go to Today',
    cloudSyncRetry: 'Retry sync',
    cloudSyncPhotosNote: 'Photos and care data sync to the cloud for the same account on all devices.',
    catsCloudSaveErr: 'Could not save to the cloud: ',
    catsCloudDeleteErr: 'Could not delete from the cloud: ',
    careEventDailyUpdated: 'Updated today’s care log',
    settingsPlanSection: 'Subscription',
    settingsPlanCurrent: 'Current plan',
    settingsPlanFree: 'Free',
    settingsPlanPro: 'Pro',
    settingsPlanHint: 'After App Store launch, billing will go through Apple. For now you can enable Pro here to try all features.',
    settingsSwitchPro: 'Upgrade to Pro',
    settingsSwitchFree: 'Switch back to Free',
    settingsPlanServerHint: 'If your plan status looks wrong, try refreshing the page or signing in again.',
    settingsPaymentNote: 'Billing via the App Store after launch.',
    restorePurchaseOk: 'Pro subscription restored (on this device)',
    restorePurchaseNone: 'No purchases found to restore',
    restorePurchaseFail: 'Could not restore purchases. Try again later.',
    purchaseProOk: 'Pro enabled (test)',
    settingsClientIdCaption: 'Device ID (support may ask for this if something looks wrong)',
    planMultiCatUpgrade:
      'Free plan supports up to 3 pets. Upgrade to Pro to manage more pets and unlock higher AI limits and advanced tools.',
    planFreeMultiCatBanner:
      'Free plan supports up to 3 pets. You currently exceed that limit — archive some pets or upgrade to Pro.',
    openSettings: 'Plan & settings',
    remindersTitle: 'Reminders',
    remindersBack: 'Back to More',
    remindersLead: 'Local browser notifications (works in PWA while the app is open).',
    remindersNotifyDenied: 'Notification permission is off',
    remindersNotifyEnable: 'Enable reminders',
    remindersNotifyGranted: 'Notifications enabled',
    remindersNotifyUnsupported: 'Notifications are not supported on this device',
    remindersNotifySectionTitle: 'Push & notifications',
    remindersNotifyStatusLabel: 'Permission status',
    remindersNotifyAllowedLabel: 'Notifications allowed',
    remindersNotifyAllowedYes: 'Yes',
    remindersNotifyAllowedNo: 'No',
    remindersNotifyChannelLabel: 'Delivery channel',
    remindersNotifyChannelLocal: 'Local notifications',
    remindersNotifyChannelRemoteHint: 'Remote push (APNs / FCM) will ship with the native app',
    remindersNotifyTest: 'Send test notification',
    remindersNotifyTestOk: 'Test notification sent',
    remindersNotifyTestFail: 'Could not send — allow notifications first',
    remindersCount: 'Reminders',
    remindersAdd: 'Add reminder',
    remindersAddCustom: 'Custom reminder',
    remindersEmpty: 'No reminders yet — use quick add above.',
    remindersForCat: 'Pet',
    remindersTime: 'Time',
    remindersRepeat: 'Repeat',
    remindersTitleField: 'Title',
    remindersEnabled: 'On',
    remindersDelete: 'Delete',
    remindersSave: 'Save',
    remindersQuickAdd: 'Quick add',
    remindersLimitFree: 'Free plan: up to 3 reminders. Upgrade to Pro for more.',
    remindersLimitReached: 'Reminder limit reached',
    remindersRepeatDaily: 'Daily',
    remindersRepeatWeekly: 'Weekly',
    remindersRepeatMonthly: 'Monthly',
    remindersRepeatOnce: 'Specific date',
    remindersDueDate: 'Reminder date',
    remindersUpcomingSection: 'Upcoming',
    remindersUpcomingEmpty: 'No upcoming dated reminders.',
    remindersInterval: 'Every',
    remindersTypeDaily: 'Daily care',
    remindersTypeWeight: 'Weight',
    remindersTypeDeworming: 'Deworming',
    remindersTypeVet: 'Vet',
    remindersTypeCustom: 'Custom',
    sharedCareTitle: 'Shared care',
    sharedCareNavHint: 'Share one pet’s log with family or roommates. Data syncs via the cloud.',
    sharedCareBack: 'Back',
    sharedCareCloudRequired: 'Sign in and select a cloud-synced pet to use shared care.',
    sharedCareMembersTitle: 'Members',
    sharedCareMembersEmpty: 'No shared care members yet',
    sharedCareRoleOwner: 'Owner',
    sharedCareRoleMember: 'Member',
    sharedCareRemoveMember: 'Remove',
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
    sharedCareJoinOk: 'Joined shared care successfully',
    sharedCareJoinWrong: 'Invalid or expired invite code.',
    sharedCareJoinDuplicate: 'You are already a member of this cat.',
    sharedCareJoinNeedLogin: 'Sign in before entering an invite code.',
    sharedCareActivityTitle: 'Recent activity',
    sharedCareActivityEmpty: 'No care activity yet',
    sharedCareDisplayNameHint: 'Name shown in shared care and activity (saved to your account)',
    sharedCareDisplayNameLabel: 'My display name',
    sharedCareSaveName: 'Save',
    sharedCareOwnerOnly: 'Only the owner can do this',
    sharedCareTodayFeedTitle: 'Today’s care feed',
    sharedCareTodayFeedEmpty: 'No care activity yet',
    sharedCareTodayFeedTap: 'Tap to expand',
    sharedCareTodayFeedCollapse: 'Collapse',
    sharedCareTodayFeedCount: 'updates',
    proTeaserHistorySearch: 'History filter & search',
    proTeaserComing: 'Coming soon',
    proTeaserAdvancedWeekly: 'Advanced AI weekly report',
    weeklyCardTitle: 'AI weekly report',
    weeklyCardLead:
      'Pro formal weekly report: completion, trends, abnormal timeline, weight, vs last week, next-week focus — save, export, share (not diagnosis or meds).',
    weeklyGenerateBtn: 'Generate this week’s AI report',
    weeklySummaryTitle: 'This week',
    weeklyCompletionTitle: 'Logging completion',
    weeklyTrendsTitle: 'Trends',
    weeklyAbnormalTitle: 'Abnormal timeline',
    weeklyWeightTitle: 'Weight',
    weeklyVsLastTitle: 'vs last week',
    weeklyNextWeekTitle: 'Next week focus',
    weeklySave: 'Save report',
    weeklyShare: 'Share text',
    weeklyExportPdf: 'Export PDF',
    weeklyExportPng: 'Export image',
    weeklySavedOk: 'Report saved on this device',
    weeklyShareOk: 'Report text copied / shared',
    weeklyShareFail: 'Could not share',
    weeklyExportProOnly: 'Export requires Pro',
    weeklyFailed: 'The AI weekly report is temporarily unavailable. Please try again later.',
    weeklySectionEmpty: 'No data for this section yet',
    weeklyBoundaryFail: 'Could not display the report. Please regenerate or try again later.',
    weeklyFreePreview:
      'Free plan: you can read how the weekly report works here. Upgrade to Pro to generate the full AI weekly report (uses 1 of today’s AI uses).',
    weeklyUpgrade: 'Upgrade to Pro for weekly report',
    proTeaserRoadmap: 'Planned for Pro',
    proTeaserAdvancedVet: 'Advanced vet report',
    aiErrRate: 'A little too fast — take a short break and try again.',
    aiAssistantGenericFail: 'The assistant could not reply. Please try again later.',
    aiDisclaimerFoot:
      'The above is for care observation and reminders only — not a veterinary diagnosis. If symptoms persist or worsen, please consult a veterinarian.',
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

function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return formatDateLocal(d);
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

const DEFAULT_CATS: Cat[] = [
  {
    id: 'default-cat',
    name: '我的寵物',
    petType: 'cat',
    emoji: '🐱',
    isArchived: false,
    createdAt: new Date().toISOString(),
    ownerId: '',
  },
];

function loadCats(): Cat[] {
  return normalizeAndPersistCats();
}

function loadLang(): Lang {
  const saved = safeGetItem(LANG_KEY);
  return saved === 'en' ? 'en' : 'zh';
}

function loadDailyRecord(catId: string, date: string): DailyRecord {
  const key = dailyStorageKey(catId, date);
  const parsed = safeLoadJson<DailyRecord & { pending_sync?: boolean }>(key, {}, `daily ${date}`);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const { pending_sync: _pending, ...rest } = parsed;
  return rest;
}

function loadMonthlyRecord(catId: string, month: string): MonthlyRecord {
  const key = monthlyStorageKey(catId, month);
  const parsed = safeLoadJson<MonthlyRecord>(key, {}, `monthly ${month}`);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function loadWeightRecords(catId: string): WeightRecord[] {
  const key = weightStorageKey(catId);
  const parsed = safeLoadJson<unknown>(key, [], 'weights');
  if (!Array.isArray(parsed)) return [];

  return dedupeWeightRecordsByDate(
    parsed
      .map((item) => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const { pendingSync: _ps, ...rowClean } = row;
        return {
          id: typeof rowClean.id === 'string' ? rowClean.id : makeId(),
          date: typeof rowClean.date === 'string' ? rowClean.date : todayKey(),
          weight: Number(rowClean.weight),
          note: typeof rowClean.note === 'string' ? rowClean.note : '',
        };
      })
      .filter((item) => Number.isFinite(item.weight) && item.weight > 0)
  );
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

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const date = key.replace(prefix, '');
      const raw = safeGetItem(key);
      if (!raw) continue;
      const data = safeParseJson<DailyRecord>(raw, {}, `daily history ${date}`);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        records.push({ date, data });
      } else {
        safeRemoveItem(key);
      }
    }
  } catch (err) {
    storageError('getAllDailyHistory', err);
  }

  return records.sort((a, b) => b.date.localeCompare(a.date));
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
  return t.authErrGenericShort;
}

export default function App() {
  const bootstrap = useAppBootstrap();
  const skipBootstrapCloudSyncRef = useRef(bootstrap.cloudSyncDone);

  const today = todayKey();
  const month = monthKey();

  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [cats, setCats] = useState<Cat[]>(() => bootstrap.cats);
  const [petsBootReady, setPetsBootReady] = useState(() => bootstrap.cloudSyncDone);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const tr = text[lang];
  const { showToast } = useToast();

  const supabaseAuth = useSupabaseAuth();
  const authDisplayLabel = useMemo(() => {
    const u = supabaseAuth.user;
    if (!u) return '';
    const n = supabaseAuth.profile?.display_name?.trim();
    return n || u.email || '';
  }, [supabaseAuth.user, supabaseAuth.profile]);

  const [selectedCatId, setSelectedCatId] = useState<string>(() => bootstrap.selectedCatId);

  const activeCats = useMemo(() => cats.filter((c) => !c.isArchived), [cats]);
  const archivedCats = useMemo(() => cats.filter((c) => c.isArchived), [cats]);
  const selectedCat =
    activeCats.find((cat) => cat.id === selectedCatId) ?? activeCats[0] ?? DEFAULT_CATS[0];

  useEffect(() => {
    if (activeCats.length === 0) return;
    if (!activeCats.some((c) => c.id === selectedCatId)) {
      setSelectedCatId(activeCats[0].id);
    }
  }, [activeCats, selectedCatId]);

  useEffect(() => {
    if (cats.length > 0) return;
    const fallback = loadCats();
    setCats(fallback);
    const nextActive = fallback.filter((c) => !c.isArchived);
    const nextId = nextActive[0]?.id ?? fallback[0]?.id ?? DEFAULT_CATS[0].id;
    setSelectedCatId(nextId);
    safeSetItem(CATS_STORAGE_KEY, JSON.stringify(fallback));
    safeSetItem(SELECTED_CAT_KEY, nextId);
  }, [cats.length]);

  const useCloudDaily = useMemo(
    () =>
      Boolean(supabaseAuth.user && supabaseAuth.supabase && selectedCat && isCloudCatId(selectedCat.id)),
    [supabaseAuth.user, supabaseAuth.supabase, selectedCat?.id]
  );

  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingDone());
  const [page, setPage] = useState<Page>('today');
  const [newCatName, setNewCatName] = useState('');
  const [addCatNameError, setAddCatNameError] = useState<string | null>(null);
  const [newCatPetType, setNewCatPetType] = useState<PetType>('cat');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [historyJumpDate, setHistoryJumpDate] = useState('');
  const [historyJumpHint, setHistoryJumpHint] = useState<string | null>(null);
  const [historyFabVisible, setHistoryFabVisible] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterChip>('all');
  const [historyKeyword, setHistoryKeyword] = useState('');
  const [historyDateStart, setHistoryDateStart] = useState('');
  const [historyDateEnd, setHistoryDateEnd] = useState('');
  const [historyDatePreset, setHistoryDatePreset] = useState<HistoryDatePreset>('none');
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>(() => bootstrap.reminders);
  const [notificationPerm, setNotificationPerm] = useState(() => getNotificationPermission());
  const isOnline = useOnlineStatus();
  const [offlineSyncError, setOfflineSyncError] = useState<string | null>(null);
  const [offlineSyncBusy, setOfflineSyncBusy] = useState(false);
  const [appleSignInNotice, setAppleSignInNotice] = useState<string | null>(null);
  const [googleOauthBusy, setGoogleOauthBusy] = useState(false);
  const [profileFieldPicker, setProfileFieldPicker] = useState<'gender' | 'neutered' | null>(null);
  const [reminderLimitHint, setReminderLimitHint] = useState<string | null>(null);
  const [customReminderTitle, setCustomReminderTitle] = useState('');
  const [customReminderTime, setCustomReminderTime] = useState('09:00');
  const [customReminderRepeat, setCustomReminderRepeat] = useState<ReminderRepeatType>('daily');
  const [customReminderDueDate, setCustomReminderDueDate] = useState(() => defaultDueDateDaysFromNow(7));
  const [customReminderInterval, setCustomReminderInterval] = useState(1);
  const [customReminderCatId, setCustomReminderCatId] = useState<string>(() => selectedCatId);
  const [aiClientId] = useState(() => bootstrap.aiClientId);
  const [appPlan, setAppPlan] = useState<AppPlan>(() => bootstrap.appPlan);
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const maxDailyPhotos = useMemo(() => getMaxDailyPhotos(appPlan), [appPlan]);
  const [premiumSheetOpen, setPremiumSheetOpen] = useState(false);
  const [premiumSheetReason, setPremiumSheetReason] = useState<PremiumUpsellReason>('general');
  const [aiPremiumCardVisible, setAiPremiumCardVisible] = useState(false);
  const completeOnboarding = useCallback(() => {
    markOnboardingDone();
    setShowOnboarding(false);
    trackEvent('onboarding_complete');
  }, []);

  const replayOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  const openPremium = useCallback((reason: PremiumUpsellReason = 'general') => {
    setPremiumSheetReason(reason);
    setPremiumSheetOpen(true);
    trackEvent('premium_view', { reason });
  }, []);

  const handlePurchasePro = useCallback(
    async (period: BillingPeriod) => {
      trackEvent('premium_upgrade_click', { source: period });
      setSubscriptionBusy(true);
      const result = await purchasePro(period);
      setSubscriptionBusy(false);
      if (result.ok) {
        persistAppPlan('pro');
        setPremiumSheetOpen(false);
        showToast(tr.purchaseProOk, 'success');
      }
    },
    [showToast, tr.purchaseProOk]
  );

  const handleRestorePurchases = useCallback(async () => {
    setSubscriptionBusy(true);
    const result = await restorePurchases();
    setSubscriptionBusy(false);
    if (result.ok) {
      persistAppPlan('pro');
      setPremiumSheetOpen(false);
      showToast(tr.restorePurchaseOk, 'success');
      return;
    }
    if (result.errorCode === 'NO_PURCHASES' || result.errorCode === 'IAP_NOT_CONFIGURED') {
      showToast(tr.restorePurchaseNone, 'error');
    } else {
      showToast(tr.restorePurchaseFail, 'error');
    }
  }, [showToast, tr.restorePurchaseOk, tr.restorePurchaseNone, tr.restorePurchaseFail]);
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

  const [catRolesMap, setCatRolesMap] = useState<Record<string, CatAccessRole>>(() => bootstrap.catRolesMap);
  const [sharedCareMembers, setSharedCareMembers] = useState<SharedCareMember[]>([]);
  const [sharedCareInviteCode, setSharedCareInviteCode] = useState<string | null>(null);
  const [selectedCatRole, setSelectedCatRole] = useState<CatAccessRole>(null);
  const [sharedCareBusy, setSharedCareBusy] = useState(false);
  const [sharedCareJoinInput, setSharedCareJoinInput] = useState('');
  const [sharedCareFeedback, setSharedCareFeedback] = useState<string | null>(null);
  const [sharedCareCopied, setSharedCareCopied] = useState(false);
  const [sharedCareDisplayNameInput, setSharedCareDisplayNameInput] = useState('');
  const inviteUrlHandledRef = useRef(false);
  const [todayCareFeedOpen, setTodayCareFeedOpen] = useState(false);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Cat | null>(null);
  const [permanentDeleteBusy, setPermanentDeleteBusy] = useState(false);
  const sharedCareCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyCatsState = useCallback(
    (merged: Cat[], options?: { preferredSelectedId?: string }) => {
      safeSetItem(CATS_STORAGE_KEY, JSON.stringify(merged));
      setCats(merged);
      const active = merged.filter((c) => !c.isArchived);
      const preferred = options?.preferredSelectedId;
      setSelectedCatId((prev) => {
        const candidate = preferred ?? prev;
        if (candidate && active.some((c) => c.id === candidate)) return candidate;
        return active[0]?.id ?? merged[0]?.id ?? prev;
      });
    },
    []
  );

  const reloadCatsFromCloud = useCallback(async (): Promise<Cat[]> => {
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user?.id;
    if (!sb || !uid) return cats;
    const { data: cloudList, error } = await fetchCatsForUser(sb);
    if (error) {
      console.warn('[cats refresh]', error.message);
      return cats;
    }
    const localCats = normalizeAllCats(loadRawCatsFromStorage(), uid);
    const localFiltered = localCats.filter(
      (c) => !isCloudCatId(c.id) || cloudList.some((x) => x.id === c.id)
    );
    const merged = mergeAndNormalizeCats(cloudList, localFiltered, uid);
    applyCatsState(merged);
    const { data: roles } = await fetchMyCatRolesMap(sb, uid);
    setCatRolesMap(roles);
    return merged;
  }, [cats, supabaseAuth.supabase, supabaseAuth.user?.id, applyCatsState]);

  const refreshSharedCareForCat = useCallback(
    async (catId: string) => {
      const sb = supabaseAuth.supabase;
      const uid = supabaseAuth.user?.id;
      if (!sb || !uid || !isCloudCatId(catId)) {
        setSharedCareMembers([]);
        setSharedCareInviteCode(null);
        setSelectedCatRole(null);
        return;
      }
      setSharedCareBusy(true);
      const [membersRes, codeRes, roleRes, eventsRes] = await Promise.all([
        fetchCatMembersWithProfiles(sb, catId),
        fetchActiveInviteCodeForCat(sb, catId),
        fetchMyRoleForCat(sb, catId, uid),
        fetchCareEventsForCat(sb, catId),
      ]);
      setSharedCareBusy(false);
      if (!membersRes.error) setSharedCareMembers(membersRes.data);
      if (!codeRes.error) setSharedCareInviteCode(codeRes.code);
      if (!roleRes.error) setSelectedCatRole(roleRes.role);
      if (!eventsRes.error) setCloudCareEvents(eventsRes.data);
    },
    [supabaseAuth.supabase, supabaseAuth.user?.id]
  );

  const flashSharedCareCopied = useCallback(() => {
    setSharedCareCopied(true);
    if (sharedCareCopyTimerRef.current) clearTimeout(sharedCareCopyTimerRef.current);
    sharedCareCopyTimerRef.current = setTimeout(() => setSharedCareCopied(false), 2000);
  }, []);

  const scrollToSharedCareSection = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById('shared-care-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const canManageCatLifecycle = useCallback(
    (catId: string) => !isCloudCatId(catId) || catRolesMap[catId] === 'owner',
    [catRolesMap]
  );

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayNameReg, setAuthDisplayNameReg] = useState('');
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authFormError, setAuthFormError] = useState<string | null>(null);
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  const [archiveErrByCatId, setArchiveErrByCatId] = useState<Record<string, string>>({});
  const [catsCloudBusy, setCatsCloudBusy] = useState(false);
  const [catsCloudErr, setCatsCloudErr] = useState<string | null>(null);
  const [cloudSyncPhase, setCloudSyncPhase] = useState<CloudSyncPhase>('idle');
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [cloudSyncTick, setCloudSyncTick] = useState(0);
  const [photoUploadBusy, setPhotoUploadBusy] = useState(false);
  const prevCloudPhaseRef = useRef<CloudSyncPhase>('idle');
  const [cloudCareEvents, setCloudCareEvents] = useState<CareEventRow[]>([]);
  const lastCloudDailyStripRef = useRef('');
  const cloudDailyFetchSeqRef = useRef(0);
  const cloudDailyHydratingRef = useRef(false);
  const cloudDailyHydratedRef = useRef(false);
  const cloudSyncRunRef = useRef(0);

  useEffect(() => {
    const prev = prevCloudPhaseRef.current;
    const cur = cloudSyncPhase;
    const isActive = cur === 'loading' || cur === 'syncing';
    const wasActive = prev === 'loading' || prev === 'syncing';
    if (isActive && !wasActive) {
      showToast(tr.syncToastSyncing, 'info', { position: 'top', durationMs: 2000 });
    }
    if (cur === 'failed' && prev !== 'failed') {
      showToast(tr.syncToastFailed, 'warning', { position: 'top', durationMs: 4000 });
    }
    prevCloudPhaseRef.current = cur;
  }, [cloudSyncPhase, showToast, tr.syncToastSyncing, tr.syncToastFailed]);

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

  const selectedPetType = selectedCat?.petType ?? 'cat';
  const dailyItemsForPet = useMemo(
    () => getDailyItemsForPetType(selectedPetType),
    [selectedPetType]
  );

  const monthlyItemsForPet = useMemo(
    () => getMonthlyItemsForPetType(selectedPetType),
    [selectedPetType]
  );

  const dailyDone = useMemo(
    () => dailyItemsForPet.filter((item) => daily[item.id] === true).length,
    [daily, dailyItemsForPet]
  );

  const monthlyDone = useMemo(
    () => monthlyItemsForPet.filter((item) => monthly[item.id]).length,
    [monthly, monthlyItemsForPet]
  );

  const dailyPercent = Math.round((dailyDone / dailyItemsForPet.length) * 100);
  const monthlyPercent = Math.round((monthlyDone / monthlyItemsForPet.length) * 100);

  const history = useMemo(() => {
    historyRefreshKey;
    if (!selectedCat) return [];
    return getAllDailyHistory(selectedCat.id);
  }, [historyRefreshKey, selectedCat]);

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

  const historySearchMode = useMemo(
    () =>
      isHistorySearchModeActive({
        filter: historyFilter,
        keyword: historyKeyword,
        dateStart: historyDateStart,
        dateEnd: historyDateEnd,
      }),
    [historyFilter, historyKeyword, historyDateStart, historyDateEnd]
  );

  const historySearchHits = useMemo((): HistorySearchHit[] => {
    if (!selectedCat || !historySearchMode) return [];
    const effFilter: HistoryFilterChip = appPlan === 'free' ? 'all' : historyFilter;
    const effKeyword = appPlan === 'free' ? '' : historyKeyword;
    let dateStart = historyDateStart.trim();
    let dateEnd = historyDateEnd.trim();
    if (appPlan === 'free' && historyDatePreset === 'none') {
      dateStart = '';
      dateEnd = '';
    }
    if (dateEnd && dateEnd > today) dateEnd = today;
    return searchHistory({
      catName: selectedCat.name,
      dailyRows: history,
      weightRows: weightRecords.map((w) => ({ date: w.date, weight: w.weight, note: w.note })),
      filter: effFilter,
      keyword: effKeyword,
      dateStart,
      dateEnd,
    });
  }, [
    selectedCat,
    history,
    weightRecords,
    historyFilter,
    historyKeyword,
    historyDateStart,
    historyDateEnd,
    historyDatePreset,
    historySearchMode,
    appPlan,
    today,
  ]);

  const historyHitDateSet = useMemo(
    () => new Set(historySearchHits.map((h) => h.date)),
    [historySearchHits]
  );

  const historyMonthGroupsFiltered = useMemo(() => {
    if (!historySearchMode || historySearchHits.length === 0) return [];
    return historyMonthGroups
      .map((g) => ({
        ...g,
        records: g.records.filter((r) => historyHitDateSet.has(r.date)),
      }))
      .filter((g) => g.records.length > 0);
  }, [historyMonthGroups, historySearchMode, historySearchHits.length, historyHitDateSet]);

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
      petType: selectedCat.petType,
      cat: {
        name: selectedCat.name,
        emoji: selectedCat.emoji,
        petType: selectedCat.petType,
        birthday: selectedCat.birthday,
        breed: selectedCat.breed,
        gender: selectedCat.gender,
        neutered: selectedCat.neutered,
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
  const [aiWeeklyReport, setAiWeeklyReport] = useState<AssistantWeeklyReportJson | null>(null);
  const [aiWeeklyLoading, setAiWeeklyLoading] = useState(false);
  const [weeklyErr, setWeeklyErr] = useState<string | null>(null);
  const [openAiErr, setOpenAiErr] = useState<string | null>(null);
  const [assistantApiReady, setAssistantApiReady] = useState<boolean | null>(null);
  /** false = health fetch failed; true = got JSON (openaiReady may still be false). */
  const [assistantHealthReachable, setAssistantHealthReachable] = useState<boolean | null>(null);
  const [assistantQuota, setAssistantQuota] = useState<AssistantHealthPayload | null>(
    () => bootstrap.assistantQuota
  );
  const persistAppPlan = (p: AppPlan) => {
    if (p === 'free') downgradeToFree();
    else setSubscriptionStatus('pro', { source: 'test' });
    setAppPlan(getSubscriptionStatus());
    if (p === 'free') {
      setHistoryKeyword('');
      setHistoryFilter('all');
    }
    setAssistantQuota((prev) => applyLocalAssistantQuota(p, aiClientId, today, prev));
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user?.id;
    if (sb && uid) {
      void upsertUserAiPlan(sb, uid, p).then(({ error }) => {
        if (error) console.warn('[user_preferences upsert]', error.message);
      });
    }
    if (sb && uid) {
      void reloadCatsFromCloud();
    } else {
      const uidLocal = '';
      const boot = normalizeAndPersistCats(uidLocal);
      applyCatsState(boot);
    }
  };

  const pushAiUsageIfCloud = useCallback(() => {
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user?.id;
    if (sb && uid) void pushAiUsageSnapshot(sb, uid, today);
  }, [supabaseAuth.supabase, supabaseAuth.user?.id, today]);

  const refreshAssistantQuotaFromLocal = useCallback(() => {
    setAssistantQuota((prev) => applyLocalAssistantQuota(appPlan, aiClientId, today, prev));
  }, [appPlan, aiClientId, today, applyLocalAssistantQuota]);

  const notifyAiQuotaExhausted = useCallback(() => {
    showToast(aiQuotaExhaustedMessage(lang, appPlan), 'error');
  }, [showToast, lang, appPlan]);

  const cloudSaveWeeklyReport = useCallback(
    (catId: string, weekEnd: string, report: AssistantWeeklyReportJson) => {
      saveWeeklyReport(catId, weekEnd, report, lang);
      const sb = supabaseAuth.supabase;
      const uid = supabaseAuth.user?.id;
      if (!sb || !uid || !isCloudCatId(catId)) return;
      const saved: SavedWeeklyReport = {
        catId,
        weekEnd,
        savedAt: new Date().toISOString(),
        report: normalizeWeeklyReport(report, lang),
      };
      void pushWeeklyReportToCloud(sb, uid, saved);
    },
    [lang, supabaseAuth.supabase, supabaseAuth.user?.id]
  );
  const summariesAbortRef = useRef<AbortController | null>(null);
  const qaAbortRef = useRef<AbortController | null>(null);
  const weeklyAbortRef = useRef<AbortController | null>(null);
  const weeklyReportRef = useRef<HTMLDivElement | null>(null);
  const [weeklySaveHint, setWeeklySaveHint] = useState<string | null>(null);

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
    setAiWeeklyReport(null);
    setWeeklyErr(null);
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

  useEffect(() => {
    if (page !== 'assistant' || appPlan !== 'pro') return;
    const ctx = assistantContext;
    if (!ctx) return;
    const saved = loadSavedWeeklyReport(ctx.catId, ctx.today);
    if (saved?.report) setAiWeeklyReport(normalizeWeeklyReport(saved.report, lang));
  }, [page, appPlan, assistantContext?.catId, assistantContext?.today, lang]);

  useEffect(
    () => () => {
      summariesAbortRef.current?.abort();
      qaAbortRef.current?.abort();
      weeklyAbortRef.current?.abort();
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
      notifyAiQuotaExhausted();
      setOpenAiErr(null);
      setAiBundleLoading(false);
      return;
    }
    try {
      const { bundle, quota } = await generateAssistantCareBundleOpenAi(ctx, meta, ac.signal);
      setAiCareBundle(bundle);
      setAiBundleSavedHash(getCareBundleContextHash(ctx));
      trackEvent('ai_used', { feature: 'care_bundle' });
      showToast(tr.toastAiReportDone, 'success');
      if (quota) {
        setAssistantQuota((prev) =>
          mergeAssistantQuotaFromSnapshot(prev, quota, appPlan, aiClientId, ctx.today)
        );
        pushAiUsageIfCloud();
      }
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      if (e instanceof AssistantApiError) {
        if (e.code === 'QUOTA') {
          notifyAiQuotaExhausted();
          refreshAssistantQuotaFromLocal();
          setOpenAiErr(null);
        } else if (e.code === 'RATE') setOpenAiErr(text[lang].aiErrRate);
        else if (e.code === 'OPENAI') setOpenAiErr(text[lang].aiAssistantGenericFail);
        else if (e.code === 'NO_API_KEY') setOpenAiErr(aiStatusHint(lang, 'key'));
        else setOpenAiErr(text[lang].aiAssistantGenericFail);
      } else {
        setOpenAiErr(text[lang].aiAssistantGenericFail);
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
    notifyAiQuotaExhausted,
    refreshAssistantQuotaFromLocal,
    showToast,
    tr.toastAiReportDone,
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
      notifyAiQuotaExhausted();
      setOpenAiErr(null);
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
      trackEvent('ai_used', { feature: 'qa' });
      if (!quota) {
        showToast(
          lang === 'zh' ? 'AI 次數資料尚未載入，請稍後再試' : 'AI quota data is not ready yet. Please try again.',
          'error'
        );
        return;
      }
      setAssistantQuota((prev) =>
        mergeAssistantQuotaFromSnapshot(prev, quota, appPlan, aiClientId, ctx.today)
      );
      pushAiUsageIfCloud();
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      if (e instanceof AssistantApiError) {
        if (e.code === 'QUOTA') {
          notifyAiQuotaExhausted();
          refreshAssistantQuotaFromLocal();
          setOpenAiErr(null);
        } else if (e.code === 'RATE') setOpenAiErr(text[lang].aiErrRate);
        else if (e.code === 'OPENAI') setOpenAiErr(text[lang].aiAssistantGenericFail);
        else if (e.code === 'NO_API_KEY') setOpenAiErr(aiStatusHint(lang, 'key'));
        else setOpenAiErr(text[lang].aiAssistantGenericFail);
      } else {
        setOpenAiErr(text[lang].aiAssistantGenericFail);
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
    notifyAiQuotaExhausted,
    refreshAssistantQuotaFromLocal,
  ]);

  const runOpenAiWeeklyReport = useCallback(async () => {
    const ctx = assistantContext;
    if (!ctx || appPlan !== 'pro') return;
    if (assistantApiReady !== true) {
      setWeeklyErr(
        assistantHealthReachable === false ? aiStatusHint(lang, 'off') : aiStatusHint(lang, 'key')
      );
      return;
    }
    if (isAssistantDailyQuotaExhausted(assistantQuota)) {
      notifyAiQuotaExhausted();
      setWeeklyErr(null);
      return;
    }
    weeklyAbortRef.current?.abort();
    const ac = new AbortController();
    weeklyAbortRef.current = ac;
    setAiWeeklyLoading(true);
    setWeeklyErr(null);
    try {
      const { report, quota } = await generateAssistantWeeklyReportOpenAi(
        ctx,
        {
          clientId: aiClientId,
          catId: ctx.catId,
          usageDate: ctx.today,
          plan: appPlan,
        },
        ac.signal
      );
      const safeReport = normalizeWeeklyReport(report, lang);
      setAiWeeklyReport(safeReport);
      cloudSaveWeeklyReport(ctx.catId, ctx.today, safeReport);
      showToast(tr.toastAiReportDone, 'success');
      setWeeklySaveHint(text[lang].weeklySavedOk);
      if (!quota) {
        showToast(
          lang === 'zh' ? 'AI 次數資料尚未載入，請稍後再試' : 'AI quota data is not ready yet. Please try again.',
          'error'
        );
        return;
      }
      setAssistantQuota((prev) =>
        mergeAssistantQuotaFromSnapshot(prev, quota, appPlan, aiClientId, ctx.today)
      );
      pushAiUsageIfCloud();
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      setAiWeeklyReport(null);
      if (e instanceof AssistantApiError) {
        if (e.code === 'QUOTA') {
          notifyAiQuotaExhausted();
          refreshAssistantQuotaFromLocal();
          setWeeklyErr(null);
        } else if (e.code === 'RATE') setWeeklyErr(text[lang].aiErrRate);
        else if (e.code === 'NO_API_KEY') setWeeklyErr(aiStatusHint(lang, 'key'));
        else setWeeklyErr(tr.weeklyFailed);
      } else {
        setWeeklyErr(tr.weeklyFailed);
      }
    } finally {
      setAiWeeklyLoading(false);
    }
  }, [
    assistantContext,
    appPlan,
    lang,
    text,
    assistantApiReady,
    assistantHealthReachable,
    aiClientId,
    assistantQuota,
    notifyAiQuotaExhausted,
    refreshAssistantQuotaFromLocal,
    cloudSaveWeeklyReport,
    showToast,
    tr.toastAiReportDone,
    pushAiUsageIfCloud,
  ]);

  const latestWeight = weightRecords[0];
  const oldestRecentWeight = weightRecords[Math.min(weightRecords.length - 1, 4)];
  const recentWeightChange =
    latestWeight && oldestRecentWeight && latestWeight.id !== oldestRecentWeight.id
      ? latestWeight.weight - oldestRecentWeight.weight
      : 0;

  const catNameById = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c.name])),
    [cats]
  );
  const reminderLimit = getReminderLimit(appPlan);

  const reloadSelectedCatFromLocal = useCallback((catId: string) => {
    const d = todayKey();
    const mk = monthKey();
    setDaily(loadDailyRecord(catId, d));
    setMonthly(loadMonthlyRecord(catId, mk));
    setWeightRecords(loadWeightRecords(catId));
    setHistoryRefreshKey((k) => k + 1);
  }, []);

  const runFullCloudSync = useCallback(
    async (
      mergedCats: Cat[],
      accessibleCloudCatIds: string[],
      sb: NonNullable<typeof supabaseAuth.supabase>,
      userId: string
    ) => {
      const runId = ++cloudSyncRunRef.current;
      const accessible = new Set(accessibleCloudCatIds);
      const cloudIds = mergedCats
        .filter((c) => isCloudCatId(c.id) && accessible.has(c.id))
        .map((c) => c.id);
      cloudDailyHydratedRef.current = false;
      if (cloudIds.length === 0) {
        setCloudSyncPhase('empty');
        setCloudSyncError(null);
        cloudDailyHydratedRef.current = true;
        return;
      }
      setCloudSyncPhase('syncing');
      setCloudSyncError(null);
      const usageDate = todayKey();
      const pull = await pullCloudDataIntoLocal(sb, userId, cloudIds, usageDate);
      if (runId !== cloudSyncRunRef.current) return;
      const pushErrs = await pushLocalDataToCloud(sb, userId, cloudIds, loadReminders(), usageDate);
      if (runId !== cloudSyncRunRef.current) return;
      setReminders(loadReminders());
      setAppPlan(getAiPlan());
      setAssistantQuota((prev) => applyLocalAssistantQuota(getAiPlan(), aiClientId, usageDate, prev));
      const errs = [...pull.errors, ...pushErrs].filter(Boolean);
      if (errs.length > 0) {
        setCloudSyncPhase('failed');
        setCloudSyncError(errs.slice(0, 2).join(' · '));
      } else {
        const total =
          pull.dailyDates +
          pull.weights +
          pull.months +
          pull.photoDates +
          pull.weeklyReports +
          pull.reminders;
        setCloudSyncPhase(total > 0 ? 'ready' : 'empty');
        setCloudSyncError(null);
      }
      setCloudSyncTick((t) => t + 1);
      cloudDailyHydratedRef.current = true;
      const { data: cloudList, error: catsErr } = await fetchCatsForUser(sb);
      if (runId !== cloudSyncRunRef.current) return;
      if (!catsErr && cloudList) {
        const localNorm = normalizeAllCats(loadRawCatsFromStorage(), userId);
        const localFiltered = localNorm.filter(
          (c) => !isCloudCatId(c.id) || cloudList.some((x) => x.id === c.id)
        );
        const refreshed = mergeAndNormalizeCats(cloudList, localFiltered, userId);
        applyCatsState(refreshed);
        const { data: roles } = await fetchMyCatRolesMap(sb, userId);
        setCatRolesMap(roles);
      }
    },
    [aiClientId, applyLocalAssistantQuota, applyCatsState]
  );

  const persistReminders = useCallback(
    (list: Reminder[]) => {
      saveReminders(list);
      setReminders(list);
      const sb = supabaseAuth.supabase;
      const uid = supabaseAuth.user?.id;
      if (sb && uid) {
        void upsertUserReminders(sb, uid, list).then(({ error }) => {
          if (error) console.warn('[user_reminders upsert]', error.message);
        });
      }
    },
    [supabaseAuth.supabase, supabaseAuth.user?.id]
  );

  const tryAddReminder = useCallback(
    (r: Reminder) => {
      if (reminders.length >= reminderLimit) {
        if (appPlan === 'free') {
          openPremium('reminders');
        } else {
          setReminderLimitHint(tr.remindersLimitReached);
        }
        return false;
      }
      setReminderLimitHint(null);
      persistReminders([r, ...reminders]);
      trackEvent('reminder_created', { source: r.type });
      showToast(tr.toastReminderCreated, 'success');
      return true;
    },
    [reminders, reminderLimit, appPlan, tr.remindersLimitReached, tr.toastReminderCreated, persistReminders, openPremium, showToast]
  );

  const updateReminder = useCallback(
    (id: string, patch: Partial<Reminder>) => {
      persistReminders(reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [reminders, persistReminders]
  );

  const deleteReminder = useCallback(
    (id: string) => {
      persistReminders(reminders.filter((r) => r.id !== id));
      showToast(tr.toastDeleted, 'success');
    },
    [reminders, persistReminders, showToast, tr.toastDeleted]
  );

  useEffect(() => {
    setCustomReminderCatId((prev) =>
      activeCats.some((c) => c.id === prev) ? prev : selectedCatId
    );
  }, [selectedCatId, activeCats]);

  useEffect(() => {
    const tick = () => {
      setReminders((prev) => processDueReminders(prev, catNameById, lang));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [lang, catNameById]);

  useEffect(() => {
    const syncPerm = () => setNotificationPerm(getNotificationPermission());
    const onVis = () => {
      if (document.visibilityState === 'visible') syncPerm();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    safeSetItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    safeSetItem(CATS_STORAGE_KEY, JSON.stringify(cats));
  }, [cats]);

  useEffect(() => {
    if (!supabaseAuth.authReady) return;
    if (skipBootstrapCloudSyncRef.current) {
      skipBootstrapCloudSyncRef.current = false;
      setCatsCloudBusy(false);
      setPetsBootReady(true);
      return;
    }
    if (!supabaseAuth.user || !supabaseAuth.supabase) {
      setCatsCloudBusy(false);
      setCatsCloudErr(null);
      setCloudSyncPhase('idle');
      setCloudSyncError(null);
      cloudDailyHydratedRef.current = false;
      const localOnly = normalizeAndPersistCats('');
      applyCatsState(localOnly);
      setPetsBootReady(true);
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
      const uid = supabaseAuth.user!.id;
      let localCats = normalizeAllCats(loadRawCatsFromStorage(), uid);
      let migratedIdMap: Record<string, string> = {};
      const offline = localCats.filter((c) => !isCloudCatId(c.id));
      if (offline.length > 0) {
        const mig = await migrateOfflineCatsToCloud(sb, uid, localCats as unknown as AppCat[]);
        if (mig.errors.length > 0) console.warn('[offline cat migrate]', mig.errors.join('; '));
        migratedIdMap = mig.idMap;
        localCats = normalizeAllCats(
          mig.cats.map((c) => normalizeCat(c, uid)).filter(Boolean) as Cat[],
          uid
        );
        safeSetItem(CATS_STORAGE_KEY, JSON.stringify(localCats));
      }
      const { data: cloudList, error } = await fetchCatsForUser(sb);
      if (cancelled) return;
      if (error) {
        setCatsCloudErr(error.message);
        setCatsCloudBusy(false);
        setPetsBootReady(true);
        return;
      }
      const cloudIdSet = new Set(cloudList.map((c) => c.id));
      const localFiltered = localCats.filter((c) => !isCloudCatId(c.id) || cloudIdSet.has(c.id));
      const merged = mergeAndNormalizeCats(cloudList, localFiltered, uid);
      const { data: roles } = await fetchMyCatRolesMap(sb, uid);
      if (!cancelled) setCatRolesMap(roles);
      setCloudSyncPhase('loading');
      const activeMerged = merged.filter((c) => !c.isArchived);
      const remapped = migratedIdMap[selectedCatId] ?? selectedCatId;
      const nextCatId = activeMerged.some((c) => c.id === remapped)
        ? remapped
        : activeMerged[0]?.id ?? merged[0]?.id ?? remapped;
      applyCatsState(merged, { preferredSelectedId: nextCatId });
      setCatsCloudBusy(false);
      setPetsBootReady(true);
      if (!cancelled) {
        await runFullCloudSync(merged, cloudList.map((c) => c.id), sb, uid);
        if (!cancelled) {
          reloadSelectedCatFromLocal(nextCatId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    supabaseAuth.authReady,
    supabaseAuth.user?.id,
    supabaseAuth.supabase,
    runFullCloudSync,
    reloadSelectedCatFromLocal,
    applyCatsState,
    selectedCatId,
  ]);

  const retryCloudSync = useCallback(() => {
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user?.id;
    if (!sb || !uid) return;
    const accessibleIds = cats.filter((c) => isCloudCatId(c.id)).map((c) => c.id);
    void runFullCloudSync(cats, accessibleIds, sb, uid).then(() => reloadSelectedCatFromLocal(selectedCatId));
  }, [cats, supabaseAuth.supabase, supabaseAuth.user?.id, runFullCloudSync, reloadSelectedCatFromLocal, selectedCatId]);

  useEffect(() => {
    if (!isOnline || cloudSyncPhase !== 'failed' || !supabaseAuth.user?.id || !supabaseAuth.supabase) return;
    const handle = window.setTimeout(() => retryCloudSync(), 8000);
    return () => window.clearTimeout(handle);
  }, [isOnline, cloudSyncPhase, supabaseAuth.user?.id, supabaseAuth.supabase, retryCloudSync]);

  const cloudCatIds = useMemo(
    () => cats.filter((c) => isCloudCatId(c.id)).map((c) => c.id),
    [cats]
  );

  const flushOfflinePending = useCallback(async () => {
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user?.id;
    if (!sb || !uid || !isOnline) return;
    if (cloudCatIds.length === 0) return;
    if (countPendingSyncItems(cloudCatIds) === 0) {
      setOfflineSyncError(null);
      return;
    }
    setOfflineSyncBusy(true);
    setOfflineSyncError(null);
    try {
      const res = await flushPendingSync(sb, uid, cloudCatIds);
      if (!res.ok) {
        setOfflineSyncError(tr.offlineSyncFailed);
        return;
      }
      if (res.syncedDaily > 0 || res.syncedWeights > 0) {
        reloadSelectedCatFromLocal(selectedCatId);
        showToast(tr.offlineSyncOk, 'success');
      }
    } finally {
      setOfflineSyncBusy(false);
    }
  }, [
    supabaseAuth.supabase,
    supabaseAuth.user?.id,
    isOnline,
    cloudCatIds,
    reloadSelectedCatFromLocal,
    selectedCatId,
    showToast,
    tr.offlineSyncFailed,
    tr.offlineSyncOk,
  ]);

  useEffect(() => {
    if (!isOnline || !supabaseAuth.user?.id || !supabaseAuth.supabase) return;
    void flushOfflinePending();
  }, [isOnline, supabaseAuth.user?.id, supabaseAuth.supabase, flushOfflinePending]);

  useEffect(() => {
    safeSetItem(SELECTED_CAT_KEY, selectedCatId);
  }, [selectedCatId]);

  useEffect(() => {
    if (!selectedCat) return;
    const shouldMarkPending = !isOnline && useCloudDaily;
    const payload = applyDailyPendingSync(daily as unknown as DailyJson, shouldMarkPending);
    safeSetItem(dailyStorageKey(selectedCat.id, today), JSON.stringify(payload));
    setHistoryRefreshKey((v) => v + 1);
  }, [daily, selectedCat, today, isOnline, useCloudDaily]);

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
        cloudDailyHydratedRef.current = true;
        return;
      }
      const localFull = loadDailyRecord(selectedCat.id, today) as unknown as DailyJson;
      const merged = mergeCloudDailyPreferCloud(cloudPart as DailyJson | null, localFull) as DailyRecord;
      setDaily(merged);
      safeSetItem(dailyStorageKey(selectedCat.id, today), JSON.stringify(merged));
      lastCloudDailyStripRef.current = JSON.stringify(stripPhotoFieldsFromDaily(merged as unknown as DailyJson));
      cloudDailyHydratingRef.current = false;
      cloudDailyHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [useCloudDaily, selectedCat?.id, today, supabaseAuth.supabase, cloudSyncTick]);

  useEffect(() => {
    if (!useCloudDaily) {
      cloudDailyHydratedRef.current = true;
    }
  }, [useCloudDaily]);

  useEffect(() => {
    if (!useCloudDaily || !selectedCat || !supabaseAuth.supabase) {
      setCloudCareEvents([]);
      return;
    }
    void fetchCareEventsForCat(supabaseAuth.supabase, selectedCat.id).then(({ data, error }) => {
      if (!error) setCloudCareEvents(data);
    });
  }, [useCloudDaily, selectedCat?.id, supabaseAuth.supabase, cloudSyncTick]);

  useEffect(() => {
    const name = supabaseAuth.profile?.display_name?.trim() ?? '';
    setSharedCareDisplayNameInput(name);
  }, [supabaseAuth.profile?.display_name]);

  useEffect(() => {
    if (!selectedCat || (page !== 'sharedCare' && page !== 'cats')) return;
    void refreshSharedCareForCat(selectedCat.id);
  }, [selectedCat?.id, page, refreshSharedCareForCat, cloudSyncTick]);

  useEffect(() => {
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user?.id;
    if (!sb || !uid || inviteUrlHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite')?.trim();
    if (!code) return;
    inviteUrlHandledRef.current = true;
    void (async () => {
      const { catId, error } = await acceptCatInvite(sb, code);
      if (error) {
        setSharedCareFeedback(text[lang].sharedCareJoinWrong);
        return;
      }
      if (!catId) return;
      const merged = await reloadCatsFromCloud();
      const active = merged.filter((c) => !c.isArchived);
      const joined = active.find((c) => c.id === catId) ?? active[0];
      if (joined) {
        setSelectedCatId(joined.id);
        setDaily(loadDailyRecord(joined.id, today));
        setMonthly(loadMonthlyRecord(joined.id, month));
        setWeightRecords(loadWeightRecords(joined.id));
      }
      setSharedCareFeedback(text[lang].sharedCareJoinOk);
      setPage('cats');
      scrollToSharedCareSection();
      params.delete('invite');
      const qs = params.toString();
      const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    })();
  }, [
    supabaseAuth.supabase,
    supabaseAuth.user?.id,
    lang,
    reloadCatsFromCloud,
    today,
    month,
    scrollToSharedCareSection,
  ]);

  useEffect(() => {
    if (!isOnline || !useCloudDaily || !selectedCat || !supabaseAuth.user?.id || !supabaseAuth.supabase) return;
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user.id;
    const handle = window.setTimeout(() => {
      if (cloudDailyHydratingRef.current) return;
      if (!cloudDailyHydratedRef.current) return;
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
          markDailyPendingSync(selectedCat.id, today);
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
    isOnline,
  ]);

  useEffect(() => {
    if (!isOnline || !useCloudDaily || !selectedCat || !supabaseAuth.user?.id || !supabaseAuth.supabase) return;
    if (cloudDailyHydratingRef.current) return;
    if (!cloudDailyHydratedRef.current) return;
    const abnormal = getPhotoList(daily.abnormalPhotos);
    const dailyPhotos = getPhotoList(daily.dailyPhotos);
    if (abnormal.length === 0 && dailyPhotos.length === 0) return;
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user.id;
    const handle = window.setTimeout(() => {
      void upsertDailyPhotosCloud(sb, {
        catId: selectedCat.id,
        recordDate: today,
        abnormalPhotos: abnormal,
        dailyPhotos,
        updatedBy: uid,
      }).then(({ error }) => {
        if (error) {
          console.warn('[daily_record_photos upsert]', error.message);
          markDailyPendingSync(selectedCat.id, today);
        }
      });
    }, 850);
    return () => window.clearTimeout(handle);
  }, [
    daily.abnormalPhotos,
    daily.dailyPhotos,
    useCloudDaily,
    selectedCat?.id,
    today,
    supabaseAuth.user?.id,
    supabaseAuth.supabase,
    cloudSyncTick,
    isOnline,
  ]);

  useEffect(() => {
    if (!selectedCat) return;
    safeSetItem(monthlyStorageKey(selectedCat.id, month), JSON.stringify(monthly));
  }, [monthly, selectedCat, month]);

  useEffect(() => {
    if (!selectedCat) return;
    const shouldMarkPending = !isOnline && useCloudDaily;
    const payload = shouldMarkPending
      ? weightRecords.map((r) => ({ ...r, pendingSync: true }))
      : weightRecords;
    safeSetItem(weightStorageKey(selectedCat.id), JSON.stringify(payload));
  }, [weightRecords, selectedCat, isOnline, useCloudDaily]);

  useEffect(() => {
    if (!isOnline || !useCloudDaily || !selectedCat || !supabaseAuth.user?.id || !supabaseAuth.supabase) return;
    if (!cloudDailyHydratedRef.current) return;
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user.id;
    const handle = window.setTimeout(() => {
      void upsertWeightRecordsForCat(sb, selectedCat.id, weightRecords, uid).then(({ error, records }) => {
        if (error) {
          console.warn('[weight_records upsert]', error.message);
          markWeightsPendingSync(selectedCat.id);
          return;
        }
        clearWeightsPendingSync(selectedCat.id);
        setWeightRecords((prev) => {
          const needsIdUpdate = prev.some((r) => !/^[0-9a-f-]{36}$/i.test(r.id));
          if (!needsIdUpdate) return prev;
          return records.length > 0 ? records : prev;
        });
      });
    }, 700);
    return () => window.clearTimeout(handle);
  }, [weightRecords, useCloudDaily, selectedCat?.id, supabaseAuth.user?.id, supabaseAuth.supabase, cloudSyncTick, isOnline]);

  useEffect(() => {
    if (!useCloudDaily || !selectedCat || !supabaseAuth.user?.id || !supabaseAuth.supabase) return;
    if (!cloudDailyHydratedRef.current) return;
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user.id;
    const handle = window.setTimeout(() => {
      void upsertMonthlyRecordCloud(sb, {
        catId: selectedCat.id,
        monthKey: month,
        data: monthly as Record<string, unknown>,
        updatedBy: uid,
      }).then(({ error }) => {
        if (error) console.warn('[monthly_records upsert]', error.message);
      });
    }, 700);
    return () => window.clearTimeout(handle);
  }, [monthly, month, useCloudDaily, selectedCat?.id, supabaseAuth.user?.id, supabaseAuth.supabase, cloudSyncTick]);

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
          trackEvent('login', { mode: 'email' });
          setAuthMessage(text[lang].authSignedInOk);
          showToast(text[lang].authSignedInOk, 'success');
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
          trackEvent('signup', { mode: 'email' });
          setAuthMessage(text[lang].authSignUpSent);
          setAuthPassword('');
        }
      }
    } finally {
      setAuthBusy(false);
    }
  }, [authEmail, authPassword, authDisplayNameReg, authMode, supabaseAuth, lang, showToast]);

  const handleAppleSignInClick = useCallback(async () => {
    setAppleSignInNotice(null);
    setAuthFormError(null);
    const result = await handleAppleSignIn(supabaseAuth.supabase);
    if (result.message === 'coming_soon') {
      setAppleSignInNotice(tr.authAppleComingSoon);
    }
  }, [supabaseAuth.supabase, tr.authAppleComingSoon]);

  const handleGoogleSignInClick = useCallback(async () => {
    setAppleSignInNotice(null);
    setAuthFormError(null);
    setAuthMessage(null);
    if (!supabaseAuth.supabase) {
      setAuthFormError(text[lang].authErrNotConfigured);
      return;
    }
    setGoogleOauthBusy(true);
    try {
      const { error } = await supabaseAuth.signInWithGoogle();
      if (error) setAuthFormError(formatAuthErrorMessage(lang, error));
    } finally {
      setGoogleOauthBusy(false);
    }
  }, [supabaseAuth, lang]);

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
      setAddCatNameError(tr.needCatName);
      return;
    }
    setAddCatNameError(null);

    if (appPlan === 'free' && activeCats.length >= FREE_MAX_ACTIVE_PETS) {
      openPremium('pets');
      return;
    }

    const base: Cat = {
      id: supabaseAuth.user && supabaseAuth.supabase ? crypto.randomUUID() : makeId(),
      name,
      petType: newCatPetType,
      emoji: defaultEmojiForPetType(newCatPetType),
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
      isArchived: false,
      createdAt: new Date().toISOString(),
      ownerId: supabaseAuth.user?.id ?? '',
    };

    if (supabaseAuth.user && supabaseAuth.supabase) {
      const { data, error } = await insertCatForOwner(supabaseAuth.supabase, supabaseAuth.user.id, base);
      if (error) {
        showToast(tr.toastGenericError, 'error');
        return;
      }
      if (!data) return;
      const created = appCatToNormalized(data, supabaseAuth.user.id);
      applyCatsState([...cats, created], { preferredSelectedId: created.id });
      setNewCatName('');
      setNewCatPetType('cat');
      setDaily({});
      setMonthly({});
      setWeightRecords([]);
      setHistoryRefreshKey((v) => v + 1);
      trackEvent('pet_created', { source: 'cloud' });
      showToast(tr.toastSaved, 'success');
      setPage('cats');
      return;
    }

    applyCatsState([...cats, base], { preferredSelectedId: base.id });
    setNewCatName('');
    setNewCatPetType('cat');
    setDaily({});
    setMonthly({});
    setWeightRecords([]);
    setHistoryRefreshKey((v) => v + 1);
    trackEvent('pet_created', { source: 'local' });
    showToast(tr.toastSaved, 'success');
    setPage('cats');
  };

  const archiveCat = async (catId: string) => {
    const target = cats.find((cat) => cat.id === catId);
    if (!target || target.isArchived) return;

    if (!isValidPetForArchive(target)) {
      showToast(tr.toastGenericError, 'error');
      return;
    }

    if (activeCats.length <= 1) {
      showToast(tr.keepOneCat, 'error');
      return;
    }

    if (!confirm(`${tr.confirmArchiveCat}「${target.name}」？\n${tr.archiveCatNote}`)) {
      return;
    }

    setArchiveErrByCatId((prev) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });
    setArchiveBusyId(catId);

    if (supabaseAuth.user && supabaseAuth.supabase && isCloudCatId(catId)) {
      const { error } = await archiveCatForOwner(supabaseAuth.supabase, catId);
      if (error) {
        const msg = formatArchiveErrorMessage(error, lang);
        setArchiveErrByCatId((prev) => ({ ...prev, [catId]: msg }));
        showToast(msg, 'error');
        setArchiveBusyId(null);
        return;
      }
    }

    const nextCats = cats.map((cat) => (cat.id === catId ? { ...cat, isArchived: true } : cat));
    applyCatsState(nextCats);
    setArchiveBusyId(null);
    showToast(tr.toastArchived, 'success');

    if (selectedCatId === catId) {
      const nextActive = nextCats.filter((c) => !c.isArchived);
      const next = nextActive[0];
      if (next) {
        setDaily(loadDailyRecord(next.id, today));
        setMonthly(loadMonthlyRecord(next.id, month));
        setWeightRecords(loadWeightRecords(next.id));
        setHistoryRefreshKey((v) => v + 1);
      }
    }
  };

  const restoreCat = async (catId: string) => {
    const target = cats.find((cat) => cat.id === catId);
    if (!target || !target.isArchived) return;

    if (supabaseAuth.user && supabaseAuth.supabase && isCloudCatId(catId)) {
      const { error } = await restoreCatForOwner(supabaseAuth.supabase, catId);
      if (error) {
        const msg = formatRestoreErrorMessage(error, lang);
        showToast(msg, 'error');
        return;
      }
    }

    const nextCats = cats.map((cat) => (cat.id === catId ? { ...cat, isArchived: false } : cat));
    applyCatsState(nextCats);
    showToast(tr.toastRestored, 'success');
  };

  const finishLocalCatRemoval = useCallback(
    (catId: string) => {
      purgeCatLocalStorage(catId);
      const nextReminders = remindersWithoutCat(reminders, catId);
      saveReminders(nextReminders);
      setReminders(nextReminders);
      const sb = supabaseAuth.supabase;
      const uid = supabaseAuth.user?.id;
      if (sb && uid) {
        void upsertUserReminders(sb, uid, nextReminders).then(({ error }) => {
          if (error) console.warn('[user_reminders after cat delete]', error.message);
        });
      }
      const nextCats = cats.filter((c) => c.id !== catId);
      setCats(nextCats);
      if (selectedCatId === catId) {
        const nextActive = nextCats.filter((c) => !c.isArchived);
        const next = nextActive[0];
        if (next) {
          setSelectedCatId(next.id);
          setDaily(loadDailyRecord(next.id, today));
          setMonthly(loadMonthlyRecord(next.id, month));
          setWeightRecords(loadWeightRecords(next.id));
        } else {
          setDaily({});
          setMonthly({});
          setWeightRecords([]);
        }
        setHistoryRefreshKey((v) => v + 1);
      }
    },
    [
      cats,
      reminders,
      selectedCatId,
      today,
      month,
      supabaseAuth.supabase,
      supabaseAuth.user?.id,
    ]
  );

  const confirmPermanentDeleteCat = useCallback(async () => {
    const target = permanentDeleteTarget;
    if (!target || !target.isArchived || permanentDeleteBusy) return;

    setPermanentDeleteBusy(true);
    try {
      if (supabaseAuth.user && supabaseAuth.supabase && isCloudCatId(target.id)) {
        const { error } = await permanentlyDeleteCatForOwner(
          supabaseAuth.supabase,
          target.id,
          target.profilePhoto
        );
        if (error) {
          showToast(tr.toastGenericError, 'error');
          return;
        }
      }
      finishLocalCatRemoval(target.id);
      setPermanentDeleteTarget(null);
      showToast(tr.toastDeleted, 'success');
    } finally {
      setPermanentDeleteBusy(false);
    }
  }, [
    permanentDeleteTarget,
    permanentDeleteBusy,
    supabaseAuth.user,
    supabaseAuth.supabase,
    tr.catsCloudPermanentDeleteErr,
    finishLocalCatRemoval,
  ]);

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
    const availableSlots = maxDailyPhotos - currentPhotos.length;

    if (availableSlots <= 0) {
      if (appPlan === 'free') openPremium('photos');
      else showToast(tr.photoTooMany, 'error');
      return;
    }

    const selectedFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, availableSlots);

    setPhotoUploadBusy(true);
    try {
      const compressedPhotos = await Promise.all(
        selectedFiles.map((file) => compressImage(file))
      );

      setDaily((prev) => ({
        ...prev,
        [key]: [...getPhotoList(prev[key]), ...compressedPhotos].slice(0, maxDailyPhotos),
      }));
      if (compressedPhotos.length > 0) showToast(tr.toastPhotoOk, 'success');
    } catch {
      showToast(tr.toastGenericError, 'error');
    } finally {
      setPhotoUploadBusy(false);
    }
  };

  const updateProfilePhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setPhotoUploadBusy(true);
    try {
      const photo = await compressImage(file);
      updateSelectedCat({ profilePhoto: photo });
      showToast(tr.toastPhotoOk, 'success');
    } catch {
      showToast(tr.toastGenericError, 'error');
    } finally {
      setPhotoUploadBusy(false);
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
      showToast(tr.needWeight, 'error');
      return;
    }

    const nextRecord: WeightRecord = {
      id: useCloudDaily ? crypto.randomUUID() : makeId(),
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
    showToast(tr.exportDone, 'success');
  };

  const importBackup = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onerror = () => showToast(tr.importFailed, 'error');

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

        showToast(tr.importDone, 'success');
        window.setTimeout(() => window.location.reload(), 400);
      } catch (err) {
        console.error('[backup] import failed:', err);
        showToast(tr.importFailed, 'error');
      }
    };

    reader.readAsText(file);
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

        {photos.length === 0 ? (
          <p className="mb-3 text-center text-[13px] leading-relaxed text-stone-600">{tr.emptyPhotosTitle}</p>
        ) : null}

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

          {photos.length < maxDailyPhotos && (
            <label className={`flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center text-sm font-bold ${buttonClass}`}>
              {photos.length === 0 ? tr.emptyPhotosCta : `+ ${tr.addPhoto}`}
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
    setHistoryFilter('all');
    setHistoryKeyword('');
    setHistoryDateStart('');
    setHistoryDateEnd('');
    setHistoryDatePreset('none');
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
            <h2 className="truncate text-xl font-bold">{selectedCat?.name ?? tr.defaultPetName}</h2>
          </div>
        </div>

        <div className="flex shrink-0 flex-row flex-nowrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="touch-manipulation whitespace-nowrap rounded-full bg-stone-100 px-3.5 py-2 text-[13px] font-bold text-stone-700"
          >
            {tr.langButton}
          </button>
          <button
            type="button"
            onClick={() => setPage('cats')}
            className="touch-manipulation whitespace-nowrap rounded-full bg-orange-100 px-3.5 py-2 text-[13px] font-bold text-orange-700"
          >
            {tr.managePets}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {activeCats.map((cat) => (
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
    const todayCloudFeed = useCloudDaily
      ? cloudCareEvents.filter((e) => careEventCreatedOnLocalDate(e.created_at, today)).slice(0, 12)
      : [];
    const todayActivityCount = todayCloudFeed.length;
    const hasRealTodayFeed = todayActivityCount > 0;

    return (
    <>
      {renderCatSwitcher()}

      {photoUploadBusy ? (
        <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-orange-100 bg-white/95 px-3 py-2.5 text-[12px] font-medium text-stone-600 shadow-sm backdrop-blur-sm animate-fade-in">
          <Spinner className="h-4 w-4 shrink-0 border-2" />
          <span>{tr.photoUploading}</span>
        </div>
      ) : null}

      <section className="mb-5 overflow-hidden rounded-3xl border border-amber-100 bg-amber-50/60 shadow-sm">
        <button
          type="button"
          onClick={() => setTodayCareFeedOpen((open) => !open)}
          className="flex w-full items-center gap-3 p-4 text-left transition active:bg-amber-100/50"
          aria-expanded={todayCareFeedOpen}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-stone-900">{tr.sharedCareTodayFeedTitle}</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {todayCareFeedOpen
                ? tr.sharedCareTodayFeedCollapse
                : hasRealTodayFeed
                  ? `${todayActivityCount} ${tr.sharedCareTodayFeedCount} · ${tr.sharedCareTodayFeedTap}`
                  : tr.sharedCareTodayFeedTap}
            </p>
          </div>
          <span
            className={`shrink-0 text-stone-400 transition-transform duration-200 ${todayCareFeedOpen ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▼
          </span>
        </button>
        {todayCareFeedOpen ? (
          <div className="border-t border-amber-100/80 px-4 pb-4 pt-1">
            {!hasRealTodayFeed ? (
              <p className="text-sm text-stone-500">{tr.sharedCareTodayFeedEmpty}</p>
            ) : (
              <ul className="space-y-2 text-sm text-stone-700">
                {todayCloudFeed.map((e) => (
                  <li key={e.id}>
                    <span className="font-semibold text-stone-900">{e.actor}</span>
                    <span className="text-stone-400"> · {formatCareEventTimeLabel(e.created_at)}</span>
                    <span> — {e.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <div className="mb-4 rounded-2xl border border-orange-100/90 bg-white px-3.5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-xl">🐾</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold leading-tight text-stone-900">{tr.appTitle}</h1>
            <p className="truncate text-xs text-stone-600">{selectedCat?.name ?? tr.defaultPetName} · {today}</p>
            <p className="text-[10px] font-medium tracking-wide text-stone-400">{tr.appSubtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold tabular-nums text-orange-600">{dailyPercent}%</p>
            <p className="text-[10px] text-stone-400">{dailyDone}/{dailyItemsForPet.length}</p>
          </div>
        </div>
        <div className="mt-2.5">
          <div className="mb-1 text-[11px] font-medium text-stone-500">{tr.todayProgress}</div>
          <div className="h-1.5 overflow-hidden rounded-full bg-orange-100">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-300" style={{ width: `${dailyPercent}%` }} />
          </div>
        </div>
      </div>

      <section className="mb-4">
        <div className="mb-2">
          <h2 className="text-base font-bold">{tr.dailyCare}</h2>
          <p className="text-[12px] text-stone-500">{tr.dailyCareDesc}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {dailyItemsForPet.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleDaily(item.id)}
              className={`flex min-h-[64px] w-full items-center justify-between rounded-xl border p-2.5 text-left shadow-sm transition active:scale-[0.98] ${
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
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{tr.abnormalRecord}</h2>
            <p className="text-sm text-stone-500">{tr.abnormalDesc}</p>
          </div>
          <button
            type="button"
            onClick={() => setPage('assistant')}
            className="flex shrink-0 touch-manipulation items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-2 text-[12px] font-bold text-violet-800 ring-1 ring-violet-100 transition active:scale-[0.98] active:bg-violet-100"
          >
            <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="whitespace-nowrap">{tr.moreAssistant}</span>
          </button>
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
            <p className="text-sm text-stone-500">
              {selectedPetType === 'dog' ? tr.monthlyCareDescDog : tr.monthlyCareDesc}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {selectedCat?.name ?? tr.defaultPetName}｜{tr.month}：{month}
            </p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
            {monthlyDone}/{monthlyItemsForPet.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {monthlyItemsForPet.map((item) => (
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
    const historyStartInputMin = historyDateBounds.min;

    const applyHistoryDatePreset = (preset: HistoryDatePreset) => {
      setHistoryDatePreset(preset);
      const { start, end } = computeHistoryDateRange(preset, today);
      let startFinal = start;
      let endFinal = end;
      if (endFinal > today) endFinal = today;
      setHistoryDateStart(startFinal);
      setHistoryDateEnd(endFinal);
    };
    const clearHistorySearch = () => {
      setHistoryFilter('all');
      setHistoryKeyword('');
      setHistoryDateStart('');
      setHistoryDateEnd('');
      setHistoryDatePreset('none');
    };
    const historyTagLabel = (tag: HistorySearchHit['tags'][number]) => {
      if (tag === 'abnormal') return tr.historyTagAbnormal;
      if (tag === 'photo') return tr.historyTagPhoto;
      if (tag === 'note') return tr.historyTagNote;
      return tr.historyTagWeight;
    };
    const historyFilterChips: { id: HistoryFilterChip; label: string }[] = [
      { id: 'all', label: tr.historyFilterAll },
      { id: 'abnormal', label: tr.historyFilterAbnormal },
      { id: 'photo', label: tr.historyFilterPhoto },
      { id: 'note', label: tr.historyFilterNote },
      { id: 'weight', label: tr.historyFilterWeight },
    ];

    const renderHistoryDayCard = (record: { date: string; data: DailyRecord }) => {
      const done = dailyItemsForPet.filter((item) => record.data[item.id] === true).length;
      const percent = Math.round((done / dailyItemsForPet.length) * 100);
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
                {tr.completed} {done}/{dailyItemsForPet.length}（{percent}%）
              </p>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">{percent}%</span>
          </div>

          <div className="mb-4 h-3 overflow-hidden rounded-full bg-orange-100">
            <div className="h-full rounded-full bg-orange-400" style={{ width: `${percent}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {dailyItemsForPet.map((item) => (
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

        <div className="mb-3 rounded-2xl border border-orange-100/80 bg-white px-3.5 py-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-xl" aria-hidden>📅</span>
            <div>
              <h1 className="text-base font-bold text-stone-900">{tr.historyTitle}</h1>
              <p className="text-[11px] text-stone-500">{tr.historyDesc}</p>
            </div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="animate-fade-in space-y-4 rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-sm">
            <p className="text-[15px] leading-relaxed text-stone-700">{tr.emptyHistoryTitle}</p>
            <button
              type="button"
              onClick={() => setPage('today')}
              className="w-full rounded-2xl bg-orange-500 py-3 text-[14px] font-bold text-white shadow-md shadow-orange-300/40 transition active:scale-[0.99]"
            >
              {tr.emptyHistoryCta}
            </button>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-30 mb-3 space-y-2 rounded-xl border border-orange-100/90 bg-white/95 p-2.5 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <input
                  id="history-jump-date"
                  type="date"
                  aria-label={tr.historyJumpLabel}
                  className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-[12px] outline-none focus:border-orange-300 focus:bg-white"
                  min={historyDateBounds.min}
                  max={historyDateBounds.max}
                  value={historyJumpDate}
                  onChange={(e) => {
                    setHistoryJumpDate(e.target.value);
                    setHistoryJumpHint(null);
                  }}
                />
                <button
                  type="button"
                  onClick={scrollHistoryToPickedDate}
                  className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-bold text-white"
                >
                  {tr.historyJumpGo}
                </button>
              </div>
              {historyJumpHint ? <p className="text-[10px] font-medium text-amber-800">{historyJumpHint}</p> : null}

              {appPlan === 'free' ? (
                <button
                  type="button"
                  onClick={() => openPremium('history')}
                  className="w-full rounded-lg border border-dashed border-orange-200 bg-orange-50/50 px-2.5 py-2 text-left text-[12px] text-stone-600 outline-none transition active:scale-[0.99]"
                >
                  {tr.historyKeywordProHint}
                </button>
              ) : (
                <input
                  type="search"
                  value={historyKeyword}
                  placeholder={tr.historySearchPlaceholder}
                  onChange={(e) => {
                    setHistoryKeyword(e.target.value);
                  }}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[12px] outline-none focus:border-orange-300 focus:bg-white"
                />
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistoryFiltersOpen((o) => !o)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                    historyFiltersOpen
                      ? 'border-orange-300 bg-orange-50 text-orange-800'
                      : 'border-stone-200 bg-white text-stone-600'
                  }`}
                >
                  {historyFiltersOpen ? tr.historyHideFilters : tr.historyAdvancedFilters}
              {appPlan === 'free' ? (
                <span className="ml-1 rounded bg-amber-100/90 px-1 py-px text-[8px] font-bold text-amber-900">
                  Pro
                </span>
              ) : null}
                </button>
                {historySearchMode ? (
                  <button type="button" onClick={clearHistorySearch} className="shrink-0 text-[10px] font-medium text-orange-600">
                    {tr.historyClearFilters}
                  </button>
                ) : null}
              </div>

              {historyFiltersOpen ? (
              <div className="space-y-2 rounded-lg border border-orange-100 bg-orange-50/40 px-2 py-2">
                <div className="flex flex-wrap gap-1">
                  {historyFilterChips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        if (appPlan === 'free' && chip.id !== 'all') {
                          openPremium('history');
                          return;
                        }
                        setHistoryFilter(chip.id);
                      }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                        historyFilter === chip.id ? 'bg-orange-500 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200/80'
                      } ${appPlan === 'free' && chip.id !== 'all' ? 'opacity-85' : ''}`}
                    >
                      {chip.id !== 'all' && appPlan === 'free' ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Lock className="inline h-2.5 w-2.5 text-amber-700/90" aria-hidden />
                          {chip.label}
                        </span>
                      ) : (
                        chip.label
                      )}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {appPlan === 'pro' ? (
                    (
                      [['start', tr.historyDateStart, historyDateStart, setHistoryDateStart],
                       ['end', tr.historyDateEnd, historyDateEnd, setHistoryDateEnd]] as const
                    ).map(([key, label, value, setter]) => (
                      <div key={key}>
                        <label className="mb-0.5 block text-[9px] font-medium text-stone-500">{label}</label>
                        <input
                          type="date"
                          value={value}
                          min={
                            key === 'start'
                              ? historyStartInputMin
                              : historyDateStart && historyDateStart >= historyStartInputMin
                                ? historyDateStart
                                : historyStartInputMin
                          }
                          max={today}
                          onChange={(e) => {
                            setter(e.target.value);
                            setHistoryDatePreset('none');
                          }}
                          className="w-full rounded-lg border border-stone-200 bg-white px-1.5 py-1 text-[11px] outline-none focus:border-orange-300"
                        />
                      </div>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPremium('history')}
                      className="col-span-2 rounded-lg border border-dashed border-orange-200 bg-white/80 px-2 py-2 text-left text-[10px] leading-snug text-stone-600 transition active:scale-[0.99]"
                    >
                      <span className="inline-flex items-center gap-1 font-semibold text-orange-700">
                        <Lock className="h-3 w-3 shrink-0" aria-hidden />
                        {lang === 'zh' ? '自訂起迄日期為 Pro 功能，請用下方快捷或升級。' : 'Custom date range is Pro — use quick ranges below or upgrade.'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {([ ['7d', tr.historyPreset7d], ['30d', tr.historyPreset30d], ['month', tr.historyPresetMonth] ] as const).map(
                    ([preset, label]) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => applyHistoryDatePreset(preset)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          historyDatePreset === preset ? 'bg-orange-500 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200/80'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>
              ) : null}

              {appPlan === 'free' && history.length > 0 ? (
                <div className="rounded-lg border border-orange-100/90 bg-gradient-to-r from-orange-50/90 to-amber-50/70 px-2.5 py-2 text-[11px] leading-snug text-stone-800">
                  <p className="m-0">{tr.historyFreeSearchNote}</p>
                  <button
                    type="button"
                    onClick={() => openPremium('history')}
                    className="mt-1.5 font-semibold text-orange-600 hover:underline"
                  >
                    {tr.historyUnlockFullSearch}
                  </button>
                </div>
              ) : null}
            </div>

            <div id="history-latest-anchor" className="h-0 w-full scroll-mt-28" aria-hidden />

            {/* Results */}
            {historySearchMode ? (
              historySearchHits.length === 0 ? (
                <div className="rounded-3xl bg-white p-6 text-center text-stone-500 shadow-sm">{tr.historyNoResults}</div>
              ) : (
                <div className="mb-6 space-y-3">
                  {historySearchHits.map((hit) => (
                    <article
                      key={hit.date}
                      id={`history-day-${hit.date}`}
                      className="scroll-mt-32 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-base font-bold text-stone-900">{hit.date}</h2>
                      </div>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {hit.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              tag === 'abnormal' ? 'bg-red-100 text-red-800'
                              : tag === 'photo' ? 'bg-violet-100 text-violet-800'
                              : tag === 'weight' ? 'bg-sky-100 text-sky-800'
                              : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {historyTagLabel(tag)}
                          </span>
                        ))}
                      </div>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-stone-700">{hit.snippet}</p>
                    </article>
                  ))}
                </div>
              )
            ) : (
              (historySearchMode ? historyMonthGroupsFiltered : historyMonthGroups).map((group) => (
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
              ))
            )}
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
    <VetReportPage
      lang={lang}
      appPlan={appPlan}
      cats={activeCats}
      selectedCatId={selectedCatId}
      onSelectCatId={selectCat}
      today={today}
      clientId={aiClientId}
      onOpenPhoto={setSelectedPhoto}
      onGoSettings={() => setPage('more')}
      onAiUsageChanged={() => {
        refreshAssistantQuotaFromLocal();
        pushAiUsageIfCloud();
      }}
      onRequestPro={() => openPremium('pdf')}
      catSwitcher={renderCatSwitcher()}
    />
  );

  const renderProfileChoiceField = (
    field: 'gender' | 'neutered',
    label: string,
    value: string | undefined,
    placeholder: string
  ) => (
    <div>
      <label className="mb-0.5 block text-[11px] font-bold text-stone-500">{label}</label>
      <button
        type="button"
        onClick={() => setProfileFieldPicker(field)}
        className="flex w-full touch-manipulation items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-left text-[13px] outline-none ring-orange-300/30 focus-visible:border-orange-300 focus-visible:ring-2"
      >
        <span className={`min-w-0 truncate ${(value ?? '').trim() ? 'font-medium text-stone-900' : 'text-stone-400'}`}>
          {(value ?? '').trim() || placeholder}
        </span>
        <span className="shrink-0 text-stone-400" aria-hidden>
          ▼
        </span>
      </button>
    </div>
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
    const qaBusy = aiQaLoading || aiBundleLoading || aiWeeklyLoading;
    const isProPlan = appPlan === 'pro';
    const currentCtxHash = getCareBundleContextHash(assistantContext);
    const dataStale =
      Boolean(aiCareBundle) && aiBundleSavedHash != null && currentCtxHash !== aiBundleSavedHash;
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

    const safeCareBundle = aiCareBundle
      ? normalizeCareBundlePayload(aiCareBundle as unknown as Record<string, unknown>, lang)
      : null;

    const renderAiQuotaUpgradeCard = (className = 'mb-3') =>
      quotaExhaustedNotice ? (
        <PremiumUpgradeCard
          lang={lang}
          reason="ai"
          headline={tr.aiQuotaExhaustedTitle}
          showUpgrade={!isProPlan}
          upgradeLabel={tr.settingsSwitchPro}
          onUpgrade={() => openPremium('ai')}
          proExhaustedHint={isProPlan ? tr.aiQuotaProExhausted : undefined}
          className={className}
        />
      ) : null;

    const weeklySections = [
      { key: 'weekSummary' as const, title: tr.weeklySummaryTitle },
      { key: 'completionRate' as const, title: tr.weeklyCompletionTitle },
      { key: 'trends' as const, title: tr.weeklyTrendsTitle },
      { key: 'abnormalTimeline' as const, title: tr.weeklyAbnormalTitle },
      { key: 'weightChange' as const, title: tr.weeklyWeightTitle },
      { key: 'vsLastWeek' as const, title: tr.weeklyVsLastTitle },
      { key: 'nextWeekFocus' as const, title: tr.weeklyNextWeekTitle },
    ];

    return (
      <>
        {renderCatSwitcher()}

        <section className="mb-3">
          <button
            type="button"
            onClick={() => setPage('more')}
            className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-bold text-stone-700"
          >
            ← {tr.moreBack}
          </button>
        </section>

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

        {assistantQuota && assistantQuota.dailyLimit > 0 ? (
          <AiDailyQuotaCard
            lang={lang}
            plan={appPlan}
            used={assistantQuota.dailyUsed}
            limit={assistantQuota.dailyLimit}
            className="mb-3"
            upgradeLabel={tr.settingsSwitchPro}
            onUpgrade={
              quotaExhaustedNotice && !isProPlan
                ? () => setAiPremiumCardVisible(true)
                : undefined
            }
          />
        ) : null}

        {aiPremiumCardVisible && quotaExhaustedNotice ? renderAiQuotaUpgradeCard() : null}

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
            disabled={!apiReady || aiBundleLoading || (bundleNetBlocked && appPlan === 'pro')}
            onClick={() => {
              if (bundleNetBlocked && appPlan === 'free') {
                openPremium('ai');
                return;
              }
              void runOpenAiCareBundle();
            }}
            className="w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 py-3 text-[14px] font-semibold text-white shadow-md shadow-orange-200/50 transition hover:from-orange-500 hover:to-orange-600 disabled:opacity-45 disabled:shadow-none sm:w-auto sm:min-w-[200px] sm:px-8"
          >
            {aiBundleLoading ? tr.aiOpenAiBusy : tr.aiGenerateWeek}
          </button>

          {aiBundleLoading && apiReady ? (
            <div className="mt-4 animate-fade-in space-y-2">
              <SkeletonCard rows={3} />
            </div>
          ) : null}

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

          {bundleNetBlocked && !careHasCache && apiReady ? renderAiQuotaUpgradeCard('mt-3') : null}

          {openAiErr && !quotaExhaustedNotice ? (
            <p className="mt-3 whitespace-pre-line rounded-xl border border-red-100 bg-red-50/90 px-3 py-2.5 text-[13px] leading-snug text-red-900">
              {openAiErr}
            </p>
          ) : null}

          {safeCareBundle ? (
            <div className="mt-4 space-y-3 border-t border-orange-100/80 pt-4">
              {renderAiBlock(tr.assistantQuickSummary, safeCareBundle.quickSummary)}
              {renderAiBlock(tr.assistantCareReminders, safeCareBundle.careReminders)}
              <p className="text-center text-[11px] leading-snug text-stone-400">{tr.aiDisclaimerFoot}</p>
            </div>
          ) : null}
        </section>

        <section className="mb-4 rounded-2xl border border-violet-100/80 bg-gradient-to-b from-white via-white to-violet-50/40 px-3.5 py-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-base"
              aria-hidden
            >
              📊
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold text-stone-900">{tr.weeklyCardTitle}</h2>
              {!isProPlan ? (
                <span className="mt-0.5 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">
                  Pro
                </span>
              ) : null}
            </div>
          </div>
          <p className="mb-3 text-[13px] leading-snug text-stone-600">{tr.weeklyCardLead}</p>
          {!isProPlan ? (
            <>
              <p className="mb-3 rounded-xl border border-stone-100 bg-stone-50/90 px-3 py-2.5 text-[12px] leading-snug text-stone-600">
                {tr.weeklyFreePreview}
              </p>
              <div className="mb-3 rounded-2xl border border-dashed border-violet-200/80 bg-violet-50/30 px-4 py-4 text-center">
                <p className="text-[13px] leading-relaxed text-stone-700">{tr.emptyWeeklyTitle}</p>
                <button
                  type="button"
                  onClick={() => setPage('today')}
                  className="mt-3 w-full rounded-xl bg-white py-2.5 text-[12px] font-bold text-violet-800 shadow-sm ring-1 ring-violet-200 transition active:scale-[0.99]"
                >
                  {tr.emptyWeeklyCta}
                </button>
              </div>
              <button
                type="button"
                onClick={() => openPremium('weekly')}
                className="w-full rounded-full border border-violet-200 bg-white py-2.5 text-[13px] font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50"
              >
                {tr.weeklyUpgrade}
              </button>
            </>
          ) : (
            <>
              {apiChecking || !apiReady ? (
                <p className="mb-3 text-sm leading-snug text-stone-500">
                  {apiChecking ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet-400" aria-hidden />
                      {tr.aiChecking}
                    </span>
                  ) : (
                    <span>
                      {assistantHealthReachable === false ? aiStatusHint(lang, 'off') : aiStatusHint(lang, 'key')}
                    </span>
                  )}
                </p>
              ) : null}
              <button
                type="button"
                disabled={!apiReady || aiWeeklyLoading || qaBlocked}
                onClick={runOpenAiWeeklyReport}
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 py-3 text-[14px] font-semibold text-white shadow-md shadow-violet-200/50 transition hover:from-violet-600 hover:to-violet-700 disabled:opacity-45 disabled:shadow-none sm:w-auto sm:min-w-[200px] sm:px-8"
              >
                {aiWeeklyLoading ? tr.aiOpenAiBusy : tr.weeklyGenerateBtn}
              </button>
              {qaBlocked && apiReady ? renderAiQuotaUpgradeCard('mt-3') : null}

              {weeklyErr && !quotaExhaustedNotice ? (
                <p className="mt-3 whitespace-pre-line rounded-xl border border-red-100 bg-red-50/90 px-3 py-2.5 text-[13px] leading-snug text-red-900">
                  {weeklyErr}
                </p>
              ) : null}
              {aiWeeklyLoading ? (
                <p className="mt-3 flex items-center gap-2 text-[13px] text-stone-600">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet-400" aria-hidden />
                  {tr.aiOpenAiBusy}
                </p>
              ) : null}
              {!aiWeeklyReport && !aiWeeklyLoading && !weeklyErr && apiReady ? (
                <div className="mt-4 animate-fade-in space-y-3 rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-5 text-center">
                  <p className="text-[14px] leading-relaxed text-stone-700">{tr.emptyWeeklyTitle}</p>
                  <button
                    type="button"
                    onClick={() => setPage('today')}
                    className="w-full rounded-2xl bg-white py-2.5 text-[13px] font-bold text-violet-800 shadow-sm ring-1 ring-violet-200 transition active:scale-[0.99]"
                  >
                    {tr.emptyWeeklyCta}
                  </button>
                </div>
              ) : null}
              {aiWeeklyReport ? (
                <WeeklyReportErrorBoundary
                  fallback={
                    <p className="mt-3 rounded-xl border border-red-100 bg-red-50/90 px-3 py-2.5 text-[13px] text-red-900">
                      {tr.weeklyBoundaryFail}
                    </p>
                  }
                >
                <div className="mt-4">
                  <AssistantWeeklyReportView
                    report={aiWeeklyReport}
                    lang={lang}
                    reportRef={weeklyReportRef}
                    disclaimer={tr.aiDisclaimerFoot}
                    emptySectionLabel={tr.weeklySectionEmpty}
                    sections={weeklySections}
                    renderBlock={renderAiBlock}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!assistantContext || !aiWeeklyReport) return;
                        cloudSaveWeeklyReport(
                          assistantContext.catId,
                          assistantContext.today,
                          normalizeWeeklyReport(aiWeeklyReport, lang)
                        );
                        setWeeklySaveHint(tr.weeklySavedOk);
                      }}
                      className="rounded-xl border border-violet-200 bg-white py-2 text-[12px] font-semibold text-violet-800"
                    >
                      {tr.weeklySave}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!assistantContext || !aiWeeklyReport) return;
                        const ok = await shareReportText(
                          tr.weeklyCardTitle,
                          formatWeeklyReportPlainText(normalizeWeeklyReport(aiWeeklyReport, lang), {
                            catName: assistantContext.cat.name,
                            weekStart: addDaysYmd(assistantContext.today, -6),
                            weekEnd: assistantContext.today,
                            lang,
                          })
                        );
                        setWeeklySaveHint(ok ? tr.weeklyShareOk : tr.weeklyShareFail);
                      }}
                      className="rounded-xl border border-violet-200 bg-white py-2 text-[12px] font-semibold text-violet-800"
                    >
                      {tr.weeklyShare}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const el = weeklyReportRef.current;
                        if (!el || !assistantContext) return;
                        try {
                          await exportReportElementAsPdf(
                            el,
                            `weekly-report-${assistantContext.cat.name}-${assistantContext.today}.pdf`
                          );
                        } catch {
                          setWeeklyErr(tr.weeklyShareFail);
                        }
                      }}
                      className="rounded-xl border border-violet-200 bg-violet-600 py-2 text-[12px] font-semibold text-white"
                    >
                      {tr.weeklyExportPdf}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const el = weeklyReportRef.current;
                        if (!el || !assistantContext) return;
                        try {
                          await exportReportElementAsPng(
                            el,
                            `weekly-report-${assistantContext.cat.name}-${assistantContext.today}.png`
                          );
                        } catch {
                          setWeeklyErr(tr.weeklyShareFail);
                        }
                      }}
                      className="rounded-xl border border-violet-200 bg-violet-600 py-2 text-[12px] font-semibold text-white"
                    >
                      {tr.weeklyExportPng}
                    </button>
                  </div>
                  {weeklySaveHint ? (
                    <p className="mt-2 text-center text-[12px] text-violet-700">{weeklySaveHint}</p>
                  ) : null}
                </div>
                </WeeklyReportErrorBoundary>
              ) : !aiWeeklyLoading && !weeklyErr ? (
                <p className="mt-3 text-[13px] leading-snug text-stone-500">{tr.aiEmptyHint}</p>
              ) : null}
            </>
          )}
        </section>

        {apiReady && aiBundleLoading ? (
          <section className="mb-4 flex items-center gap-2.5 rounded-2xl border border-orange-100 bg-orange-50/50 px-3.5 py-3 text-[13px] leading-snug text-stone-700">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-orange-400" aria-hidden />
            {tr.aiOpenAiBusy}
          </section>
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
            disabled={qaBusy || !apiReady || (qaBlocked && appPlan === 'pro')}
            className="min-h-[5.5rem] w-full resize-none rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-[13px] leading-snug text-stone-800 outline-none transition focus:border-orange-300 focus:bg-white disabled:opacity-60"
          />
          <button
            type="button"
            disabled={qaBusy || !apiReady || (qaBlocked && appPlan === 'pro')}
            onClick={() => {
              if (qaBlocked && appPlan === 'free') {
                openPremium('ai');
                return;
              }
              void runOpenAiQa();
            }}
            className="mt-3 w-full rounded-full border border-orange-200 bg-white py-3 text-[14px] font-semibold text-orange-600 shadow-sm transition hover:bg-orange-50 disabled:opacity-60"
          >
            {aiQaLoading ? tr.assistantSendBusy : tr.assistantSend}
          </button>
          {qaBlocked && apiReady ? renderAiQuotaUpgradeCard('mt-3') : null}
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


  const renderSharedCareContent = () => {
    if (!selectedCat) return null;
    const t = text[lang];
    const sb = supabaseAuth.supabase;
    const uid = supabaseAuth.user?.id;
    const cloudReady = Boolean(useCloudDaily && sb && uid && isCloudCatId(selectedCat.id));
    const isOwner = selectedCatRole === 'owner';

    const onGenerateInvite = async () => {
      if (!cloudReady || !sb || !uid || !isOwner) return;
      setSharedCareBusy(true);
      const { code, error } = await createInviteCodeForCat(sb, selectedCat.id, uid);
      setSharedCareBusy(false);
      if (error || !code) {
        setSharedCareFeedback(error?.message ?? t.sharedCareJoinWrong);
        return;
      }
      setSharedCareInviteCode(code);
      setSharedCareFeedback(null);
      void refreshSharedCareForCat(selectedCat.id);
    };

    const onCopyCode = async () => {
      if (!sharedCareInviteCode) return;
      try {
        await navigator.clipboard.writeText(sharedCareInviteCode);
        flashSharedCareCopied();
      } catch {
        setSharedCareFeedback(t.sharedCareCopyFail);
      }
    };

    const onCopyLink = async () => {
      if (!sharedCareInviteCode) return;
      try {
        const u = new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost');
        u.searchParams.set('invite', sharedCareInviteCode);
        await navigator.clipboard.writeText(u.toString());
        flashSharedCareCopied();
      } catch {
        setSharedCareFeedback(t.sharedCareCopyFail);
      }
    };

    const onJoin = async () => {
      const code = sharedCareJoinInput.trim();
      if (!code) return;
      if (!sb || !uid) {
        setSharedCareFeedback(t.sharedCareJoinNeedLogin);
        return;
      }
      setSharedCareBusy(true);
      const { catId, error } = await acceptCatInvite(sb, code);
      setSharedCareBusy(false);
      if (error) {
        const msg = error.message.toLowerCase().includes('invalid') ? t.sharedCareJoinWrong : error.message;
        setSharedCareFeedback(msg);
        return;
      }
      if (!catId) {
        setSharedCareFeedback(t.sharedCareJoinWrong);
        return;
      }
      const merged = await reloadCatsFromCloud();
      const active = merged.filter((c) => !c.isArchived);
      const joined = active.find((c) => c.id === catId) ?? active[0];
      if (joined) {
        setSelectedCatId(joined.id);
        setDaily(loadDailyRecord(joined.id, today));
        setMonthly(loadMonthlyRecord(joined.id, month));
        setWeightRecords(loadWeightRecords(joined.id));
      }
      setSharedCareFeedback(t.sharedCareJoinOk);
      setSharedCareJoinInput('');
      if (joined) void refreshSharedCareForCat(joined.id);
    };

    const onRemoveMember = async (memberUserId: string) => {
      if (!cloudReady || !sb || !isOwner) return;
      setSharedCareBusy(true);
      const { error } = await removeCatMember(sb, selectedCat.id, memberUserId);
      setSharedCareBusy(false);
      if (error) {
        setSharedCareFeedback(error.message);
        return;
      }
      setSharedCareFeedback(null);
      void refreshSharedCareForCat(selectedCat.id);
    };

    const onSaveDisplayName = async () => {
      const { error } = await supabaseAuth.updateDisplayName(sharedCareDisplayNameInput);
      if (error) setSharedCareFeedback(error.message);
      else setSharedCareFeedback(null);
    };

    return (
      <>
        {!cloudReady ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-950">
            {t.sharedCareCloudRequired}
          </div>
        ) : null}

        {supabaseAuth.user ? (
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <label className="mb-1 block text-[11px] font-bold text-stone-500">{t.sharedCareDisplayNameLabel}</label>
          <p className="mb-2 text-[11px] text-stone-400">{t.sharedCareDisplayNameHint}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={sharedCareDisplayNameInput}
              onChange={(e) => setSharedCareDisplayNameInput(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-orange-300"
              placeholder={supabaseAuth.user?.email ?? ''}
            />
            <button
              type="button"
              onClick={() => void onSaveDisplayName()}
              className="shrink-0 rounded-xl bg-orange-400 px-4 py-2 text-sm font-bold text-white"
            >
              {t.sharedCareSaveName}
            </button>
            </div>
          </section>
        ) : null}

        {cloudReady ? (
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-stone-900">{t.sharedCareMembersTitle}</h2>
          {sharedCareMembers.length === 0 ? (
            <p className="text-sm text-stone-500">{t.sharedCareMembersEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {sharedCareMembers.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2"
                >
                  <span className="min-w-0 truncate font-semibold text-stone-900">{m.displayName}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        m.role === 'owner' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {m.role === 'owner' ? t.sharedCareRoleOwner : t.sharedCareRoleMember}
                    </span>
                    {isOwner && m.role === 'member' ? (
                      <button
                        type="button"
                        disabled={sharedCareBusy}
                        onClick={() => void onRemoveMember(m.userId)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700"
                      >
                        {t.sharedCareRemoveMember}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        ) : null}

        {cloudReady && isOwner ? (
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-stone-900">{t.sharedCareInviteSection}</h2>
          <button
            type="button"
            disabled={sharedCareBusy}
            onClick={() => void onGenerateInvite()}
            className="mb-3 w-full rounded-xl bg-orange-400 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {t.sharedCareGenerateInvite}
          </button>
          <div className="mb-2">
            <span className="text-[11px] font-bold text-stone-500">{t.sharedCareInviteCodeLabel}</span>
            <p className="mt-1 font-mono text-lg font-bold tracking-widest text-stone-900">{sharedCareInviteCode ?? '—'}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!sharedCareInviteCode}
              onClick={() => void onCopyCode()}
              className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-bold text-stone-700 disabled:opacity-45"
            >
              {sharedCareCopied ? t.sharedCareCopied : t.sharedCareCopyCode}
            </button>
            <button
              type="button"
              disabled={!sharedCareInviteCode}
              onClick={() => void onCopyLink()}
              className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-bold text-stone-700 disabled:opacity-45"
            >
              {sharedCareCopied ? t.sharedCareCopied : t.sharedCareCopyLink}
            </button>
          </div>
        </section>
        ) : cloudReady && !isOwner ? (
          <p className="mb-4 text-[12px] text-stone-500">{t.sharedCareOwnerOnly}</p>
        ) : null}

        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-bold text-stone-900">{t.sharedCareJoinSection}</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={sharedCareJoinInput}
              onChange={(e) => setSharedCareJoinInput(e.target.value.toUpperCase())}
              placeholder={t.sharedCareJoinPlaceholder}
              disabled={sharedCareBusy}
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[13px] uppercase outline-none focus:border-orange-300 disabled:opacity-60"
            />
            <button
              type="button"
              disabled={sharedCareBusy}
              onClick={() => void onJoin()}
              className="shrink-0 rounded-xl bg-stone-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {t.sharedCareJoinSubmit}
            </button>
          </div>
          {sharedCareFeedback ? <p className="mt-2 text-[13px] font-medium text-orange-700">{sharedCareFeedback}</p> : null}
        </section>

        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-bold text-stone-900">{t.sharedCareActivityTitle}</h2>
          {useCloudDaily && cloudCareEvents.length > 0 ? (
            <ul className="space-y-2">
              {cloudCareEvents.slice(0, 30).map((e) => (
                <li key={e.id} className="text-[13px] leading-snug text-stone-700">
                  <span className="font-semibold text-stone-900">{e.actor}</span>
                  <span className="text-stone-400"> · {formatCareEventTimeLabel(e.created_at)}</span>
                  <span> — {e.summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">{t.sharedCareActivityEmpty}</p>
          )}
        </section>
      </>
    );
  };

  const renderSharedCarePage = () => {
    if (!selectedCat) return null;
    const t = text[lang];
    return (
      <>
        {renderCatSwitcher()}
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setPage('cats')}
            className="mb-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-bold text-stone-700"
          >
            ← {tr.catsBack}
          </button>
          <h1 className="text-xl font-bold text-stone-900">{t.sharedCareTitle}</h1>
          <p className="mt-1 text-sm text-stone-500">{selectedCat.name}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-amber-800">{t.sharedCareNavHint}</p>
        </section>
        {renderSharedCareContent()}
      </>
    );
  };

  const renderMorePage = () => {
    const moreMenuRows: {
      icon: LucideIcon;
      title: string;
      desc: string;
      onClick: () => void;
      accent?: boolean;
    }[] = [
      {
        icon: User,
        title: tr.moreAccount,
        desc: tr.moreAccountDesc,
        onClick: () => setPage('settings'),
      },
      {
        icon: Crown,
        title: tr.morePro,
        desc: tr.moreProDesc,
        accent: true,
        onClick: () => (appPlan === 'free' ? openPremium('general') : setPage('settings')),
      },
      {
        icon: Sparkles,
        title: tr.moreAssistant,
        desc: tr.moreAssistantDesc,
        onClick: () => setPage('assistant'),
      },
      {
        icon: Download,
        title: tr.moreExport,
        desc: tr.moreExportDesc,
        onClick: () => setPage('settings'),
      },
      {
        icon: LayoutGrid,
        title: tr.moreAdvanced,
        desc: tr.moreAdvancedDesc,
        onClick: () => setPage('settings'),
      },
      {
        icon: Shield,
        title: tr.moreLegalPrivacy,
        desc: tr.moreLegalPrivacyDesc,
        onClick: () => navigateTo('/privacy'),
      },
      {
        icon: FileText,
        title: tr.moreLegalTerms,
        desc: tr.moreLegalTermsDesc,
        onClick: () => navigateTo('/terms'),
      },
    ];

    return (
      <>
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-3xl" aria-hidden>
            ⚙️
          </div>
          <h1 className="mt-2 text-xl font-bold text-stone-900">{tr.moreTitle}</h1>
          <p className="mt-1 text-sm text-stone-500">{tr.moreLead}</p>
        </section>

        <section className="mb-4 space-y-2">
          {moreMenuRows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.title}
                type="button"
                onClick={row.onClick}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition active:scale-[0.99] ${
                  row.accent
                    ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50'
                    : 'border-stone-100 bg-white hover:border-orange-100'
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    row.accent ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-stone-900">{row.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-stone-500">{row.desc}</span>
                </span>
                <span className="shrink-0 text-stone-300" aria-hidden>
                  ›
                </span>
              </button>
            );
          })}
        </section>

        {import.meta.env.DEV ? (
          <section className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/80 p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-bold text-violet-900">{tr.moreDev}</h2>
            <p className="mb-3 text-[11px] text-violet-800/90">{tr.moreDevDesc}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => persistAppPlan('pro')}
                className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"
              >
                DEV → Pro
              </button>
              <button
                type="button"
                onClick={() => persistAppPlan('free')}
                className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-800"
              >
                DEV → Free
              </button>
            </div>
          </section>
        ) : null}
      </>
    );
  };

  const renderRemindersPage = () => {
    const perm = notificationPerm;
    const canNotify = perm === 'granted';
    const notifyStatus = getNotificationServiceStatus();
    const todayKey = getLocalDateKey();
    const enabledReminders = reminders.filter((r) => r.enabled);
    const todayReminders = enabledReminders
      .filter((r) => reminderAppliesOnDate(r, todayKey))
      .sort((a, b) => a.time.localeCompare(b.time));
    const upcomingReminders = getUpcomingOnceReminders(reminders, todayKey);
    const kindLabel = (k: ReminderKind) => {
      if (k === 'daily') return tr.remindersTypeDaily;
      if (k === 'weight') return tr.remindersTypeWeight;
      if (k === 'deworming') return tr.remindersTypeDeworming;
      if (k === 'vet') return tr.remindersTypeVet;
      return tr.remindersTypeCustom;
    };

    return (
      <>
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-3xl" aria-hidden>🔔</div>
          <h1 className="mt-2 text-xl font-bold text-stone-900">{tr.remindersTitle}</h1>
          <p className="mt-1 text-sm text-stone-500">{tr.remindersLead}</p>
        </section>

        <section className="mb-4 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-stone-900">{tr.remindersNotifySectionTitle}</h2>
          {!getNotificationSupport() ? (
            <p className="mt-2 text-sm text-stone-600">{tr.remindersNotifyUnsupported}</p>
          ) : (
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">{tr.remindersNotifyStatusLabel}</dt>
                <dd className="font-semibold text-stone-900">{permissionStatusLabel(perm, lang)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">{tr.remindersNotifyAllowedLabel}</dt>
                <dd
                  className={`font-semibold ${canNotify ? 'text-emerald-700' : 'text-amber-800'}`}
                >
                  {canNotify ? tr.remindersNotifyAllowedYes : tr.remindersNotifyAllowedNo}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">{tr.remindersNotifyChannelLabel}</dt>
                <dd className="text-right font-medium text-stone-800">
                  {notifyStatus.activeChannel === 'remote'
                    ? 'Remote'
                    : tr.remindersNotifyChannelLocal}
                </dd>
              </div>
            </dl>
          )}
          {canNotify ? (
            <p className="mt-3 text-sm font-medium text-emerald-700">{tr.remindersNotifyGranted}</p>
          ) : getNotificationSupport() ? (
            <>
              {perm === 'denied' ? (
                <p className="mt-3 text-sm font-medium text-amber-800">{tr.remindersNotifyDenied}</p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void requestNotificationPermission().then((next) => {
                    setNotificationPerm(next);
                  });
                }}
                className="mt-3 w-full rounded-xl bg-orange-400 py-2.5 text-sm font-bold text-white"
              >
                {tr.remindersNotifyEnable}
              </button>
            </>
          ) : null}
          <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
            {tr.remindersNotifyChannelRemoteHint}
          </p>
          {getNotificationSupport() ? (
            <button
              type="button"
              disabled={!canNotify}
              onClick={() => {
                const ok = sendTestNotification(lang);
                showToast(ok ? tr.remindersNotifyTestOk : tr.remindersNotifyTestFail, ok ? 'success' : 'error');
              }}
              className="mt-3 w-full rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-sm font-bold text-orange-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {tr.remindersNotifyTest}
            </button>
          ) : null}
        </section>

        <section className="mb-4 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-stone-900">{tr.remindersTodaySection}</h2>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-100">
              {tr.remindersEnabledSection} {enabledReminders.length}
            </span>
          </div>
          {todayReminders.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-stone-600">{tr.remindersTodayEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {todayReminders.map((r) => {
                const cat = cats.find((c) => c.id === r.catId);
                return (
                  <li
                    key={`today-${r.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-orange-100 bg-white px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">{r.title}</p>
                      <p className="text-[11px] text-stone-500">
                        {cat?.emoji} {cat?.name ?? r.catId}
                        {r.repeatType === 'once' && r.dueDate ? ` · ${formatDueDateDisplay(r.dueDate, lang)}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-orange-600">{r.time}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mb-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-stone-900">{tr.remindersUpcomingSection}</h2>
          {upcomingReminders.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-stone-600">{tr.remindersUpcomingEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {upcomingReminders.map((r) => {
                const cat = cats.find((c) => c.id === r.catId);
                return (
                  <li
                    key={`upcoming-${r.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">{r.title}</p>
                      <p className="text-[11px] text-stone-500">
                        {cat?.emoji} {cat?.name ?? r.catId}
                        {r.dueDate ? ` · ${formatDueDateDisplay(r.dueDate, lang)}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-sky-700">{r.time}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="mb-3 text-xs text-stone-500">
          {tr.remindersCount}：{reminders.length} / {reminderLimit}
        </p>
        {reminderLimitHint ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {reminderLimitHint}
            {appPlan === 'free' ? (
              <button
                type="button"
                onClick={() => openPremium('general')}
                className="mt-2 block font-semibold text-orange-600 hover:underline"
              >
                {tr.openSettings}
              </button>
            ) : null}
          </div>
        ) : null}

        <section id="reminders-quick-add" className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold text-stone-900">{tr.remindersAddSection}</h2>
          <p className="mb-3 text-[11px] text-stone-500">{tr.remindersQuickAdd}</p>
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.remindersForCat}</label>
            <select
              value={customReminderCatId}
              onChange={(e) => setCustomReminderCatId(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none focus:border-orange-300"
            >
              {activeCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {REMINDER_TEMPLATES.map((tpl) => {
              const label = lang === 'zh' ? tpl.titleZh : tpl.titleEn;
              return (
                <button
                  key={`${tpl.kind}-${tpl.titleZh}`}
                  type="button"
                  onClick={() => {
                    tryAddReminder(createReminderFromTemplate(tpl, customReminderCatId, lang));
                  }}
                  className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-semibold text-orange-800 hover:bg-orange-100"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-4 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-stone-900">{tr.remindersAddCustom}</h2>
          <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.remindersTitleField}</label>
          <input
            value={customReminderTitle}
            onChange={(e) => setCustomReminderTitle(e.target.value)}
            className="mb-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none focus:border-orange-300"
          />
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.remindersTime}</label>
              <input
                type="time"
                value={customReminderTime}
                onChange={(e) => setCustomReminderTime(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.remindersRepeat}</label>
              <select
                value={customReminderRepeat}
                onChange={(e) => setCustomReminderRepeat(e.target.value as ReminderRepeatType)}
                className="w-full rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="daily">{tr.remindersRepeatDaily}</option>
                <option value="weekly">{tr.remindersRepeatWeekly}</option>
                <option value="monthly">{tr.remindersRepeatMonthly}</option>
                <option value="once">{tr.remindersRepeatOnce}</option>
              </select>
            </div>
          </div>
          {customReminderRepeat === 'once' ? (
            <div className="mb-2">
              <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.remindersDueDate}</label>
              <input
                type="date"
                value={customReminderDueDate}
                onChange={(e) => setCustomReminderDueDate(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm"
              />
            </div>
          ) : null}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.remindersForCat}</label>
              <select
                value={customReminderCatId}
                onChange={(e) => setCustomReminderCatId(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm"
              >
                {activeCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>
            {customReminderRepeat !== 'once' ? (
              <div>
                <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.remindersInterval}</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={customReminderInterval}
                  onChange={(e) => setCustomReminderInterval(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm"
                />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              const title = customReminderTitle.trim();
              if (!title) return;
              if (
                tryAddReminder(
                  createCustomReminder(customReminderCatId, {
                    type: 'custom',
                    title,
                    time: customReminderTime,
                    repeatType: customReminderRepeat,
                    repeatInterval: customReminderInterval,
                    dueDate: customReminderRepeat === 'once' ? customReminderDueDate : null,
                  })
                )
              ) {
                setCustomReminderTitle('');
              }
            }}
            className="w-full rounded-xl bg-orange-400 py-3 text-sm font-bold text-white shadow-sm"
          >
            {tr.remindersAdd}
          </button>
        </section>

        <section className="mb-4">
          <h2 className="mb-3 text-sm font-bold text-stone-900">{tr.remindersListSection}</h2>
          {reminders.length === 0 ? (
            <p className="rounded-2xl border border-stone-100 bg-white px-4 py-6 text-center text-sm leading-relaxed text-stone-600 shadow-sm">
              {tr.remindersEmpty}
            </p>
          ) : (
            <div className="space-y-3">
            {reminders.map((r) => {
              const cat = cats.find((c) => c.id === r.catId);
              return (
                <article
                  key={r.id}
                  className={`rounded-2xl border p-4 shadow-sm ${r.enabled ? 'border-orange-100 bg-white' : 'border-stone-100 bg-stone-50/80 opacity-80'}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-stone-900">{r.title}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {cat?.emoji} {cat?.name ?? r.catId} · {kindLabel(r.type)} · {formatReminderSchedule(r, lang)}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-stone-600">
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={(e) => updateReminder(r.id, { enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-stone-300 text-orange-500"
                      />
                      {tr.remindersEnabled}
                    </label>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold text-stone-500">{tr.remindersTime}</label>
                      <input
                        type="time"
                        value={r.time}
                        onChange={(e) => updateReminder(r.id, { time: e.target.value })}
                        className="rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-orange-300"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold text-stone-500">{tr.remindersRepeat}</label>
                      <select
                        value={r.repeatType}
                        onChange={(e) => {
                          const next = e.target.value as ReminderRepeatType;
                          if (next === 'once') {
                            updateReminder(r.id, {
                              repeatType: next,
                              dueDate: r.dueDate ?? getLocalDateKey(),
                              repeatInterval: 1,
                            });
                          } else {
                            updateReminder(r.id, { repeatType: next, dueDate: null });
                          }
                        }}
                        className="rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-orange-300"
                      >
                        <option value="daily">{tr.remindersRepeatDaily}</option>
                        <option value="weekly">{tr.remindersRepeatWeekly}</option>
                        <option value="monthly">{tr.remindersRepeatMonthly}</option>
                        <option value="once">{tr.remindersRepeatOnce}</option>
                      </select>
                    </div>
                    {r.repeatType === 'once' ? (
                      <div>
                        <label className="mb-0.5 block text-[10px] font-bold text-stone-500">{tr.remindersDueDate}</label>
                        <input
                          type="date"
                          value={r.dueDate ?? getLocalDateKey()}
                          onChange={(e) => updateReminder(r.id, { dueDate: e.target.value })}
                          className="rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-orange-300"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="mb-0.5 block text-[10px] font-bold text-stone-500">{tr.remindersInterval}</label>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={r.repeatInterval}
                          onChange={(e) =>
                            updateReminder(r.id, { repeatInterval: Math.max(1, Number(e.target.value) || 1) })
                          }
                          className="w-16 rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-orange-300"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteReminder(r.id)}
                      className="ml-auto rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                    >
                      {tr.remindersDelete}
                    </button>
                  </div>
                </article>
              );
            })}
            </div>
          )}
        </section>
      </>
    );
  };

  const renderAuthAccountSection = () => {
    if (!supabaseAuth.configured) {
      return (
        <section className="mb-4 rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-bold text-stone-900">{tr.authAccountSection}</h2>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-xs leading-relaxed text-amber-950">{tr.authNotConfigured}</p>
          </div>
        </section>
      );
    }
    if (!supabaseAuth.authReady) {
      return (
        <section className="mb-4 rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-bold text-stone-900">{tr.authAccountSection}</h2>
          <div className="space-y-3 py-2 animate-fade-in">
            <SkeletonLine className="h-4 w-3/5" />
            <SkeletonLine className="h-10 w-full" />
            <div className="flex justify-center pt-2">
              <Spinner className="h-7 w-7 border-2" />
            </div>
            <p className="text-center text-[11px] text-stone-500">{tr.authBootTitle}</p>
          </div>
        </section>
      );
    }
    if (supabaseAuth.user) return null;
    return (
      <section className="mb-4 rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.authAccountSection}</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-stone-500">{tr.authLocalDataHint}</p>

        <div className="mb-3 space-y-2.5">
          <GoogleSignInButton
            label={tr.authGoogleSignIn}
            disabled={authBusy || googleOauthBusy}
            onClick={() => void handleGoogleSignInClick()}
          />
          <AppleSignInButton
            label={tr.authAppleSignIn}
            disabled={authBusy || googleOauthBusy}
            onClick={() => void handleAppleSignInClick()}
          />
        </div>
        {appleSignInNotice ? (
          <p className="mb-3 text-center text-[12px] leading-relaxed text-stone-600">{appleSignInNotice}</p>
        ) : null}
        <p className="mb-3 rounded-xl bg-stone-50/90 px-3 py-2.5 text-[10px] leading-relaxed text-stone-500 ring-1 ring-stone-100/80">
          {tr.authGoogleSetupHint}
        </p>

        <p className="my-3 text-center text-[11px] font-medium text-stone-400">— {lang === 'zh' ? '或' : 'or'} —</p>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${authMode === 'signIn' ? 'bg-orange-400 text-white' : 'bg-stone-100 text-stone-600'}`}
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
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${authMode === 'signUp' ? 'bg-orange-400 text-white' : 'bg-stone-100 text-stone-600'}`}
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
          className="mb-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[13px] outline-none focus:border-orange-300"
        />
        <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.authPassword}</label>
        <input
          type="password"
          autoComplete={authMode === 'signIn' ? 'current-password' : 'new-password'}
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
          className="mb-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[13px] outline-none focus:border-orange-300"
        />
        {authMode === 'signUp' ? (
          <>
            <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.authDisplayNameOptional}</label>
            <input
              type="text"
              value={authDisplayNameReg}
              onChange={(e) => setAuthDisplayNameReg(e.target.value)}
              className="mb-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[13px] outline-none focus:border-orange-300"
            />
          </>
        ) : null}
        {authFormError ? <p className="mb-2 text-[13px] font-medium text-red-600">{authFormError}</p> : null}
        {authMessage ? <p className="mb-2 text-[13px] font-medium text-green-700">{authMessage}</p> : null}
        <button
          type="button"
          disabled={authBusy || googleOauthBusy}
          onClick={() => void handleAuthSubmit()}
          className="w-full rounded-xl bg-orange-400 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-55"
        >
          {authBusy ? tr.authProcessing : authMode === 'signIn' ? tr.authSignIn : tr.authSignUp}
        </button>
      </section>
    );
  };

  const renderSettingsPage = () => (
    <>
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setPage('more')}
          className="mb-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-bold text-stone-700"
        >
          ← {tr.settingsBack}
        </button>
        <h1 className="text-xl font-bold text-stone-900">{tr.settingsTitle}</h1>
      </section>

      <section className="mb-4">
        {(() => {
          const q = buildLocalAiQuota(appPlan, aiClientId, today);
          return (
            <AiDailyQuotaCard
              lang={lang}
              plan={appPlan}
              used={q.dailyUsed}
              limit={q.dailyLimit}
              title={tr.settingsAiQuotaTitle}
              upgradeLabel={tr.settingsSwitchPro}
              onUpgrade={q.dailyRemaining <= 0 && appPlan === 'free' ? () => openPremium('ai') : undefined}
            />
          );
        })()}
        <p className="mt-2 px-0.5 text-[11px] leading-relaxed text-stone-500">{tr.settingsAiQuotaHint}</p>
      </section>

      {renderAuthAccountSection()}

      <ProSubscriptionPanel
        lang={lang}
        status={appPlan}
        busy={subscriptionBusy}
        onUpgrade={(period) => void handlePurchasePro(period)}
        onDowngrade={() => persistAppPlan('free')}
        onRestore={() => void handleRestorePurchases()}
      />
      <p className="mb-4 px-0.5 text-[11px] leading-relaxed text-stone-500">{tr.settingsPlanServerHint}</p>
      <p className="mb-4 px-0.5 text-[11px] font-medium text-stone-500">{tr.settingsClientIdCaption}</p>
      <p className="mb-4 break-all rounded-lg bg-stone-50/90 px-2 py-1.5 font-mono text-[11px] text-stone-600">{aiClientId}</p>

      <section className="mb-4 rounded-2xl bg-white p-3.5 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.backupTitle}</h2>
        <p className="mb-3 text-[12px] leading-snug text-stone-500">{tr.backupDesc}</p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={exportBackup}
            className="rounded-xl bg-orange-400 py-2.5 text-sm font-bold text-white shadow-sm"
          >
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

      <section className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-stone-900">{tr.settingsOnboardingTitle}</h2>
        <p className="mb-3 text-[12px] leading-snug text-stone-500">{tr.settingsOnboardingDesc}</p>
        <button
          type="button"
          onClick={replayOnboarding}
          className="w-full rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-sm font-bold text-orange-800 transition active:scale-[0.99]"
        >
          {tr.settingsReplayOnboarding}
        </button>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-3.5 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-stone-900">{tr.legalSectionTitle}</h2>
        <p className="mb-3 text-[12px] leading-snug text-stone-500">{tr.legalSectionDesc}</p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigateTo('/privacy')}
            className="flex w-full items-center justify-between rounded-xl border border-orange-100 bg-gradient-to-r from-amber-50/80 to-orange-50/50 px-4 py-3 text-left transition active:scale-[0.99]"
          >
            <span className="text-sm font-bold text-stone-900">{tr.legalPrivacyLink}</span>
            <span className="text-orange-500" aria-hidden>
              →
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigateTo('/terms')}
            className="flex w-full items-center justify-between rounded-xl border border-stone-100 bg-stone-50/80 px-4 py-3 text-left transition active:scale-[0.99]"
          >
            <span className="text-sm font-bold text-stone-900">{tr.legalTermsLink}</span>
            <span className="text-stone-400" aria-hidden>
              →
            </span>
          </button>
        </div>
      </section>
    </>
  );

  const renderCatsPage = () => (
    <>
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setPage('today')}
          className="mb-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-bold text-stone-700"
        >
          ← {tr.catsBack}
        </button>
        <h1 className="text-xl font-bold text-stone-900">{tr.catsPageTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">{tr.catsPageLead}</p>
      </section>

      {appPlan === 'free' && activeCats.length > FREE_MAX_ACTIVE_PETS ? (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-950 shadow-sm">
          <p className="m-0">{tr.planFreeMultiCatBanner}</p>
          <button
            type="button"
            onClick={() => openPremium('pets')}
            className="mt-2 font-semibold text-orange-600 hover:underline"
          >
            {tr.settingsSwitchPro}
          </button>
        </div>
      ) : null}

      {petsBootReady && supabaseAuth.user && supabaseAuth.supabase && !catsCloudBusy && catsCloudErr ? (
        <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] leading-snug text-red-900 shadow-sm">
          <p className="m-0 font-medium">{tr.catsCloudLoadErr}</p>
          <p className="mt-1 text-[11px] text-red-800/90">{tr.toastGenericError}</p>
        </div>
      ) : null}

      {petsBootReady && activeCats.length === 0 && !catsCloudBusy ? (
        <div className="mb-4 animate-fade-in rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-sm">
          <p className="text-[15px] font-semibold leading-relaxed text-stone-800">{tr.emptyPetsTitle}</p>
          <button
            type="button"
            onClick={() => document.getElementById('add-cat-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="mt-5 w-full rounded-2xl bg-orange-500 py-3 text-[14px] font-bold text-white shadow-md shadow-orange-300/40 transition active:scale-[0.99]"
          >
            {tr.emptyPetsCta}
          </button>
        </div>
      ) : null}

      {petsBootReady ? (
      <section className="mb-4 rounded-2xl bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.catList}</h2>
        <div className="space-y-2">
          {activeCats.map((cat) => (
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
                    scrollToSharedCareSection();
                  }}
                  className="shrink-0 rounded-full bg-orange-100 px-2 py-1.5 text-[11px] font-bold leading-tight text-orange-800"
                >
                  {tr.sharedCareTitle}
                </button>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    type="button"
                    disabled={archiveBusyId === cat.id || !isValidPetForArchive(cat)}
                    onClick={() => void archiveCat(cat.id)}
                    className="rounded-full bg-stone-100 px-2.5 py-1.5 text-xs font-bold text-stone-600 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {archiveBusyId === cat.id ? tr.authProcessing : tr.archive}
                  </button>
                  {!canManageCatLifecycle(cat.id) ? (
                    <p className="max-w-[5.5rem] text-right text-[9px] leading-tight text-amber-800">
                      {tr.archiveErrPermission}
                    </p>
                  ) : null}
                  {archiveErrByCatId[cat.id] ? (
                    <p className="max-w-[8rem] text-right text-[9px] leading-tight text-red-700">
                      {archiveErrByCatId[cat.id]}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {petsBootReady ? (
      <section id="add-cat-form" className="mb-4 rounded-2xl bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-stone-900">{tr.addCat}</h2>
        <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.petType}</label>
        <div className="mb-2 flex gap-2">
          {(['cat', 'dog'] as PetType[]).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setNewCatPetType(pt)}
              className={`flex-1 rounded-xl border py-2 text-sm font-bold transition ${
                newCatPetType === pt
                  ? 'border-orange-400 bg-orange-50 text-orange-800'
                  : 'border-stone-200 bg-white text-stone-600'
              }`}
            >
              {pt === 'cat' ? `🐱 ${tr.petTypeCat}` : `🐶 ${tr.petTypeDog}`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newCatName}
            onChange={(e) => {
              setNewCatName(e.target.value);
              setAddCatNameError(null);
            }}
            placeholder={tr.catNamePlaceholder}
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-orange-300"
          />
          <button
            type="button"
            onClick={() => {
              if (appPlan === 'free' && activeCats.length >= FREE_MAX_ACTIVE_PETS) {
                openPremium('pets');
                return;
              }
              void addCat();
            }}
            className="shrink-0 rounded-xl bg-orange-400 px-4 py-2 text-sm font-bold text-white"
          >
            {tr.add}
          </button>
        </div>
        {addCatNameError ? <p className="mt-2 text-[12px] leading-snug text-red-700">{addCatNameError}</p> : null}
        {appPlan === 'free' && activeCats.length >= FREE_MAX_ACTIVE_PETS ? (
          <p className="mt-2 text-[12px] leading-snug text-amber-900">{tr.planMultiCatUpgrade}</p>
        ) : null}
      </section>
      ) : null}

      <section className="mb-4 rounded-2xl border border-stone-200 bg-stone-50/80 p-3 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-stone-900">{tr.archivedCatsSection}</h2>
        <p className="mb-3 text-[12px] leading-snug text-stone-500">{tr.archivedCatsHint}</p>
        {archivedCats.length === 0 ? (
          <p className="text-sm text-stone-500">{tr.archivedCatsEmpty}</p>
        ) : (
          <div className="space-y-2">
            {archivedCats.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white p-2.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {cat.profilePhoto ? (
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-stone-100 opacity-80">
                      <img src={cat.profilePhoto} alt={cat.name} className="h-full w-full object-cover" />
                    </span>
                  ) : (
                    <span className="text-xl leading-none opacity-70">{cat.emoji}</span>
                  )}
                  <span className="truncate text-sm font-bold text-stone-700">{cat.name}</span>
                </div>
                {canManageCatLifecycle(cat.id) ? (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => void restoreCat(cat.id)}
                      className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-800"
                    >
                      {tr.restoreCat}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermanentDeleteTarget(cat)}
                      className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                    >
                      {tr.permanentlyDelete}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

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
              <div className="flex h-full w-full items-center justify-center text-3xl">
                {selectedCat?.emoji ?? defaultEmojiForPetType(selectedCat?.petType ?? 'cat')}
              </div>
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
          <div>
            <label className="mb-1 block text-[11px] font-bold text-stone-500">{tr.petType}</label>
            <div className="flex gap-2">
              {(['cat', 'dog'] as PetType[]).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() =>
                    updateSelectedCat({
                      petType: pt,
                      emoji: defaultEmojiForPetType(pt),
                    })
                  }
                  className={`flex-1 rounded-xl border py-2 text-sm font-bold transition ${
                    (selectedCat?.petType ?? 'cat') === pt
                      ? 'border-orange-400 bg-orange-50 text-orange-800'
                      : 'border-stone-200 bg-white text-stone-600'
                  }`}
                >
                  {pt === 'cat' ? `🐱 ${tr.petTypeCat}` : `🐶 ${tr.petTypeDog}`}
                </button>
              ))}
            </div>
          </div>
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
            {renderProfileChoiceField('gender', tr.gender, selectedCat?.gender, tr.profileGenderTap)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {renderProfileInput(tr.breed, selectedCat?.breed, 'breed', lang === 'zh' ? '米克斯 / 英短' : 'Mix / British Shorthair')}
            {renderProfileChoiceField('neutered', tr.neutered, selectedCat?.neutered, tr.profileNeuteredTap)}
          </div>
          {renderProfileInput(tr.chipNo, selectedCat?.chipNo, 'chipNo')}
          {renderProfileTextarea(tr.chronicNote, selectedCat?.chronicNote, 'chronicNote', lang === 'zh' ? '例如：腎臟病、心臟病、長期用藥' : 'Example: kidney disease, heart disease, medication')}
          {renderProfileTextarea(tr.allergyNote, selectedCat?.allergyNote, 'allergyNote')}
          {renderProfileInput(tr.vetClinic, selectedCat?.vetClinic, 'vetClinic')}
          {renderProfileTextarea(tr.profileNote, selectedCat?.profileNote, 'profileNote')}
        </div>

      </section>

      <section id="shared-care-section" className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-stone-900">{tr.sharedCareTitle}</h2>
        <p className="mb-3 text-xs leading-relaxed text-stone-500">{tr.sharedCareNavHint}</p>
        {renderSharedCareContent()}
      </section>
    </>
  );

  return (
    <div className="min-h-screen bg-orange-50 px-4 py-6 text-stone-800">
      {showOnboarding ? <Onboarding lang={lang} onComplete={completeOnboarding} /> : null}
      {!petsBootReady || (supabaseAuth.configured && !supabaseAuth.authReady) ? (
        <div className="mx-auto max-w-md space-y-5 px-2 py-14 animate-fade-in">
          <p className="text-center text-[14px] font-semibold text-stone-600">
            {!petsBootReady ? tr.bootstrapPreparing : tr.authBootTitle}
          </p>
          <SkeletonCard rows={5} />
          <div className="flex justify-center pt-2">
            <Spinner className="h-10 w-10 border-[3px]" />
          </div>
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-md pb-24">
        {bootstrap.bootstrapStatus === 'error' ? (
          <div
            className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-950"
            role="status"
          >
            {tr.bootstrapInitFailed}
          </div>
        ) : null}
        {!isOnline ? (
          <OfflineBanner message={tr.offlineBanner} />
        ) : offlineSyncError ? (
          <OfflineBanner
            message={tr.offlineSyncFailed}
            syncError={offlineSyncError}
            retryLabel={offlineSyncBusy ? tr.authProcessing : tr.offlineSyncRetry}
            onRetry={() => void flushOfflinePending()}
          />
        ) : null}
        <nav
          className="mb-4 select-none rounded-3xl border border-orange-100/90 bg-white p-2.5 shadow-[0_14px_44px_-16px_rgba(234,88,12,0.45)]"
          aria-label={lang === 'zh' ? '主要功能' : 'Main'}
        >
          <div className="flex flex-col gap-2.5">
            {MAIN_TAB_ROWS.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={`grid grid-cols-3 gap-2 ${rowIndex > 0 ? 'border-t border-orange-100/90 pt-2.5' : ''}`}
              >
              {row.map((tab) => {
                const moreActive = tab.id === 'more' && MORE_SUB_PAGES.includes(page);
                const active = tab.id === 'more' ? moreActive : page === tab.id;
                const TabIcon = tab.Icon;
                const label = tr[tab.labelKey];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPage(tab.id)}
                    aria-current={active ? 'page' : undefined}
                    aria-label={label}
                    className={`relative flex min-h-[5rem] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl px-1 pb-3 pt-2.5 transition-all duration-200 ease-out active:scale-[0.97] ${
                      active
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40 ring-2 ring-orange-300/70'
                        : 'border border-stone-200/90 bg-stone-50 text-stone-800 shadow-sm hover:border-orange-200 hover:bg-orange-50/80'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        active ? 'bg-white/20 text-white' : 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-100/80'
                      }`}
                      aria-hidden
                    >
                      <TabIcon className="h-6 w-6" strokeWidth={active ? 2.5 : 2.15} />
                    </span>
                    <span
                      className={`max-w-full px-0.5 text-center text-[15px] leading-tight tracking-wide ${
                        active ? 'font-extrabold text-white' : 'font-bold text-stone-800'
                      }`}
                    >
                      {label}
                    </span>
                    <span
                      className={`absolute inset-x-4 bottom-1.5 h-1 rounded-full transition-all duration-200 ${
                        active ? 'bg-white/95 shadow-sm' : 'h-0 opacity-0'
                      }`}
                      aria-hidden
                    />
                  </button>
                );
              })}
              </div>
            ))}
          </div>
        </nav>

        {appPlan === 'pro' ? (
          <div className="mb-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-white shadow-md shadow-orange-300/40">
              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-100" strokeWidth={2.5} aria-hidden />
              {tr.navProBadge}
            </span>
          </div>
        ) : null}

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

        <div key={page} className="page-tab-fade">
        {page === 'today' && renderTodayPage()}
        {page === 'weight' && renderWeightPage()}
        {page === 'vet' && renderVetPage()}
        {page === 'history' && renderHistoryPage()}
        {page === 'reminders' && renderRemindersPage()}
        {page === 'more' && renderMorePage()}
        {page === 'cats' && renderCatsPage()}
        {page === 'settings' && renderSettingsPage()}
        {page === 'sharedCare' && renderSharedCarePage()}
        {page === 'assistant' && renderAssistantPage()}
        </div>

      </div>

      {permanentDeleteTarget ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="permanent-delete-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="permanent-delete-title" className="text-base font-bold text-stone-900">
              {tr.permanentDeleteTitle}
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-600">
              {tr.permanentDeleteBody}
            </p>
            <p className="mt-2 text-sm font-semibold text-stone-800">「{permanentDeleteTarget.name}」</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={permanentDeleteBusy}
                onClick={() => setPermanentDeleteTarget(null)}
                className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-bold text-stone-700 disabled:opacity-50"
              >
                {tr.cancel}
              </button>
              <button
                type="button"
                disabled={permanentDeleteBusy}
                onClick={() => void confirmPermanentDeleteCat()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              >
                {permanentDeleteBusy ? tr.permanentDeleteBusy : tr.permanentlyDelete}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {profileFieldPicker ? (
        <div
          className="fixed inset-0 z-[61] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-picker-title"
          onClick={() => setProfileFieldPicker(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="profile-picker-title" className="text-base font-bold text-stone-900">
              {profileFieldPicker === 'gender' ? tr.profilePickGenderTitle : tr.profilePickNeuteredTitle}
            </h2>
            <div className="mt-4 grid gap-2">
              {profileFieldPicker === 'gender' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      updateSelectedCat({ gender: tr.petGenderMale });
                      setProfileFieldPicker(null);
                    }}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 text-sm font-bold text-stone-800 active:bg-orange-50"
                  >
                    {tr.petGenderMale}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateSelectedCat({ gender: tr.petGenderFemale });
                      setProfileFieldPicker(null);
                    }}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 text-sm font-bold text-stone-800 active:bg-orange-50"
                  >
                    {tr.petGenderFemale}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      updateSelectedCat({ neutered: tr.petNeuteredYes });
                      setProfileFieldPicker(null);
                    }}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 text-sm font-bold text-stone-800 active:bg-orange-50"
                  >
                    {tr.petNeuteredYes}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateSelectedCat({ neutered: tr.petNeuteredNo });
                      setProfileFieldPicker(null);
                    }}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 text-sm font-bold text-stone-800 active:bg-orange-50"
                  >
                    {tr.petNeuteredNo}
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setProfileFieldPicker(null)}
              className="mt-3 w-full rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-bold text-stone-600"
            >
              {tr.cancel}
            </button>
          </div>
        </div>
      ) : null}

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

      <PremiumUpsellSheet
        open={premiumSheetOpen}
        lang={lang}
        reason={premiumSheetReason}
        busy={subscriptionBusy}
        onClose={() => setPremiumSheetOpen(false)}
        onUpgrade={(period) => void handlePurchasePro(period)}
        onRestore={() => void handleRestorePurchases()}
      />
        </>
      )}
    </div>
  );
}
