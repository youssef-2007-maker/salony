// Cloudflare Worker: public front door for Salony.
//
// Egyptian ISPs block Netlify's servers, so customers reach Salony through
// Cloudflare instead. This Worker forwards every request (web app + /api) to
// the Netlify site, passes the visitor's real IP, and strips Netlify's
// "Powered by Netlify" badge script so the web app looks like a native app.
//
// Deployed as the "salony" Worker: https://salony.youssefhamad086.workers.dev
const ORIGIN = 'https://salony-eg.netlify.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/.netlify/scripts/')) return new Response('', { status: 204 });

    const target = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete('host');
    const ip = request.headers.get('cf-connecting-ip');
    if (ip) headers.set('x-salony-client-ip', ip);
    headers.set('x-forwarded-host', url.host);

    const hasBody = !['GET', 'HEAD'].includes(request.method);
    const res = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
    });

    const out = new Response(res.body, res);
    if ((res.headers.get('content-type') || '').includes('text/html')) {
      return new HTMLRewriter()
        .on('script[src^="/.netlify/"]', { element(el) { el.remove(); } })
        .transform(out);
    }
    return out;
  },
};
