# gons-health

한국 약사용 **건강기능식품 안전 레이어**. 처방약 ↔ 건기식/식품의 문서화된 상호작용을
**cite-or-abstain**(인용 또는 기권) 원칙으로 확인하는 체커.

> ⚠️ **상태: 검증 중인 프로토타입입니다.**
>
> - 이 도구는 **약사의 임상 판단을 보조**하기 위한 정보 제공용이며, **진단·처방·임상 판단을 대체하지 않습니다.**
> - 지식베이스(KB)의 모든 엔트리가 1차문헌 검증을 마친 것은 **아닙니다.** 현재 일부 엔트리만
>   PubMed 등 1차문헌과 대조 확인되어(`verified: true`) 노출되며, 미검증 엔트리는 결과에 나오지 않습니다.
> - 현재 검증 완료 엔트리 수는 다음으로 확인할 수 있습니다:
>   ```bash
>   grep -c '"verified": true' src/data/interactions.json
>   ```
> - "상호작용 없음" 결과는 **"안전함"을 뜻하지 않습니다.** 검색한 자료 내에 문서화된 상호작용이
>   없다는 의미일 뿐이며, 최종 판단은 약사가 합니다.

## 왜 만들었나

한국 약국 조제 시스템의 DUR(약물이용평가)은 **처방약 ↔ 처방약** 상호작용은 잡지만,
**처방약 ↔ 건강기능식품/식품** 상호작용은 구조적으로 다루지 못한다. 2025년 3월 맞춤형 건강기능식품
추천이 제도화되면서 이 공백을 메울 안전 레이어가 필요해졌다. 이 도구는 약사가 건기식을 추천하기 전
**1초 안에** 문서화된 상호작용을 확인하도록 돕는다.

## 핵심 설계: cite-or-abstain 안전 모델

모든 설계 결정은 **"환각 경고를 약사에게 절대 보여주지 않는다"** 는 단일 목표에서 나온다.
런타임에 LLM·외부 API 호출이 없다. 약물 클래스 × 건기식의 **결정론적 closed-set lookup** 뿐이다.

안전성은 **3중 게이트의 합성**으로 성립한다:

1. **verified 게이트** — 1차문헌과 대조해 약사가 확인한 엔트리(`verified: true`)만 결과로 반환된다.
2. **abstain 상수** — 미스 시 문구를 생성하지 않고 고정 상수만 반환한다("문서화된 상호작용 없음 —
   안전하다는 의미가 아닙니다").
3. **closed-set 어휘** — 입력은 드롭다운 고정 목록뿐. 자유 텍스트 NLP 매칭을 원천 배제한다.

데이터 흐름: `interactions.json` → `validateKb()` → `lookup()` → `ResultCard`

## 실행 (standalone 앱)

```bash
npm install
npm run dev          # 개발 서버 (기본 http://localhost:5173)
npm run build:app    # standalone 웹앱 빌드 → dist-app/
npm test             # 테스트 1회 실행 (vitest)
```

## 라이브러리로 사용 (다른 프로젝트에 임베드)

이 프로젝트는 **standalone 웹앱**이면서 동시에 **`@krdn/gons-health` 코어 패키지**로 다른
프로젝트(예: gons-dashboard)에 임베드할 수 있다. 노출되는 것은 **React 의존이 0인 순수 코어**
(lookup 엔진·KB·어휘·타입)뿐이며, React UI 컴포넌트는 포함하지 않는다 — 소비 프로젝트의 React
버전과 충돌하지 않게 하기 위함이다.

```bash
# 소비 프로젝트에서 (사내 @krdn/* 패키지와 동일한 GitHub 태그 의존성 방식)
pnpm add github:krdn/gons-health#v0.1.0
```

```ts
import { loadKb, lookup, DRUG_CLASSES, SUPPLEMENTS } from '@krdn/gons-health'
import type { LookupResult } from '@krdn/gons-health'

const kb = loadKb() // validateKb 를 거친 검증된 KB (fail-loud)
const result = lookup(kb, '갑상선약', '칼슘')
// result.kind === 'hit' → 인용된 상호작용 엔트리
// result.kind === 'abstain' → 고정 기권 메시지 (안전 ≠ 무경고)
```

**안전 계약 보존:** 패키지는 raw `interactions.json` 을 노출하지 않고 `loadKb()` 만 노출한다.
`lookup()` 의 verified 게이트·cite-or-abstain 상수·closed-set 어휘가 임베드 환경에서도 그대로
동작한다. 자세한 내용은 [`docs/PACKAGING.md`](docs/PACKAGING.md) 참조.

### 패키지 빌드 (배포자용)

```bash
npm run build        # tsup → dist/ (커밋 대상, GitHub 의존성이 그대로 받음)
```

`dist/` 산출물은 `@krdn/saju` 등 사내 패턴과 동일하게 **git 에 커밋**한다. GitHub 태그 의존성은
git-archive 타르볼로 받아지므로, 빌드 산출물이 커밋되어 있어야 소비 프로젝트에서 동작한다.

## 기술 스택

React 18 · TypeScript · Vite · Vitest · tsup(패키지 빌드). 백엔드·외부 API 없음(정적 KB 기반).

## 기여 / KB 엔트리 추가

새 상호작용 엔트리는 **1차문헌(PubMed 등)에서 실제 인용을 대조 확인**한 뒤에만 `verified: true`로
둔다. 확인 전에는 `verified: false`로 두면 결과에 노출되지 않으므로 안전하다.
상세 절차와 아키텍처 규칙은 [`CLAUDE.md`](./CLAUDE.md)를 참조.

## 라이선스 / 면책

저작권 전적 보유(proprietary, all rights reserved). 사전 서면 허가 없이 복제·수정·배포·재사용을
금지한다. 상세는 [`LICENSE`](./LICENSE) 참조.

이 소프트웨어는 정보 제공 목적으로 현재 상태("as is") 그대로 제공되며, 의료적 조언을 구성하지 않는다.
실제 환자 상담·복약지도에서의 모든 판단과 책임은 자격을 갖춘 약사·의료인에게 있다.
