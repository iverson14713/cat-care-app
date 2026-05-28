import { useEffect, useState } from 'react';
import { isNativeIapAvailable } from './iapBridge';
import { loadStoreProductPrices, type StorePricesLoadResult } from './storeProductPrices';

type Lang = 'zh' | 'en';

export function useStoreProductPrices(lang: Lang, enabled = true): StorePricesLoadResult {
  const native = isNativeIapAvailable();
  const [result, setResult] = useState<StorePricesLoadResult>(() => ({
    status: native && enabled ? 'loading' : 'ready',
    prices: {},
    products: [],
  }));

  useEffect(() => {
    if (!enabled) return;
    if (!native) {
      void loadStoreProductPrices(lang).then(setResult);
      return;
    }
    let cancelled = false;
    setResult((prev) => ({ ...prev, status: 'loading' }));
    void loadStoreProductPrices(lang).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [lang, native, enabled]);

  return result;
}
