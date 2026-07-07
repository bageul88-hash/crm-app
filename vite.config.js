import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 빌드 시각 자동 주입 (v YY.MM.DD-HHMM) — 하단 버전 표기용. 빌드할 때마다 갱신됨.
const __now = new Date()
const __p = n => String(n).padStart(2, '0')
const BUILD_TIME = `v${String(__now.getFullYear()).slice(2)}.${__p(__now.getMonth() + 1)}.${__p(__now.getDate())}-${__p(__now.getHours())}${__p(__now.getMinutes())}`

export default defineConfig({
  plugins: [react()],
  // Android Capacitor: './' (file://), 웹 배포: '/' (BASE_URL=/ 환경변수로 전환)
  base: process.env.BASE_URL ?? './',
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
  },
})