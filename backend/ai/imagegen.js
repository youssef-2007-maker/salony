// Salony AI — image generation.
//
// Generates a "preview my new haircut" image given a selfie + style prompt.
// Tries providers in order, returning the first that succeeds:
//
//   1. Replicate (img2img with a Stable Diffusion or ControlNet-style model)
//        REPLICATE_API_TOKEN   — required
//        REPLICATE_MODEL       — optional, defaults to a portrait img2img model
//
//   2. OpenAI Images (gpt-image-1 / dall-e edits)
//        OPENAI_API_KEY        — required
//        OPENAI_IMAGE_MODEL    — optional, defaults to 'gpt-image-1'
//
// Returns { url?: string, b64?: string, provider: string } or null when no
// provider is configured. Throws on provider errors so the route can decide
// whether to fall back to the stub UI.
//
// The selfie is accepted as a base64 string (no data: prefix) or a public URL.

const TIMEOUT_MS = 45000; // image gen is slow — give it room.

function buildPrompt(style) {
  // `style` is one of the HAIRSTYLES entries from social.js.
  const description = style?.title ? `${style.title}: ${style.hint || ''}` : 'modern haircut';
  return [
    `Photorealistic portrait of the same person with a new hairstyle.`,
    `Hairstyle: ${description}.`,
    `Keep the person's face, skin tone, eye colour, and clothing exactly the same.`,
    `Only the hair should change. Studio lighting, sharp focus, natural skin texture.`,
  ].join(' ');
}

async function withTimeout(fn, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fn(controller.signal); }
  finally { clearTimeout(timer); }
}

async function pollReplicate(predictionUrl, key) {
  // Replicate predictions are async; poll until done or 40s elapsed.
  const start = Date.now();
  while (Date.now() - start < 40000) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(predictionUrl, {
      headers: { Authorization: `Token ${key}` },
    });
    if (!res.ok) throw new Error(`Replicate poll ${res.status}`);
    const json = await res.json();
    if (json.status === 'succeeded') return json.output;
    if (json.status === 'failed' || json.status === 'canceled') {
      throw new Error(`Replicate prediction ${json.status}: ${json.error || ''}`);
    }
  }
  throw new Error('Replicate timed out');
}

async function callReplicate({ selfieB64, selfieUrl, style }) {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) return null;
  const model = process.env.REPLICATE_MODEL
    || 'stability-ai/stable-diffusion-img2img'; // user can override.
  const image = selfieUrl || `data:image/jpeg;base64,${selfieB64}`;
  const body = {
    // The `version` field is required by Replicate's deployments API.  When
    // users supply just an owner/name string we let Replicate resolve the
    // latest version — see https://replicate.com/docs/reference/http
    version: process.env.REPLICATE_MODEL_VERSION,
    input: {
      image,
      prompt: buildPrompt(style),
      strength: 0.55,
      num_outputs: 1,
    },
  };

  // If no explicit version, hit the model-by-name endpoint instead.
  const url = body.version
    ? 'https://api.replicate.com/v1/predictions'
    : `https://api.replicate.com/v1/models/${model}/predictions`;
  if (!body.version) delete body.version;

  const res = await withTimeout((signal) =>
    fetch(url, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Token ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }), TIMEOUT_MS);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Replicate create ${res.status}: ${t.slice(0, 200)}`);
  }
  const created = await res.json();
  const pollUrl = created?.urls?.get;
  if (!pollUrl) throw new Error('Replicate: no poll URL');
  const output = await pollReplicate(pollUrl, key);
  // Output is an array of URLs.
  const first = Array.isArray(output) ? output[0] : output;
  return { url: first, provider: 'replicate' };
}

// Build a prompt tuned for image-edit endpoints — more imperative and direct
// than the Replicate img2img prompt.
function buildEditPrompt(style) {
  const description = style?.title
    ? `${style.title}${style.hint ? ' (' + style.hint + ')' : ''}`
    : 'modern haircut';
  return [
    `Edit the photo so that the person's hair becomes a ${description}.`,
    `Keep the person's face, skin tone, eyes, expression, background, and clothing exactly the same.`,
    `Only change the hair. Photorealistic, sharp focus.`,
  ].join(' ');
}

async function callOpenAIImage({ selfieB64, style }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!selfieB64) return null; // OpenAI edits require a file upload, not a URL.
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

  // The Expo client sends JPEG (see expo-image-manipulator config in
  // AIHairstyleScreen.js). Match that — the older dall-e-2 endpoint REQUIRES
  // PNG, but gpt-image-1 accepts PNG/JPEG/WebP.
  const buf = Buffer.from(selfieB64, 'base64');
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', buildEditPrompt(style));
  form.append('size', '1024x1024');
  form.append('image', new Blob([buf], { type: 'image/jpeg' }), 'selfie.jpg');
  // Keep cost predictable. 'low' on gpt-image-1 is roughly $0.01-0.02/render.
  if (model === 'gpt-image-1') {
    form.append('quality', process.env.OPENAI_IMAGE_QUALITY || 'low');
  }
  // dall-e-2 supports response_format; gpt-image-1 always returns b64_json.
  if (model.startsWith('dall-e')) {
    form.append('response_format', 'b64_json');
  }

  const res = await withTimeout((signal) =>
    fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    }), TIMEOUT_MS);

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    // OpenAI returns useful JSON errors — pull out the message if we can.
    let pretty = raw;
    try {
      const parsed = JSON.parse(raw);
      pretty = parsed?.error?.message || raw;
    } catch { /* not JSON — keep raw */ }

    // Common case: gpt-image-1 needs an "organization verified" status that
    // takes a few days. Detect and surface a clearer message so the user
    // knows to either verify or switch to dall-e-2.
    if (res.status === 403 && /verified|organization/i.test(pretty)) {
      throw new Error(
        'OpenAI rejected the request: your organization must be verified to use gpt-image-1. ' +
        'Either complete verification at https://platform.openai.com/settings/organization/general, ' +
        'or set OPENAI_IMAGE_MODEL=dall-e-2 in backend/.env to use the older model (works on any account).'
      );
    }
    throw new Error(`OpenAI image ${res.status}: ${pretty.slice(0, 240)}`);
  }

  const json = await res.json();
  const item = json?.data?.[0];
  if (!item) return null;
  if (item.url) return { url: item.url, provider: 'openai' };
  if (item.b64_json) return { b64: item.b64_json, provider: 'openai' };
  return null;
}

async function generateHairstyle({ selfieB64, selfieUrl, style }) {
  if (process.env.REPLICATE_API_TOKEN) {
    const out = await callReplicate({ selfieB64, selfieUrl, style });
    if (out) return out;
  }
  if (process.env.OPENAI_API_KEY) {
    const out = await callOpenAIImage({ selfieB64, style });
    if (out) return out;
  }
  return null;
}

function imageGenAvailable() {
  return Boolean(process.env.REPLICATE_API_TOKEN || process.env.OPENAI_API_KEY);
}

module.exports = { generateHairstyle, imageGenAvailable, buildPrompt };
