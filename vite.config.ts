import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        electron([
          {
            entry: 'electron/main.ts',
            onstart({ startup }) {
              startup();
            },
          },
          {
            entry: 'electron/preload.ts',
            onstart({ reload }) {
              reload();
            },
          },
        ]),
        renderer(),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
