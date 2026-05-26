import type { Lang } from '../lib/lang';
import type { PurchaseErrorCode } from './types';

export function purchaseSuccessMessage(lang: Lang): string {
  return lang === 'zh' ? '已開通 Pro 會員' : 'Pro membership is active';
}

export function restoreSuccessMessage(lang: Lang): string {
  return lang === 'zh' ? '已恢復 Pro 訂閱' : 'Pro subscription restored';
}

export function purchaseErrorMessage(lang: Lang, code: PurchaseErrorCode): string {
  const zh = lang === 'zh';
  switch (code) {
    case 'USER_CANCELLED':
      return zh ? '已取消購買' : 'Purchase canceled';
    case 'NO_PURCHASES':
      return zh ? '找不到可恢復的購買紀錄' : 'No purchases found to restore';
    case 'IAP_NOT_CONFIGURED':
      return zh
        ? '請在 iPhone 的 Pet Care App 內完成訂閱'
        : 'Please subscribe inside the Pet Care iOS app';
    case 'RESTORE_FAILED':
      return zh ? '恢復購買失敗，請稍後再試' : 'Could not restore purchases. Try again later.';
    default:
      return zh ? '無法完成購買，請稍後再試' : 'Purchase could not be completed. Try again later.';
  }
}
