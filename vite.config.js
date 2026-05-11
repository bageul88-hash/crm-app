import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Android Capacitor: './' (file://), 웹 배포: '/' (BASE_URL=/ 환경변수로 전환)
  base: process.env.BASE_URL ?? './',
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
  },
})