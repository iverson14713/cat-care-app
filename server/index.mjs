import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import dotenv from 'dotenv';
import http from 'node:http';
import { systemBase, careBundleUserPrompt, qaUserPrompt } from './prompts.mjs';
import { openAiChatCompletion } from './openai.mjs';
import {
  assertDailyQuota,
  assertMinuteRate,
  getDailyLimit,
  incrementDailyUsed,
  peekDailyUsed,
} from './guard.mjs';
import { appendUsageLog } from './usage-log.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const ENV_LOCAL_FILE = path.join(ROOT_DIR, '.env.local');
dotenv.config({ path: ENV_FILE });
dotenv.config({ path: ENV_LOCAL_FILE, override: true });

const PORT = Number(process.env.ASSISTANT_SERVER_PORT || 8788);
const MAX_CONTEXT_CHARS = 48_000;
const MAX_QUESTION_CHARS = 8_000;
const CARE_MAX_TOKENS = 1200;
const QA_MAX_TOKENS = 600;

const MODEL = (process.env.OPENAI_MODEL || 'gpt-5.4-mini').trim();

function estUsdFromUsage(usage) {
  const inPer1m = Number(process.env.AI_EST_INPUT_PER_1M_USD);
  const outPer1m = Number(process.env.AI_EST_OUTPUT_PER_1M_USD);
  if (!usage || (!Number.isFinite(inPer1m) && !Number.isFinite(outPer1m))) return null;
  const pt = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
  const ct = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
  const i = Number.isFinite(inPer1m) ? inPer1m : 0;
  const o = Number.isFinite(outPer1m) ? outPer1m : 0;
  if (i === 0 && o === 0) return null;
  return (pt / 1_000_000) * i + (ct / 1_000_000) * o;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function tryParseJsonObject(raw) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Invalid JSON from model');
  }
}

function readBody(req, maxBytes = 512_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

/** Stable client id from browser localStorage (not a login). */
function isClientId(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return t.length >= 8 && t.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(t);
}

function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

function isCatId(s) {
  return typeof s === 'string' && s.trim().length >= 1 && s.trim().length <= 128;
}

function logLine(partial) {
  appendUsageLog({
    t: new Date().toISOString(),
    model: MODEL,
    ...partial,
  });
}

/** @returns {boolean} false if response already sent (429). */
function assistantRateAndQuota(res, clientId, catId, usageDate, feature) {
  const minute = assertMinuteRate(clientId);
  if (!minute.ok) {
    logLine({
      userId: clientId,
      catId,
      feature,
      ok: false,
      statusCode: 429,
      error: minute.message || 'RATE',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estUsd: null,
    });
    sendJson(res, 429, {
      error:
        'Too many AI requests in a short time. Please wait about a minute and try again.',
      code: 'RATE',
    });
    return false;
  }

  const daily = assertDailyQuota(clientId, usageDate);
  if (!daily.ok) {
    logLine({
      userId: clientId,
      catId,
      feature,
      ok: false,
      statusCode: 429,
      error: 'QUOTA',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estUsd: null,
    });
    sendJson(res, 429, {
      error: 'Daily AI limit reached for this device. Try again tomorrow or upgrade to Pro.',
      code: 'QUOTA',
      limit: daily.limit,
      used: daily.used,
      remaining: 0,
    });
    return false;
  }

  return true;
}

async function handleCareBundle(lang, recordContext) {
  const { content, usage } = await openAiChatCompletion({
    messages: [
      { role: 'system', content: systemBase(lang) },
      { role: 'user', content: careBundleUserPrompt(lang, recordContext) },
    ],
    temperature: 0.25,
    maxTokens: CARE_MAX_TOKENS,
    jsonMode: true,
  });

  const parsed = tryParseJsonObject(content);
  const keys = ['healthSummary', 'sevenDayAnalysis', 'vetReport'];
  const out = {};
  for (const k of keys) {
    const v = parsed[k];
    if (typeof v !== 'string' || !v.trim()) {
      throw new Error(`Missing or invalid field: ${k}`);
    }
    out[k] = v.trim();
  }
  return { bundle: out, usage };
}

async function handleQa(lang, recordContext, question) {
  const { content, usage } = await openAiChatCompletion({
    messages: [
      { role: 'system', content: systemBase(lang) },
      { role: 'user', content: qaUserPrompt(lang, recordContext, question) },
    ],
    temperature: 0.25,
    maxTokens: QA_MAX_TOKENS,
    jsonMode: false,
  });
  return { answer: content, usage };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/assistant/health') {
      const clientId = (url.searchParams.get('clientId') || '').trim();
      const usageDate = (url.searchParams.get('usageDate') || '').trim();
      const openaiReady = Boolean(process.env.OPENAI_API_KEY?.trim());
      if (!isClientId(clientId) || !isYmd(usageDate)) {
        sendJson(res, 200, {
          ok: true,
          openaiReady,
          dailyLimit: 3,
          dailyUsed: 0,
          dailyRemaining: 3,
          planEffective: 'free',
        });
        return;
      }
      const limit = getDailyLimit(clientId);
      const used = peekDailyUsed(clientId, usageDate);
      const proIds = (process.env.AI_PRO_CLIENT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
      const planEffective = proIds.includes(clientId) ? 'pro' : 'free';
      sendJson(res, 200, {
        ok: true,
        openaiReady,
        dailyLimit: limit,
        dailyUsed: used,
        dailyRemaining: Math.max(0, limit - used),
        planEffective,
      });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    let bodyRaw;
    try {
      bodyRaw = await readBody(req);
    } catch (e) {
      sendJson(res, 413, { error: e instanceof Error ? e.message : 'Body too large' });
      return;
    }

    let body;
    try {
      body = JSON.parse(bodyRaw || '{}');
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    if (url.pathname === '/api/assistant/care-bundle') {
      const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
      const catId = typeof body.catId === 'string' ? body.catId.trim() : '';
      const usageDate = typeof body.usageDate === 'string' ? body.usageDate.trim() : '';

      if (!isClientId(clientId)) {
        sendJson(res, 400, { error: 'Invalid or missing clientId', code: 'BAD_REQUEST' });
        return;
      }
      if (!isCatId(catId)) {
        sendJson(res, 400, { error: 'Invalid or missing catId', code: 'BAD_REQUEST' });
        return;
      }
      if (!isYmd(usageDate)) {
        sendJson(res, 400, { error: 'Invalid or missing usageDate (YYYY-MM-DD)', code: 'BAD_REQUEST' });
        return;
      }

      if (!assistantRateAndQuota(res, clientId, catId, usageDate, 'care-bundle')) return;

      const lang = body.lang;
      const recordContext = body.recordContext;
      if (lang !== 'zh' && lang !== 'en') {
        sendJson(res, 400, { error: 'Invalid lang', code: 'BAD_REQUEST' });
        return;
      }
      if (typeof recordContext !== 'string' || !recordContext.trim()) {
        sendJson(res, 400, { error: 'Missing recordContext', code: 'BAD_REQUEST' });
        return;
      }
      if (recordContext.length > MAX_CONTEXT_CHARS) {
        sendJson(res, 400, { error: 'recordContext too long', code: 'BAD_REQUEST' });
        return;
      }

      if (!process.env.OPENAI_API_KEY?.trim()) {
        sendJson(res, 503, { error: 'Server is not configured with OPENAI_API_KEY', code: 'NO_API_KEY' });
        return;
      }

      try {
        const { bundle, usage } = await handleCareBundle(lang, recordContext);
        incrementDailyUsed(clientId, usageDate);
        const estUsd = estUsdFromUsage(usage);
        logLine({
          userId: clientId,
          catId,
          feature: 'care-bundle',
          ok: true,
          statusCode: 200,
          promptTokens: usage?.prompt_tokens ?? null,
          completionTokens: usage?.completion_tokens ?? null,
          totalTokens: usage?.total_tokens ?? null,
          estUsd,
        });
        sendJson(res, 200, bundle);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logLine({
          userId: clientId,
          catId,
          feature: 'care-bundle',
          ok: false,
          statusCode: 502,
          error: msg.slice(0, 500),
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estUsd: null,
        });
        sendJson(res, 502, {
          error: 'The AI service returned an error. Please try again later.',
          code: 'OPENAI',
          detail: msg.slice(0, 300),
        });
      }
      return;
    }

    if (url.pathname === '/api/assistant/qa') {
      const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
      const catId = typeof body.catId === 'string' ? body.catId.trim() : '';
      const usageDate = typeof body.usageDate === 'string' ? body.usageDate.trim() : '';

      if (!isClientId(clientId)) {
        sendJson(res, 400, { error: 'Invalid or missing clientId', code: 'BAD_REQUEST' });
        return;
      }
      if (!isCatId(catId)) {
        sendJson(res, 400, { error: 'Invalid or missing catId', code: 'BAD_REQUEST' });
        return;
      }
      if (!isYmd(usageDate)) {
        sendJson(res, 400, { error: 'Invalid or missing usageDate (YYYY-MM-DD)', code: 'BAD_REQUEST' });
        return;
      }

      if (!assistantRateAndQuota(res, clientId, catId, usageDate, 'qa')) return;

      const lang = body.lang;
      const recordContext = body.recordContext;
      const question = body.question;
      if (lang !== 'zh' && lang !== 'en') {
        sendJson(res, 400, { error: 'Invalid lang', code: 'BAD_REQUEST' });
        return;
      }
      if (typeof recordContext !== 'string' || !recordContext.trim()) {
        sendJson(res, 400, { error: 'Missing recordContext', code: 'BAD_REQUEST' });
        return;
      }
      if (recordContext.length > MAX_CONTEXT_CHARS) {
        sendJson(res, 400, { error: 'recordContext too long', code: 'BAD_REQUEST' });
        return;
      }
      if (typeof question !== 'string' || !question.trim()) {
        sendJson(res, 400, { error: 'Missing question', code: 'BAD_REQUEST' });
        return;
      }
      if (question.length > MAX_QUESTION_CHARS) {
        sendJson(res, 400, { error: 'question too long', code: 'BAD_REQUEST' });
        return;
      }

      if (!process.env.OPENAI_API_KEY?.trim()) {
        sendJson(res, 503, { error: 'Server is not configured with OPENAI_API_KEY', code: 'NO_API_KEY' });
        return;
      }

      try {
        const { answer, usage } = await handleQa(lang, recordContext, question);
        incrementDailyUsed(clientId, usageDate);
        const estUsd = estUsdFromUsage(usage);
        logLine({
          userId: clientId,
          catId,
          feature: 'qa',
          ok: true,
          statusCode: 200,
          promptTokens: usage?.prompt_tokens ?? null,
          completionTokens: usage?.completion_tokens ?? null,
          totalTokens: usage?.total_tokens ?? null,
          estUsd,
        });
        sendJson(res, 200, { answer });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logLine({
          userId: clientId,
          catId,
          feature: 'qa',
          ok: false,
          statusCode: 502,
          error: msg.slice(0, 500),
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estUsd: null,
        });
        sendJson(res, 502, {
          error: 'The AI service returned an error. Please try again later.',
          code: 'OPENAI',
          detail: msg.slice(0, 300),
        });
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = e?.code === 'NO_API_KEY' ? 503 : 500;
    sendJson(res, status, { error: msg, code: e?.code === 'NO_API_KEY' ? 'NO_API_KEY' : 'SERVER' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[assistant-api] http://127.0.0.1:${PORT}`);
  console.log(`[assistant-api] Project root (where .env should live): ${ROOT_DIR}`);
  console.log(
    `[assistant-api] .env: ${fs.existsSync(ENV_FILE) ? 'file found' : 'file missing'} → ${ENV_FILE}`
  );
  console.log(
    `[assistant-api] .env.local: ${fs.existsSync(ENV_LOCAL_FILE) ? 'file found' : 'not present'} → ${ENV_LOCAL_FILE}`
  );
  console.log(`[assistant-api] OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'set' : 'missing'}`);
  console.log(`[assistant-api] OPENAI_MODEL: ${MODEL}`);
  console.log(`[assistant-api] Usage log: server/logs/usage.jsonl`);
});
