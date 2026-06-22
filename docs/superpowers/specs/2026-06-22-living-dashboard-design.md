# Living Dashboard — 설계 문서

> **상태:** APPROVED (2026-06-22 brainstorming 합의)
> **다음 단계:** writing-plans 스킬로 구현 플랜 작성

## 목표

현재 `dashboard.html`은 KB 수치·다음 행동 등이 HTML에 하드코딩된 **정적 스냅샷**이라, 작업이 진행돼도 갱신되지 않는다. 이를 **결정론적 생성기가 프로젝트의 흩어진 소스를 읽어 재생성하는 살아있는 대시보드**로 전환한다. 프로젝트 시작부터 설계·진행과정·할 일·산출물·계획이 한눈에 보이며, 작업 진행 중 `npm run dashboard`로 갱신된다.

## 핵심 제약 — 브레인스토밍에서 확정한 4가지 결정

| 결정 축 | 선택 | 함의 |
|---------|------|------|
| 갱신 트리거 | **스킬만 (CLAUDE.md 유도)** | settings.json 훅 미사용. CLAUDE.md가 "의미있는 작업 후 갱신"을 best-effort 유도. 자동 보장은 없으나 트리거 문구를 구체화해 신뢰도 최대화 |
| 의도 소스 | **전용 메타 파일 + 파싱 혼합** | `project-state.json`이 의도(다음행동·마일스톤·도움말)를, 스크립트가 코드 파생 사실(KB·git·테스트)을 담당 |
| GitHub 연계 | **선택적 단방향 미러** | 열린 gh issue를 읽어 "할 일"에 표시(읽기 전용). gh 없거나 오프라인이면 조용히 스킵. 코어는 로컬 메타파일 |
| 도움말 | **인라인 `?` 토글 + 동적 해설** | 고정 설명(메타파일) + 동적 진단(계산) 2층. 단일 HTML + vanilla JS |

## 불변식 (코어에서 빌려온 안전 계약)

이 프로젝트의 코어 불변식은 "런타임 LLM/API 0"이다. 대시보드 생성기도 같은 규칙을 따른다.

- **생성기는 LLM 0의 결정론적 스크립트.** Claude 추론 없이 `npm run dashboard`만으로 재생성된다. 그래야 스킬 호출 시 빠르고 환각 없이 동작한다.
- **`scripts/`에만 격리.** `src/` 코어·앱 빌드에 섞지 않는다. 코어 패키지(`@krdn/gons-health`)의 순수성과 런타임 의존성 0을 보존한다(KB 검증 파이프라인과 동일한 격리 규칙).
- **`dashboard.html`은 의존성 0 단일 파일 보존.** 브라우저에서 바로 열리는 성질을 유지한다. React 빌드 스텝으로 바꾸지 않는다.
- **메타=의도 / 스크립트=사실, 겹치지 않음.** 자동 추출 가능한 데이터는 메타파일에 절대 넣지 않는다 → 드리프트 구조적 불가능.

## 아키텍처

```
┌─────────────────── 데이터 소스 (입력) ───────────────────┐
│ 자동 파싱:                          전용 메타:            │
│  • interactions.json (KB 통계)      • project-state.json  │
│  • docs/**/plans/*.md ([ ] 체크박스)   - 마일스톤/단계      │
│  • git log (최근 작업 이력)            - 다음 행동          │
│  • package.json (산출물·명령어)        - 설계 근거/도움말   │
│  • 테스트 결과 (vitest run --reporter=json 인라인 실행) - 범위 제약  │
│  • gh issue list (선택, 단방향)                            │
└────────────────────────┬─────────────────────────────────┘
                         │
          ┌──────────────▼──────────────┐
          │   scripts/dashboard.ts       │  ← 순수 Node, LLM 0
          │   collect → aggregate → render│
          └──────────────┬──────────────┘
                         │  npm run dashboard
          ┌──────────────▼──────────────┐
          │      dashboard.html          │  ← 단일 파일, 의존성 0
          │  (인라인 ? 토글 + vanilla JS) │
          └─────────────────────────────┘

스킬 (gon:dashboard) — 위 스크립트 호출 + 메타파일 편집 가이드
CLAUDE.md — "의미있는 작업 후 npm run dashboard 실행" 유도 문구
```

### 모듈 경계 (각각 독립 테스트 가능)

| 모듈 | 책임 | 정책 |
|------|------|------|
| `scripts/dashboard/collect.ts` | 소스 파일을 읽어 raw 데이터로 | 파일 I/O. 메타파일은 fail-loud, 보조 소스(git/gh/test)는 실패 격리 |
| `scripts/dashboard/aggregate.ts` | raw → 대시보드 모델 (진행률·동적해설) | **순수 함수, 네트워크 0, 결정론적** |
| `scripts/dashboard/render.ts` | 모델 → HTML 문자열 | 기존 디자인 토큰 보존 |
| `scripts/dashboard/types.ts` | 대시보드 모델 타입 | — |
| `scripts/dashboard.ts` | 위를 엮는 오케스트레이터 | `gh` 선택 호출은 여기 한 곳에 격리 |

이 경계의 이득: `aggregate.ts`가 순수 함수라 진행률 계산을 입력→출력으로 못박을 수 있고, `gh` 같은 불안정 의존성은 한 곳에 격리돼 실패해도 나머지가 렌더된다.

## 데이터 모델 — `project-state.json`

사람이 편집하는 **유일한 의도 소스.** 자동 추출 가능한 데이터(KB 통계·테스트·git)는 넣지 않는다.

```jsonc
{
  "project": {
    "name": "gons-health",
    "tagline": "한국 약사용 약물↔건기식/식품 상호작용 cite-or-abstain 체커",
    "phase": "1단계: 앵커 KB 체커",        // 현재 단계 (자유 텍스트)
    "status": "active"                      // active | paused | shipped
  },

  // 마일스톤 — 단계별 큰 그림. 진행률은 plan 체크박스에서 자동 계산되므로 여기엔 안 씀
  "milestones": [
    { "id": "m1", "title": "앵커 KB 체커 MVP", "state": "done" },
    { "id": "m2", "title": "KB 자동 검증 파이프라인", "state": "in_progress",
      "planFile": "docs/superpowers/plans/2026-06-22-kb-auto-verification.md" },
    { "id": "m3", "title": "약사 인터뷰 수요 검증", "state": "todo" }
  ],

  // 다음 행동 — 임팩트 순. 코드에서 못 끌어오는 우선순위 판단
  "nextActions": [
    { "rank": 1, "title": "8개 PENDING 엔트리 1차문헌 검증", "why": "KB 실질 2개라 효용 안 나옴", "priority": "high" }
  ],

  // 범위 제약 — 건드리면 안 되는 제품 결정
  "constraints": [
    { "icon": "🚫", "title": "사주·한의학 배제", "body": "임상 신뢰성 차단 요인" }
  ],

  // 도움말 — 각 대시보드 섹션의 ? 토글에 주입될 고정 설명. 키 = 섹션 ID
  "help": {
    "safetyGates": "3중 게이트는 합성으로만 안전. 하나라도 무너지면 환각 경고가 샌다.",
    "kbStatus": "verified=true 엔트리만 lookup에 노출. PENDING은 의심스러우면 기권 설계가 작동 중."
  }
}
```

**스키마 검증:** `collect.ts`가 `project-state.json`을 읽을 때 필수 필드 누락이면 fail-loud로 throw(코어 `validateKb()` 패턴). 조용한 폴백 금지 — 메타파일이 깨지면 즉시 드러나게.

### 파생 데이터 (스크립트가 자동 계산, 메타파일에 없음)

| 대시보드 표시 | 소스 | 계산 방식 |
|---|---|---|
| KB 진행률 (예: 2/10) | `interactions.json` | `verified===true` 카운트 |
| 마일스톤 진행률 (%) | `planFile`의 `- [ ]`/`- [x]` | 체크박스 비율 |
| 최근 작업 | `git log --oneline -10` | 파싱 |
| 테스트 상태 | `vitest run --reporter=json` 인라인 실행 | pass/fail 카운트 |
| 산출물 | `package.json` scripts/exports + `dist/` 존재 | 정적 추출 |
| GitHub 할 일 | `gh issue list --json`(선택) | 오프라인이면 스킵 |

## 생성기 실행 흐름 (`npm run dashboard`)

```
1. collect.ts — 각 소스를 독립 수집 (실패 격리)
   ├ project-state.json  → 필수, 깨지면 throw (fail-loud)
   ├ interactions.json   → 필수, KB 통계
   ├ plan *.md           → 체크박스 카운트 (파일 없으면 빈 배열)
   ├ git log             → try/catch, 실패 시 { ok:false }
   ├ vitest run --reporter=json 인라인 실행 → 테스트 결과 JSON 수집 (실패 시 { ok:false })
   └ gh issue (선택)     → try/catch, gh 없거나 오프라인이면 { ok:false }

2. aggregate.ts — 순수 함수 (네트워크 0, 결정론적)
   ├ 진행률 계산 (KB %, 마일스톤 %)
   ├ 동적 해설 문장 생성 ("20% — 8개 PENDING 병목")
   └ 대시보드 모델 객체 반환

3. render.ts — 모델 → HTML 문자열
   ├ 기존 dashboard.html 디자인 토큰 보존 (oklch 팔레트, 카드)
   ├ ? 토글 마크업 + vanilla JS (의존성 0)
   └ "생성 시각 · git SHA" 푸터

4. dashboard.ts — 위를 엮고 dashboard.html 파일로 write
```

### 실패 정책 — 부분 렌더

메타파일은 신뢰의 원천이라 깨지면 멈춘다(fail-loud). 보조 소스(git/gh/test)는 없어도 대시보드는 떠야 하므로, 각 collector를 try/catch로 감싸 `{ ok: false, reason }`를 반환하고 렌더러가 "데이터 없음"을 우아하게 표시한다. 코어의 fail-loud와 정반대 정책이며, 이유가 명확하다 — 보조 소스 누락이 대시보드 전체를 막아선 안 된다.

## 도움말 — 2층 구조

```
? 토글 클릭 시:
  [고정] project-state.json의 help[sectionId]   ← 의미·맥락 설명
  [동적] aggregate가 계산한 현재 상태 문장        ← "지금 여기가 병목" 등 살아있는 진단
```

고정 설명은 메타파일에서, 동적 진단은 `aggregate.ts`가 현재 데이터로 계산한다. HTML 하드코딩이 아니므로 메타파일 한 곳을 고치면 도움말이 갱신된다.

## 테스트 전략 (TDD)

| 테스트 | 대상 | 검증 |
|---|---|---|
| `aggregate.test.ts` | 진행률 계산 | 체크박스 3/5 → "60%" / KB 2/10 → "20%" |
| `aggregate.test.ts` | 동적 해설 | PENDING 8개 → "병목" 문구 포함 |
| `collect.test.ts` | fail-loud | `project-state.json` 필드 누락 → throw |
| `collect.test.ts` | 실패 격리 | git/gh 실패 → `{ok:false}` 반환, throw 안 함 |
| `render.test.ts` | HTML 무결성 | 단일 파일, `<script src=` 외부 의존 0, 모든 섹션 존재 |

렌더 결과는 스냅샷이 아니라 "구조 불변식"(외부 의존성 없음, 섹션 존재)만 검증해 brittle하지 않게 한다.

## 스킬 통합 — `gon:dashboard`

`~/.claude/skills/gon:dashboard/SKILL.md`. `context: fork`로 메인 대화 컨텍스트 오염 방지.

```
명령 라우팅:
  /gon:dashboard          → npm run dashboard 실행 + 브라우저 열기 (xdg-open)
  /gon:dashboard update   → 동일 (명시적)
  /gon:dashboard edit     → project-state.json 편집 가이드 (현재 의도 vs 코드 상태 diff 제시)
  /gon:dashboard help     → 대시보드 각 섹션 의미 설명
```

스킬의 진짜 가치는 스크립트 실행이 아니라 **3모드 라우팅**이다. `npm run dashboard`만 하면 사람이 메타파일 편집을 잊어 의도 데이터가 썩는다 — 스킬이 "다음 행동 바뀌었으면 project-state.json도 고치라"고 능동 안내해야 살아있는 대시보드가 된다.

## CLAUDE.md 트리거 문구 (프로젝트 CLAUDE.md에 추가)

```markdown
## 대시보드 자동 갱신 (gon:dashboard)

다음 작업을 한 뒤에는 `npm run dashboard`로 dashboard.html을 갱신한다:
- interactions.json KB 엔트리 추가·verified 승격
- plan 문서의 `- [ ]` 체크박스 완료
- 마일스톤 전환 / 다음 행동 변경 (→ project-state.json도 함께 편집)

의도(다음 행동·마일스톤·범위)가 바뀌면 project-state.json을 먼저 고치고 갱신한다.
대시보드는 코드 파생 데이터(KB·git·테스트)는 자동 집계하고, 의도는 메타파일에서만 읽는다.
```

best-effort의 신뢰도를 최대화하려면 막연한 "갱신하세요"가 아니라 구체적 트리거 조건(KB 엔트리 변경 / 체크박스 완료 / 마일스톤 전환)을 명시해야 Claude가 실제로 호출한다.

## 전체 파일 목록

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `project-state.json` | 의도 데이터 (마일스톤·다음행동·제약·도움말) | 신규 |
| `scripts/dashboard/collect.ts` | 소스 파일 수집 (실패 격리) | 신규 |
| `scripts/dashboard/aggregate.ts` | 순수 집계·진행률·동적해설 | 신규 |
| `scripts/dashboard/render.ts` | 모델 → HTML 렌더 | 신규 |
| `scripts/dashboard/types.ts` | 대시보드 모델 타입 | 신규 |
| `scripts/dashboard.ts` | 오케스트레이터 + gh 선택 호출 | 신규 |
| `scripts/dashboard/aggregate.test.ts` | 집계·해설 단위 테스트 | 신규 |
| `scripts/dashboard/collect.test.ts` | fail-loud·실패격리 테스트 | 신규 |
| `scripts/dashboard/render.test.ts` | HTML 무결성 테스트 | 신규 |
| `dashboard.html` | 생성 산출물 (기존 → 스크립트 생성으로 전환) | 수정 |
| `package.json` | `dashboard` 스크립트 추가 | 수정 |
| `CLAUDE.md` | 자동 갱신 트리거 문구 | 수정 |
| `~/.claude/skills/gon:dashboard/SKILL.md` | 스킬 정의 (3모드 라우팅) | 신규 |
| `docs/DASHBOARD.md` | 사용법 + GitHub 스코프 추가 안내 | 신규 |

## GitHub 제안 (문서에만, 이번 범위 밖)

`gh auth refresh -s read:project,project` 하면 Project 보드 연계도 가능하다. 단 이번 범위는 issue 단방향 미러까지. 현재 이슈 0개·`read:project` 스코프 없음을 확인했으므로, GitHub은 보조 후속으로 다루고 코어 산출물을 여기에 묶지 않는다.

## 범위 밖 (YAGNI)

- settings.json 훅 (사용자가 스킬만 선택)
- 양방향 GitHub 동기화
- GitHub Project 보드 연계 (스코프 추가 후 별도 작업)
- 대시보드 자체의 빌드 스텝/번들러 (단일 HTML 유지)
