// Cloudflare Worker: public front door for Salony.
//
// Egyptian ISPs block Netlify's servers, so customers reach Salony through
// Cloudflare instead. This Worker forwards every request (web app + /api) to
// the Netlify site and streams the response back unchanged.
const ORIGIN = 'https://salony-eg.netlify.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);
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
    return new Response(res.body, res);
  },
};
