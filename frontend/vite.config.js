import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/punkrecord/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    proxy: {
      '/punkrecord/api': {
        target: 'http://localhost:8086',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/punkrecord/, ''),
      },
    },
  },
})
