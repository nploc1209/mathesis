import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function nvidiaProxyPlugin(): Plugin {
  const handler = async (req: any, res: any, next: any) => {
    if (!req.url?.startsWith('/api/nvidia')) {
      return next();
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.statusCode = 204;
      return res.end();
    }

    const targetPath = req.url.replace(/^\/api\/nvidia/, '');
    const targetUrl = `https://integrate.api.nvidia.com${targetPath}`;

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }

      const nvidiaResponse = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
      });

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Content-Type', nvidiaResponse.headers.get('content-type') || 'application/json');
      res.statusCode = nvidiaResponse.status;

      const buffer = await nvidiaResponse.arrayBuffer();
      res.end(Buffer.from(buffer));
    } catch (err: any) {
      console.error('[NVIDIA Middleware Proxy Error]:', err);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 502;
      res.end(JSON.stringify({ error: err.message || 'NVIDIA proxy error' }));
    }
  };

  return {
    name: 'nvidia-proxy-middleware',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), nvidiaProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  preview: {
    port: 3000,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-jsxgraph': ['jsxgraph'],
          'vendor-katex': ['katex'],
          'vendor-jspdf': ['jspdf'],
          'vendor-jszip': ['jszip'],
        },
      },
    },
  },
});
