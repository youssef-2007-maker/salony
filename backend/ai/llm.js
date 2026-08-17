// Salony AI — LLM client.
//
// Provides a single `generateCopy({ system, user, maxTokens })` function that
// will call Anthropic if ANTHROPIC_API_KEY is set, fall back to OpenAI if
// OPENAI_API_KEY is set, and otherwise return null so callers can drop back to
// their template engine. No keys = no crash; just a stub.
//
// Uses global fetch (Node 18+). Times out after 15 seconds so a stalled API
// can't lock up the request loop.

const TIMEOUT_MS = 15000;

async function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic({ system, user, maxTokens = 400, model }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const body = {
    model: model || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  };
  const res = await withTimeout((signal) =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    }), TIMEOUT_MS);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const block = (json.content || []).find((c) => c.type === 'text');
  return (block && block.text) ? block.text.trim() : null;
}

async function callOpenAI({ system, user, maxTokens = 400, model }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const body = {
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  const res = await withTimeout((signal) =>
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    }), TIMEOUT_MS);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim() || null;
}

/**
 * Generate copy. Returns { text, provider } on success, null when no provider
 * is configured. Throws on provider errors (caller decides whether to swallow
 * and fall back to a local template).
 */
async function generateCopy({ system, user, maxTokens }) {
  if (process.env.ANTHROPIC_API_KEY) {
    const text = await callAnthropic({ system, user, maxTokens });
    if (text) return { text, provider: 'anthropic' };
  }
  if (process.env.OPENAI_API_KEY) {
    const text = await callOpenAI({ system, user, maxTokens });
    if (text) return { text, provider: 'openai' };
  }
  return null;
}

function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

module.exports = { generateCopy, aiAvailable };
