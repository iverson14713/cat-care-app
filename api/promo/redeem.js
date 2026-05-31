import { redeemPromoPOST } from '../../server/promo-routes.mjs';
import { readBodyStream, sendJsonRes, sendOptions } from '../lib/vercel-res.mjs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendOptions(res);
    return;
  }
  if (req.method !== 'POST') {
    sendJsonRes(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const authorization = req.headers?.authorization || req.headers?.Authorization || '';
    const raw = await readBodyStream(req);
    let body = {};
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      sendJsonRes(res, 400, {
        ok: false,
        error: 'Invalid JSON body',
        code: 'INVALID_REQUEST',
        message: '請輸入有效的兌換碼',
      });
      return;
    }
    const { status, json } = await redeemPromoPOST({ authorization, body });
    sendJsonRes(res, status, json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[promo/redeem] failed', { step: 'handler', userId: null, code: null, error: msg });
    sendJsonRes(res, 500, {
      ok: false,
      error: msg,
      code: 'UNKNOWN_ERROR',
      message: '兌換失敗，請稍後再試',
    });
  }
}
