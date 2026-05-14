/**
 * Server-side OpenAI chat.completions call. API key from process.env only.
 * @param {{ messages: { role: string; content: string }[]; temperature: number; maxTokens: number; jsonMode?: boolean }} opts
 * @returns {Promise<{ content: string, usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number } | null }>}
 */
export async function openAiChatCompletion(opts) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY is not set on the server');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const model = (process.env.OPENAI_MODEL || 'gpt-5.4-mini').trim();

  const body = {
    model,
    messages: opts.messages,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };
  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errJson = await res.json();
      if (typeof errJson?.error?.message === 'string') detail = errJson.error.message;
    } catch {
      try {
        detail = await res.text();
      } catch {
        // ignore
      }
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Empty model response');
  const u = data?.usage;
  const usage =
    u && typeof u === 'object'
      ? {
          prompt_tokens: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : undefined,
          completion_tokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : undefined,
          total_tokens: typeof u.total_tokens === 'number' ? u.total_tokens : undefined,
        }
      : null;
  return { content: content.trim(), usage };
}
