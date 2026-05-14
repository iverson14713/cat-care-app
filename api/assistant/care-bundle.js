import { assistCareBundlePOST } from '../../server/assistant-routes.mjs';
import { readBodyStream, sendJsonRes, sendOptions } from '../lib/vercel-res.mjs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendOptions(res);
    return;
  }
  if (req.method !== 'POST') {
    sendJsonRes(res, 405, { error: 'Method not allowed' });
    return;
  }
  let bodyRaw;
  try {
    bodyRaw = await readBodyStream(req);
  } catch (e) {
    sendJsonRes(res, 413, { error: e instanceof Error ? e.message : 'Body too large' });
    return;
  }
  let body;
  try {
    body = JSON.parse(bodyRaw || '{}');
  } catch {
    sendJsonRes(res, 400, { error: 'Invalid JSON body' });
    return;
  }
  try {
    const { status, json } = await assistCareBundlePOST(body);
    sendJsonRes(res, status, json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e?.code === 'NO_API_KEY' ? 'NO_API_KEY' : 'SERVER';
    const status = e?.code === 'NO_API_KEY' ? 503 : 500;
    sendJsonRes(res, status, { error: msg, code });
  }
}
