import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.loca.lt'],
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080',
    },
  },
})
