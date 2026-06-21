# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# gons-health

한국 약사용 건강기능식품 안전 레이어. 약물↔건기식/식품 상호작용 cite-or-abstain 체커.
아키텍처 B 확정(앵커 KB + 약사 검토 게이트). 상세는 `~/.claude/projects/-home-gon-projects-gon-gons-health/memory/` 참조.

## 명령어

```bash
npm run dev          # Vite 개발 서버 (기본 포트 5173, 점유 시 5174로 폴백)
npm run build        # tsup → dist/ (@krdn/gons-health 코어 패키지 빌드, git 커밋 대상)
npm run build:app    # tsc -b 타입체크 후 vite build → dist-app/ (standalone 웹앱)
npm run typecheck    # tsc --noEmit
npm run preview      # 빌드 산출물 로컬 미리보기
npm test             # vitest run (1회 실행)
npm run test:watch   # vitest watch 모드

# 단일 테스트 파일 실행
npx vitest run src/lib/lookup.test.ts

# 이름으로 단일 테스트 실행
npx vitest run -t "verified가 false인 엔트리는 반환하지 않는다"
```

## 아키텍처 (cite-or-abstain 안전 모델)

이 앱의 모든 설계 결정은 **"환각 경고를 약사에게 절대 보여주지 않는다"** 는 단일 목표에서 나온다.
런타임에 LLM·외부 API 호출이 없다. 약물 클래스 × 건기식의 **결정론적 closed-set lookup** 뿐이다.

데이터 흐름: `interactions.json` → `validateKb()` → `lookup()` → `ResultCard`

안전성은 아래 **3중 게이트의 합성**으로만 성립한다. 하나라도 무너지면 미검증/환각 경고가 새어나간다.

1. **verified 게이트** (`src/lib/lookup.ts`) — `lookup()`은 `e.verified === true` 인 엔트리만 반환한다.
   1차문헌과 실제 대조해 약사가 확인한 엔트리만 `verified: true`. 나머지는 lookup 결과에 절대 안 나온다.
   → 약사가 보는 모든 경고는 검증+인용된 것이라는 계약. 이 필터를 약화시키지 말 것.

2. **abstain 상수** (`src/lib/lookup.ts` `ABSTAIN_MESSAGE`) — 미스 시 문구를 **생성하지 않고**
   고정 상수만 반환한다. 이 문구는 절대 "안전함"을 뜻하지 않는다("문서화된 상호작용 없음 — 안전하다는
   의미가 아닙니다"). 미스를 안전으로 오해시키는 표현을 추가하지 말 것.

3. **closed-set 어휘** (`src/data/vocabulary.ts`) — 입력은 드롭다운 고정 목록뿐. 자유 텍스트 NLP
   매칭을 원천 배제한다. `DRUG_CLASSES`/`SUPPLEMENTS` 의 문자열은 `interactions.json` 의 `drug_class`/
   `supplement` 키와 **정확히 일치**해야 한다(lookup이 정확 문자열 비교). 한쪽만 바꾸면 영구 미스가 된다.

### KB 무결성 (`src/lib/validateKb.ts`)

KB는 앱 로드 시 1회 `validateKb()`로 검증되며, 스키마 위반(필드 누락, source 인용 5필드 누락,
evidence_level 부적합, verified 비-boolean)은 **로드 즉시 throw**로 드러난다. fail-loud가 의도다 —
조용한 폴백 금지. 새 엔트리 추가 시 `source`의 5필드(`db`/`id`/`url`/`quote`/`retrieved_date`)와
`evidence_level`(강/중/약)은 전 엔트리 강제 사항이다.

### 듀얼 산출물: standalone 앱 + `@krdn/gons-health` 코어 패키지

이 repo는 **standalone 웹앱**이면서 동시에 다른 프로젝트(gons-dashboard 등)에 임베드되는
**코어 패키지**다. 사내 `@krdn/saju`와 동일하게 **GitHub 태그 의존성**(`github:krdn/gons-health#vX.Y.Z`)으로 소비한다.

- **노출 경계** — `src/index.ts` 배럴이 React 의존 0인 순수 코어(`loadKb`/`lookup`/`validateKb`/
  어휘/타입)만 export. React UI 컴포넌트는 **제외**(소비처 React 버전 충돌 방지). KB는 raw JSON이
  아니라 `loadKb()`(= `validateKb` 통과 결과)로만 노출 → verified 게이트·인용 강제 보존.
- **빌드** — `npm run build`(tsup → `dist/`). `dist/`는 **git에 커밋**한다. GitHub 의존성은
  git-archive 타르볼이라 tracked 파일만 받으므로, `dist/`를 gitignore하면 소비처가 빈 패키지를
  받아 깨진다. 코드 변경 시 `dist/` 재빌드 + `package.json`을 **함께 커밋**. (vite 앱은 `dist-app/`로 분리.)
- 상세: `docs/PACKAGING.md`.

### KB 엔트리 추가 절차

1. 1차문헌(PubMed 등)에서 실제 인용을 대조 확인한다. **시드 PMID를 추측·생성하지 말 것**
   (과거 시드 PMID 환각으로 다수 엔트리가 `PENDING` 처리된 이력 있음).
2. 확인 전에는 `verified: false` + `source.id: "PENDING"` 으로 두면 lookup에서 안 나오므로 안전하다.
3. `vocabulary.ts`에 없는 새 약물군/건기식이면 거기에도 동일 문자열을 추가한다.
4. `src/data/interactions.test.ts` / `validateKb.test.ts` / `lookup.test.ts` 가 통과하는지 확인한다.

### 범위 제약 (제품 의사결정, 코드에 박혀 있지 않음)

- **사주·한의학 임상경로는 완전 배제**한다(임상 신뢰성 차단 요인). 한약은 제한적 안전선에서만 다룬다.
- 이 도구는 정보 제공용이며 진단·처방이 아니다. 환자 프로필 기반 개인화로 가면 SaMD(의료기기) 분류
  위험이 생긴다 — 범위 확장 전 반드시 검토.
- 배경: `docs/superpowers/specs/2026-06-21-gunkisik-safety-layer-design.md` 및 메모리 디렉토리 참조.

## 도구 호출 규칙 (필수)

**tool 입력의 한글은 `\uXXXX` 유니코드 이스케이프가 아니라 리터럴 UTF-8로 출력한다.**

- 이유: 한글을 `\uXXXX`로 직렬화하다 hex 4자리를 못 채우고 원본 글자가 섞이는 토큰 결함이
  확률적으로 발생(예: '뢰' → `\ub뢰`) → JSON 파싱 전체 실패(`InputValidationError`).
  2026-06-21 세션에서 AskUserQuestion 6건 실패, 동일 세션 ScheduleWakeup은 리터럴 출력으로 9/9 성공.
- 특히 **AskUserQuestion**: question/option 텍스트를 짧게 유지해 이스케이프 토큰 수를 줄인다.
- 도구 호출이 `malformed`/`could not be parsed`로 실패하면 같은 클래스 결함이다.
  도구를 바꾸지 말고 **리터럴 한글 + 더 짧은 입력**으로 재시도한다.
- 에러를 특정 도구에 귀속하기 전, transcript의 `is_error` 플래그로 실제 실패 도구를 ID 매칭으로 확인한다
  (텍스트 grep은 자기 디버깅 출력을 잡는 false positive 위험).

전체 진단: `docs/diagnosis-tool-format-error-20260621.md`
