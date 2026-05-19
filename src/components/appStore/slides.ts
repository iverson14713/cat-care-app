import type { ComponentType } from 'react';
import { MockAssistantScreen } from './screens/MockAssistantScreen';
import { MockRemindersScreen } from './screens/MockRemindersScreen';
import { MockTodayScreen } from './screens/MockTodayScreen';
import { MockVetScreen } from './screens/MockVetScreen';
import { MockWeightScreen } from './screens/MockWeightScreen';

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
    headline: '每日照護一目了然',
    subtitle: '餵食、清潔、異常紀錄，一個 App 全掌握',
    filename: 'pet-care-01-today.png',
    Screen: MockTodayScreen,
  },
  {
    id: 'weight',
    headline: '體重趨勢隨手記',
    subtitle: '圖表追蹤健康變化，成長看得見',
    filename: 'pet-care-02-weight.png',
    Screen: MockWeightScreen,
  },
  {
    id: 'vet',
    headline: '獸醫報告一鍵生成',
    subtitle: '帶著完整紀錄去看診更安心',
    filename: 'pet-care-03-vet.png',
    Screen: MockVetScreen,
  },
  {
    id: 'reminders',
    headline: '提醒不錯過',
    subtitle: '餵食、回診、驅蟲，準時通知',
    filename: 'pet-care-04-reminders.png',
    Screen: MockRemindersScreen,
  },
  {
    id: 'assistant',
    headline: 'AI 照護助手',
    subtitle: '智慧整理本週狀況，照護更省心',
    filename: 'pet-care-05-ai.png',
    Screen: MockAssistantScreen,
  },
];
