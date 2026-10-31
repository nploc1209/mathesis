/**
 * Cloudflare Worker for Mathesis.
 * - Proxies /api/nvidia/* to https://integrate.api.nvidia.com with CORS headers
 * - Serves static frontend assets from dist via env.ASSETS
 */

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Proxy /api/nvidia requests
    if (url.pathname.startsWith('/api/nvidia/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      const targetPath = url.pathname.replace(/^\/api\/nvidia/, '');
      const targetUrl = `https://integrate.api.nvidia.com${targetPath}${url.search}`;

      const reqHeaders = new Headers(request.headers);
      reqHeaders.set('Host', 'integrate.api.nvidia.com');

      try {
        const nvidiaResponse = await fetch(targetUrl, {
          method: request.method,
          headers: reqHeaders,
          body:
            request.method !== 'GET' && request.method !== 'HEAD'
              ? request.body
              : null,
        });

        const resHeaders = new Headers(nvidiaResponse.headers);
        resHeaders.set('Access-Control-Allow-Origin', '*');
        resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        resHeaders.set('Access-Control-Allow-Headers', '*');

        return new Response(nvidiaResponse.body, {
          status: nvidiaResponse.status,
          statusText: nvidiaResponse.statusText,
          headers: resHeaders,
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: err.message || 'Error proxying to NVIDIA API' }),
          {
            status: 502,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // Serve static assets from dist
    return env.ASSETS.fetch(request);
  },
};
