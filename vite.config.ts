import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Tauri expects a fixed port, failover if that port is taken
  const host = env.TAURI_DEV_HOST || 'localhost';

  return {
    // Prevent vite from obscuring rust errors
    clearScreen: false,

    // Base path - use relative paths for production builds
    base: mode === 'production' ? './' : '/',

    server: {
      port: 5173, // Alinhado com tauri.conf.json
      host: '0.0.0.0',
      strictPort: true,
    },

    // Env variables starting with VITE_ are exposed to the source code
    envPrefix: ['VITE_', 'TAURI_'],

    build: {
      // Tauri uses Chromium on Windows and WebKit on macOS and Linux
      target: process.env.TAURI_PLATFORM == 'windows'
        ? 'chrome105'
        : 'safari13',
      // Don't minify for debug builds
      minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
      // Produce sourcemaps for debug builds
      sourcemap: !!process.env.TAURI_DEBUG,
    },

    plugins: [
      react(),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
