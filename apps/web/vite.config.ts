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
      },
    },
    optimizeDeps: {
      include: ['@safari-shule/shared-types'],
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
    },
  };
});
