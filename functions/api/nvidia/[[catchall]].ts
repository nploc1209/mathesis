/**
 * Cloudflare Pages Function Proxy for NVIDIA NIM API.
 * Route: /api/nvidia/*
 * Handles CORS and proxies chat completions to https://integrate.api.nvidia.com
 */

export async function onRequest(context: any): Promise<Response> {
  const url = new URL(context.request.url);
  const targetPath = url.pathname.replace(/^\/api\/nvidia/, '');
  const targetUrl = `https://integrate.api.nvidia.com${targetPath}${url.search}`;

  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
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

  // Forward authorization and content-type headers
  const reqHeaders = new Headers(context.request.headers);
  reqHeaders.set('Host', 'integrate.api.nvidia.com');

  try {
    const nvidiaResponse = await fetch(targetUrl, {
      method: context.request.method,
      headers: reqHeaders,
      body:
        context.request.method !== 'GET' && context.request.method !== 'HEAD'
          ? context.request.body
          : null,
    });

    const responseHeaders = new Headers(nvidiaResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(nvidiaResponse.body, {
      status: nvidiaResponse.status,
      statusText: nvidiaResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Error forwarding to NVIDIA API' }),
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
