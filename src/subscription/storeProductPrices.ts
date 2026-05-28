import PetCareIAP, { type PetCareIapProduct } from '../native/petCareIap';
import { IAP_PRODUCT_IDS, SUBSCRIPTION_PRICING } from './constants';
import { isNativeIapAvailable } from './iapBridge';
import type { BillingPeriod } from './types';

export type StorePricesStatus = 'loading' | 'ready' | 'error';

export type StorePricesLoadResult = {
  status: StorePricesStatus;
  prices: Partial<Record<BillingPeriod, string>>;
  products: PetCareIapProduct[];
};

type PriceLang = 'zh' | 'en';

function twFallback(period: BillingPeriod, lang: PriceLang): string {
  return lang === 'zh'
    ? SUBSCRIPTION_PRICING[period].labelZh
    : SUBSCRIPTION_PRICING[period].labelEn;
}

/** App 繁體中文或裝置台灣 — 正式 UI 顯示台幣標價。 */
export function shouldUseTaiwanPriceLabels(lang: PriceLang): boolean {
  if (lang === 'zh') return true;
  return prefersTaiwanPricing();
}

/** zh-TW app or device region Taiwan. */
export function prefersTaiwanPricing(): boolean {
  try {
    const nav = navigator.language?.trim() ?? '';
    if (nav === 'zh-TW' || nav.startsWith('zh-TW')) return true;
    const locale = new Intl.Locale(nav);
    if (locale.region === 'TW') return true;
  } catch {
    const nav = navigator.language?.trim() ?? '';
    if (/^zh(-|_)?TW$/i.test(nav)) return true;
  }
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    if (opts.locale === 'zh-TW' || opts.locale?.startsWith('zh-TW')) return true;
  } catch {
    // ignore
  }
  return false;
}

/** True when displayPrice is US-dollar style ($…), not NT$ / 新台幣. */
export function isUsdLikeDisplayPrice(displayPrice: string): boolean {
  const t = displayPrice.trim();
  if (!t) return false;
  if (/^NT\$?\s*/i.test(t) || /新台幣|臺幣|TWD/i.test(t)) return false;
  return t.includes('$');
}

function isTwdStoreKitDisplay(product: PetCareIapProduct): boolean {
  const cc = product.currencyCode?.trim().toUpperCase();
  if (cc === 'TWD' || cc === 'NTD') return true;
  const dp = product.displayPrice?.trim() ?? '';
  if (/^NT\$?\s*/i.test(dp)) return true;
  if (/新台幣|臺幣/.test(dp)) return true;
  return false;
}

function resolveDisplayPrice(
  product: PetCareIapProduct | undefined,
  period: BillingPeriod,
  lang: PriceLang
): string | null {
  if (!product?.displayPrice?.trim()) return null;

  if (shouldUseTaiwanPriceLabels(lang)) {
    if (isTwdStoreKitDisplay(product) && !isUsdLikeDisplayPrice(product.displayPrice)) {
      return product.displayPrice.trim();
    }
    console.warn('[PetCare IAP] using TWD list price (StoreKit was not TWD)', {
      period,
      productId: product.productId,
      displayPrice: product.displayPrice,
      currencyCode: product.currencyCode,
      fallback: twFallback(period, lang),
    });
    return twFallback(period, lang);
  }

  if (isUsdLikeDisplayPrice(product.displayPrice)) {
    return product.displayPrice.trim();
  }
  return product.displayPrice.trim();
}

function indexProducts(products: PetCareIapProduct[]): Partial<Record<BillingPeriod, PetCareIapProduct>> {
  const map: Partial<Record<BillingPeriod, PetCareIapProduct>> = {};
  for (const p of products) {
    if (p.productId === IAP_PRODUCT_IDS.monthly || p.period === 'monthly') {
      map.monthly = p;
    }
    if (p.productId === IAP_PRODUCT_IDS.yearly || p.period === 'yearly') {
      map.yearly = p;
    }
  }
  return map;
}

/**
 * Load StoreKit prices for UI. On native iOS both periods must resolve together.
 */
export async function loadStoreProductPrices(lang: PriceLang): Promise<StorePricesLoadResult> {
  if (!isNativeIapAvailable()) {
    return {
      status: 'ready',
      prices: {
        monthly: twFallback('monthly', lang),
        yearly: twFallback('yearly', lang),
      },
      products: [],
    };
  }

  try {
    const { products } = await PetCareIAP.getProducts();
    console.log('[PetCare IAP] getProducts raw JSON', JSON.stringify(products, null, 2));

    const byPeriod = indexProducts(products);
    const hasMonthly = Boolean(byPeriod.monthly);
    const hasYearly = Boolean(byPeriod.yearly);

    console.log('[PetCare IAP] products indexed', {
      useTaiwanLabels: shouldUseTaiwanPriceLabels(lang),
      monthly: byPeriod.monthly ?? null,
      yearly: byPeriod.yearly ?? null,
      expectedIds: IAP_PRODUCT_IDS,
    });

    if (!hasMonthly || !hasYearly) {
      console.warn('[PetCare IAP] missing product from StoreKit', {
        hasMonthly,
        hasYearly,
        returnedIds: products.map((p) => p.productId),
      });
      return { status: 'error', prices: {}, products };
    }

    const monthly = resolveDisplayPrice(byPeriod.monthly, 'monthly', lang);
    const yearly = resolveDisplayPrice(byPeriod.yearly, 'yearly', lang);

    if (!monthly || !yearly) {
      return { status: 'error', prices: {}, products };
    }

    console.log('[PetCare IAP] UI prices resolved', { monthly, yearly, lang });

    return {
      status: 'ready',
      prices: { monthly, yearly },
      products,
    };
  } catch (e) {
    console.error('[PetCare IAP] getProducts failed', e);
    return { status: 'error', prices: {}, products: [] };
  }
}

/** @deprecated Use loadStoreProductPrices */
export async function fetchStoreProductPricesForLegacy(
  lang: PriceLang
): Promise<Partial<Record<BillingPeriod, string>>> {
  const r = await loadStoreProductPrices(lang);
  return r.status === 'ready' ? r.prices : {};
}
