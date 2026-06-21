import { defineConfig } from 'tsup'

// 코어 패키지 빌드 — 소비자(gons-dashboard 등)가 github 의존성으로 가져갈 산출물.
// interactions.json 은 esbuild 가 번들에 인라인하므로 별도 데이터 파일 동봉 불필요.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'], // 사내 패키지 전부 "type": "module" — ESM 단일
  dts: true, // .d.ts 생성 (소비자 타입 안전)
  sourcemap: true,
  clean: true,
  treeshake: true,
})
