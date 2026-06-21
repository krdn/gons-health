# 패키징 — `@krdn/gons-health` 코어 패키지

gons-health 는 두 가지로 동시에 산다:

1. **standalone 웹앱** — `npm run dev` / `npm run build:app` (Vite, React 18)
2. **임베드 가능한 코어 패키지** — `@krdn/gons-health`, 다른 프로젝트가 GitHub 의존성으로 소비

이 문서는 (2)의 구조·배포·소비 방법과, 깨지기 쉬운 지점을 정리한다.

## 왜 이 구조인가 (결정 근거)

사내 다른 프로젝트들(`gons-dashboard` 등)이 이미 `@krdn/saju`, `@krdn/email`,
`@krdn/llm-gateway` 를 **`github:krdn/<repo>#<태그>`** 형태로 소비하고 있다. gons-health 도
새 메커니즘을 발명하지 않고 **동일한 GitHub 태그 의존성 패턴**을 따른다.

- **레지스트리 publish 아님** — 사내에 npm registry/.npmrc 인증 셋업이 없다.
- **로컬 link 아님** — 머신·CI 간 취약. 사내에서 안 쓰는 방식.
- **GitHub 태그 의존성** — 버전 태그로 핀 고정, 레지스트리 불필요. 검증된 사내 표준.

## 무엇을 노출하는가 (코어만, React UI 제외)

소비 프로젝트의 React 버전과 충돌하지 않도록 **React 의존이 0인 순수 코어만** 노출한다
(`gons-dashboard` 는 React 19 / Next 16, gons-health 는 React 18).

| 노출 (`src/index.ts` 배럴) | 제외 (standalone 전용) |
| --- | --- |
| `loadKb()` — 검증된 KB 반환 | `App.tsx`, `main.tsx` |
| `lookup()`, `ABSTAIN_MESSAGE` | `InteractionChecker.tsx` |
| `validateKb()` | `ResultCard.tsx`, `ErrorBoundary.tsx` |
| `DRUG_CLASSES`, `SUPPLEMENTS` | `index.html`, vite 설정 |
| 모든 public 타입 | |

**안전 계약:** raw `interactions.json` 은 노출하지 않는다. `loadKb()` 만 노출해
`validateKb()` 의 fail-loud 검증과 `lookup()` 의 verified 게이트를 소비자가 우회할 수 없게 한다.

## 빌드

```bash
npm run build   # tsup → dist/{index.js, index.d.ts, index.js.map}
```

- 빌드 도구: **tsup** (사내 `@krdn/saju` 와 동일)
- `interactions.json` 은 esbuild 가 번들에 인라인 → 별도 데이터 파일 동봉 불필요
- ESM 단일 포맷 (`"type": "module"`)
- standalone 앱 빌드는 `dist-app/` 으로 분리 (vite) — `dist/` 오염 방지

## ⚠️ 깨지기 쉬운 지점 (반드시 지킬 것)

### 1. `dist/` 는 git 에 커밋한다

GitHub 태그 의존성은 **git-archive 타르볼**로 받아진다 — git 에 **tracked 된 파일만** 들어간다.
`dist/` 를 `.gitignore` 하면 소비 프로젝트는 **빈 패키지**를 받아 import 가 깨진다.

→ `.gitignore` 에는 `dist-app/`(vite 앱)만 넣고, `dist/`(코어 산출물)는 커밋한다.
   `@krdn/saju` 도 동일하게 dist 를 커밋한다.

### 2. `package.json` 변경도 반드시 커밋한다

`main`/`exports` 가 빠진 옛 `package.json` 이 타르볼에 들어가면 npm 이 legacy 경로
(`index.js`)로 fallback 해 `ERR_MODULE_NOT_FOUND` 가 난다. **코드 변경 시 `dist/` 재빌드 +
`package.json` + `dist/` 를 함께 커밋**해야 한다.

### 3. 릴리스 절차

```bash
npm run build              # dist/ 재생성
npm test                   # 21개 테스트 통과 확인
git add dist/ package.json # 둘 다 스테이지
git commit -m "build: dist 산출물 갱신"
git tag v0.1.1 && git push --tags
```

소비 프로젝트는 `pnpm add github:krdn/gons-health#v0.1.1` 로 새 태그를 가져간다.

## 소비 방법 (소비 프로젝트에서)

```bash
pnpm add github:krdn/gons-health#v0.1.0
```

```ts
import { loadKb, lookup } from '@krdn/gons-health'
import type { LookupResult } from '@krdn/gons-health'

const kb = loadKb()
const result: LookupResult = lookup(kb, '항응고제/항혈소판제', '단삼 (Danshen)')
if (result.kind === 'hit') {
  // result.entries — 인용 출처(PMID 등) 포함된 검증 엔트리
} else {
  // result.message === ABSTAIN_MESSAGE — "안전함" 아님, 약사 판단 필요
}
```

UI 는 소비 프로젝트가 자신의 React 버전으로 직접 그린다 (코어는 데이터·로직만 제공).

## 배포 전 골드 스탠더드 검증

로컬 스모크 테스트로는 부족하다. 실제 소비자 경로(타르볼 → 설치 → import)를 타야 한다:

```bash
# 작업 트리를 그대로 임시 소비자에 설치해 검증
TMP=$(mktemp -d)
mkdir -p "$TMP/c/pkg"
rsync -a --exclude node_modules --exclude dist-app --exclude .git ./ "$TMP/c/pkg/"
cd "$TMP/c"
echo '{"name":"c","type":"module","dependencies":{"@krdn/gons-health":"file:./pkg"}}' > package.json
npm install
node --input-type=module -e "import {loadKb} from '@krdn/gons-health'; console.log(loadKb().length)"
```
