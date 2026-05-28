import { deleteAccountPOST } from '../../server/account-routes.mjs';
import { sendJsonRes, sendOptions } from '../lib/vercel-res.mjs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendOptions(res);
    return;
  }
  if (req.method !== 'POST') {
    sendJsonRes(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const authorization = req.headers?.authorization || req.headers?.Authorization || '';
    const { status, json } = await deleteAccountPOST({ authorization });
    sendJsonRes(res, status, json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJsonRes(res, 500, { error: msg, code: 'SERVER' });
  }
}

