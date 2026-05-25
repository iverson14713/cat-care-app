import type { ComponentType } from 'react';
import { AppStoreAssistantScreen } from './screens/AppStoreAssistantScreen';
import { AppStoreRemindersScreen } from './screens/AppStoreRemindersScreen';
import { AppStoreSharedCareScreen } from './screens/AppStoreSharedCareScreen';
import { AppStoreTodayScreen } from './screens/AppStoreTodayScreen';
import { AppStoreWeightScreen } from './screens/AppStoreWeightScreen';

export type AppStoreSlide = {
  id: string;
  headline: string;
  subtitle: string;
  filename: string;
  Screen: ComponentType;
};

export const APP_STORE_SLIDES: AppStoreSlide[] = [
  {
    id: 'today',
    headline: '異常紀錄不漏接',
    subtitle: '餵食、清潔、異常狀況，每日照護一目了然',
    filename: 'pet-care-01-today.png',
    Screen: AppStoreTodayScreen,
  },
  {
    id: 'weight',
    headline: '體重追蹤看得見',
    subtitle: '圖表與紀錄並行，健康變化隨手掌握',
    filename: 'pet-care-02-weight.png',
    Screen: AppStoreWeightScreen,
  },
  {
    id: 'shared-care',
    headline: '共同照護更安心',
    subtitle: '家人、室友共享同一隻寵物的雲端紀錄',
    filename: 'pet-care-03-shared-care.png',
    Screen: AppStoreSharedCareScreen,
  },
  {
    id: 'reminders',
    headline: '提醒不錯過',
    subtitle: '餵食、回診、驅蟲，準時推播通知',
    filename: 'pet-care-04-reminders.png',
    Screen: AppStoreRemindersScreen,
  },
  {
    id: 'assistant',
    headline: 'AI 週報智慧整理',
    subtitle: '依照護紀錄產生週報，快速掌握本週狀況',
    filename: 'pet-care-05-ai-weekly.png',
    Screen: AppStoreAssistantScreen,
  },
];
