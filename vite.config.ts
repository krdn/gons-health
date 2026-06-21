import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // 로컬 정적 파일로 열 때 상대 경로
  // standalone 앱 빌드는 dist-app/ 으로 분리.
  // dist/ 는 패키지 코어 산출물(tsup)이며 git 에 커밋되므로 충돌 방지.
  build: { outDir: 'dist-app' },
})
