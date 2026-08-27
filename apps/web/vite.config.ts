import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET ?? env.VITE_API_URL ?? 'http://localhost:3000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@safari-shule/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      },
    },
    optimizeDeps: {
      exclude: ['@safari-shule/shared-types'],
    },
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      host: true,
      strictPort: true,
      proxy: {
        '/v1': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-leaflet') || id.includes('/leaflet/') || id.includes('socket.io-client')) {
              return 'maps-realtime';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query';
            }
            if (id.includes('react-router-dom') || id.includes('/react/') || id.includes('/react-dom/')) {
              return 'react-core';
            }
            if (id.includes('@radix-ui')) {
              return 'radix-ui';
            }
            if (id.includes('exceljs') || id.includes('jspdf') || id.includes('jspdf-autotable') || id.includes('html2canvas')) {
              return 'exports';
            }
            return 'vendor';
          },
        },
      },
    },
  };
});
