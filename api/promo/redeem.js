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
      sendJsonRes(res, 400, { ok: false, error: 'Invalid JSON body', code: 'INVALID_JSON' });
      return;
    }
    const { status, json } = await redeemPromoPOST({ authorization, body });
    sendJsonRes(res, status, json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJsonRes(res, 500, { ok: false, error: msg, code: 'SERVER' });
  }
}
