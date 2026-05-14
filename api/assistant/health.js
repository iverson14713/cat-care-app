import { assistHealthGET } from '../../server/assistant-routes.mjs';
import { sendJsonRes, sendOptions } from '../lib/vercel-res.mjs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendOptions(res);
    return;
  }
  if (req.method !== 'GET') {
    sendJsonRes(res, 405, { error: 'Method not allowed' });
    return;
  }
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const { status, json } = assistHealthGET(url.searchParams);
    sendJsonRes(res, status, json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJsonRes(res, 500, { error: msg, code: 'SERVER' });
  }
}
