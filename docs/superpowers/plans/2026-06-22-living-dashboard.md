# Living Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정적 `dashboard.html`을, 프로젝트의 흩어진 소스(KB·plan·git·테스트·메타파일)를 읽어 재생성하는 결정론적 생성기 기반 살아있는 대시보드로 전환한다.

**Architecture:** `scripts/dashboard/`에 격리된 순수 Node 생성기. collect(수집·실패격리) → aggregate(순수 집계·진행률·동적해설) → render(HTML). 의도 데이터는 `project-state.json`에서만 읽고, 코드 파생 데이터(KB 통계·git·테스트)는 파일에서 자동 추출. 산출물 `dashboard.html`은 의존성 0 단일 파일 유지.

**Tech Stack:** TypeScript, Node 20+ (내장 `fetch`/`child_process`), tsx(스크립트 실행기, 신규 devDep), Vitest. 외부 런타임 의존성 추가 없음. `gh`는 선택적 호출(없으면 스킵).

## Global Constraints

- **런타임 순수성:** `src/lib/`, `src/index.ts`(코어 배럴)에 어떤 변경도 가하지 않는다. 대시보드 코드는 `scripts/dashboard/`에만 둔다.
- **생성기 LLM/네트워크 0 (aggregate·render):** `aggregate.ts`/`render.ts`는 순수 함수다. 네트워크·LLM·파일 I/O 없음. 부수효과는 `collect.ts`(읽기)와 `dashboard.ts`(쓰기)에만.
- **KB 통계는 raw 카운트:** `interactions.json`을 직접 읽어 카운트한다. `loadKb()`/`lookup()`을 절대 경유하지 않는다 — 그건 `verified===true`만 통과시켜 8개 PENDING이 사라진다. 대시보드는 의도적으로 2/10 비여과 뷰가 필요.
- **단일 HTML 보존:** `dashboard.html`은 외부 `<script src=`/`<link href=` 0개. 모든 CSS·JS 인라인. 브라우저에서 바로 열린다.
- **디자인 충실 재현:** 현재 `dashboard.html`이 골든 레퍼런스(사용자가 "매우 훌륭해"). render.ts는 기존 oklch 팔레트·stat strip·gates·chip CSS를 그대로 포팅하고 데이터 구멍만 뚫는다. 재발명 금지.
- **fail-loud는 메타파일만:** `project-state.json` 누락·필드 결손은 throw. 보조 소스(git/gh/test)는 try/catch로 `{ ok:false }` 반환, throw 안 함(부분 렌더).
- **한국어 응답·주석:** 코드 주석은 한국어, 식별자는 영어. 커밋 메시지 한국어.
- **현재 KB 사실 (테스트 픽스처 기준):** total 10, verified 2 (단삼 PMID:11302416 / 갑상선약×칼슘 PMID:10838651), PENDING 8 (`source.id === 'PENDING'`). drug_class 3종: 항응고제/항혈소판제, 갑상선약, 퀴놀론·테트라사이클린 항생제.

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|------|------|----------|
| `package.json` | `dashboard` 스크립트 + `tsx` devDep 추가 | 수정 |
| `project-state.json` | 의도 데이터 (project·milestones·nextActions·constraints·help) | 신규 |
| `scripts/dashboard/types.ts` | 메타파일 타입 + 대시보드 모델 타입 | 신규 |
| `scripts/dashboard/collect.ts` | 소스 수집. 메타 fail-loud, 보조 실패격리 | 신규 |
| `scripts/dashboard/collect.test.ts` | fail-loud·실패격리·KB raw 카운트 테스트 | 신규 |
| `scripts/dashboard/aggregate.ts` | raw → 모델. 진행률·동적해설. 순수함수 | 신규 |
| `scripts/dashboard/aggregate.test.ts` | 진행률·해설 단위 테스트 | 신규 |
| `scripts/dashboard/render.ts` | 모델 → HTML. 기존 디자인 포팅 + ? 토글 | 신규 |
| `scripts/dashboard/render.test.ts` | HTML 무결성(외부의존0·섹션존재) 테스트 | 신규 |
| `scripts/dashboard.ts` | 오케스트레이터: collect→aggregate→render→write | 신규 |
| `dashboard.html` | 생성 산출물 (수동 → 생성기 출력으로 전환) | 수정 |
| `CLAUDE.md` | 자동 갱신 트리거 문구 추가 | 수정 |
| `docs/DASHBOARD.md` | 사용법 + GitHub 스코프 안내 | 신규 |
| `~/.claude/skills/gon:dashboard/SKILL.md` | 얇은 범용 런처 스킬 (3모드) | 신규 |

**진행률 소스 정책 (체크박스 함정 회피):** plan 문서의 체크박스는 실행 후 갱신 안 될 수 있다(anchor-kb-checker.md는 구현 완료지만 0/30 표시). 따라서 마일스톤 진행률의 **1차 소스는 `milestone.state`(done/in_progress/todo)**. 체크박스 카운트는 `in_progress` 마일스톤의 `planFile`에 한해 "세부 진행" 보조 표시로만 쓰고, done/todo 마일스톤은 state로 100%/0% 처리한다.

---

## Task 0: 프로젝트 셋업

**Files:**
- Modify: `package.json` (scripts, devDependencies)
- Create: `scripts/dashboard/` (디렉토리)

- [ ] **Step 1: tsx 설치**

Run:
```bash
npm install -D tsx
```
Expected: `tsx` 가 devDependencies에 추가됨 (설치 성공).

- [ ] **Step 2: package.json scripts에 dashboard 추가**

`package.json` 의 `scripts` 블록에 한 줄 추가 (기존 줄 보존):
```json
    "dashboard": "tsx scripts/dashboard.ts",
```
`scripts` 블록 최종 형태:
```json
  "scripts": {
    "dev": "vite",
    "build": "tsup",
    "build:app": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "dashboard": "tsx scripts/dashboard.ts",
    "prepack": "pnpm build"
  },
```

- [ ] **Step 3: 디렉토리 생성**

Run:
```bash
mkdir -p scripts/dashboard
```
Expected: `scripts/dashboard/` 존재.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 대시보드 생성기용 tsx 추가 및 dashboard 스크립트 등록"
```

---

## Task 1: 타입 정의

**Files:**
- Create: `scripts/dashboard/types.ts`

**Interfaces:**
- Produces:
  - `ProjectState` (메타파일 전체 형태)
  - `Milestone`, `NextAction`, `Constraint`
  - `RawData` (collect 출력)
  - `SourceResult<T>` (보조 소스 실패격리 래퍼)
  - `DashboardModel` (aggregate 출력 = render 입력)
  - `SectionHelp`, `Stat`, `MilestoneView`, `ChipView`

- [ ] **Step 1: 타입 파일 작성**

`scripts/dashboard/types.ts`:
```typescript
// 대시보드 생성기 타입. 메타파일 형태 → 수집 raw → 집계 모델 → 렌더 입력.

// ---- 메타파일 (project-state.json) ----
export interface ProjectMeta {
  name: string
  tagline: string
  phase: string
  status: 'active' | 'paused' | 'shipped'
}

export interface Milestone {
  id: string
  title: string
  state: 'done' | 'in_progress' | 'todo'
  planFile?: string // in_progress일 때 세부 진행률 계산용
}

export interface NextAction {
  rank: number
  title: string
  why: string
  priority: 'high' | 'medium' | 'low'
}

export interface Constraint {
  icon: string
  title: string
  body: string
}

// 3중 안전 게이트 — 런마다 안 변하는 설계 사실(의도). 원본 dashboard.html 핵심 섹션.
export interface Gate {
  num: string // "1" "2" "3"
  name: string // "verified 게이트"
  file: string // "src/lib/lookup.ts"
  body: string // 설명
}

// 데이터 흐름 노드 — interactions.json → validateKb → lookup → ResultCard
export interface FlowNode {
  label: string
  gate: boolean // 게이트 마크(초록 강조) 여부
}

// 듀얼 산출물 카드 — @krdn/gons-health 코어 + standalone 앱
export interface Artifact {
  name: string // "@krdn/gons-health"
  cmd: string // "npm run build → dist/"
  out: string // "tsup · React 의존 0인 순수 코어"
  use: string // 용도 설명
}

export interface ProjectState {
  project: ProjectMeta
  milestones: Milestone[]
  nextActions: NextAction[]
  constraints: Constraint[]
  gates: Gate[]
  flow: FlowNode[]
  artifacts: Artifact[]
  help: Record<string, string> // 섹션ID → 고정 설명
}

// ---- 수집 raw ----
// 보조 소스(git/gh/test)는 실패해도 throw 안 함 → 성공/실패 래퍼
export type SourceResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string }

export interface KbEntryRaw {
  id: string
  drug_class: string
  supplement: string
  evidence_level: string
  action_type: string
  verified: boolean
  sourceId: string // source.id ('PENDING' 또는 'PMID:...')
}

export interface KbRaw {
  total: number
  verified: number
  pending: number
  entries: KbEntryRaw[]
}

export interface GitCommit {
  sha: string
  subject: string
}

export interface TestResult {
  passed: number
  failed: number
  total: number
}

export interface GhIssue {
  number: number
  title: string
  url: string
}

// planFile별 체크박스 카운트
export interface CheckboxCount {
  done: number
  total: number
}

export interface RawData {
  state: ProjectState // 필수 — 없으면 collect가 throw
  kb: KbRaw // 필수
  git: SourceResult<GitCommit[]>
  test: SourceResult<TestResult>
  gh: SourceResult<GhIssue[]>
  checkboxes: Record<string, CheckboxCount> // planFile 경로 → 카운트
  gitSha: string // 푸터용 (실패 시 'unknown')
  generatedAt: string // ISO 문자열
}

// ---- 집계 모델 (render 입력) ----
export interface Stat {
  num: string
  label: string
  tone: 'good' | 'warn' | 'neutral'
  spark: string
}

export interface MilestoneView {
  title: string
  state: 'done' | 'in_progress' | 'todo'
  pct: number // 0~100
  detail: string // "3/5 태스크" 또는 "" 
}

export interface ChipView {
  label: string
  evidence: string // "중·avoid"
  verified: boolean
  src: string // "PMID:11302416" 또는 ""
}

export interface SectionHelp {
  fixed: string // 메타파일 help[sectionId]
  dynamic: string // aggregate가 계산한 현재 상태 문장
}

export interface DashboardModel {
  project: ProjectMeta
  stats: Stat[] // 상단 strip 4개
  milestones: MilestoneView[]
  nextActions: NextAction[]
  constraints: Constraint[]
  gates: Gate[] // 메타에서 그대로 통과
  flow: FlowNode[] // 메타에서 그대로 통과
  artifacts: Artifact[] // 메타에서 그대로 통과
  kb: {
    total: number
    verified: number
    pct: number
    chips: ChipView[]
  }
  recentCommits: GitCommit[] // 빈 배열이면 "데이터 없음"
  ghIssues: SourceResult<GhIssue[]>
  help: Record<string, SectionHelp> // 섹션ID → 2층 도움말
  gitSha: string
  generatedAt: string
}
```

- [ ] **Step 2: 타입 컴파일 확인**

Run:
```bash
npx tsc --noEmit scripts/dashboard/types.ts
```
Expected: 에러 없음 (출력 없음).

- [ ] **Step 3: Commit**

```bash
git add scripts/dashboard/types.ts
git commit -m "feat: 대시보드 생성기 타입 정의"
```

---

## Task 2: project-state.json 부트스트랩

**Files:**
- Create: `project-state.json`

**목적:** 현재 `dashboard.html`에 손으로 큐레이션된 의도 콘텐츠(마일스톤·다음행동·제약·도움말)를 메타파일로 이관한다. 이 태스크 없이는 collect가 fail-loud로 죽어 대시보드가 빈 채로 출범한다.

- [ ] **Step 1: 메타파일 작성**

`project-state.json` (프로젝트 루트):
```json
{
  "project": {
    "name": "gons-health",
    "tagline": "한국 약사용 약물↔건기식/식품 상호작용 cite-or-abstain 체커 — 환각 경고를 약사에게 절대 보여주지 않는다는 단일 목표 위의 결정론적 closed-set 조회 도구.",
    "phase": "1단계: 앵커 KB 체커",
    "status": "active"
  },
  "milestones": [
    {
      "id": "m1",
      "title": "앵커 KB 체커 MVP",
      "state": "done"
    },
    {
      "id": "m2",
      "title": "KB 자동 검증 파이프라인",
      "state": "in_progress",
      "planFile": "docs/superpowers/plans/2026-06-22-kb-auto-verification.md"
    },
    {
      "id": "m3",
      "title": "살아있는 대시보드",
      "state": "in_progress",
      "planFile": "docs/superpowers/plans/2026-06-22-living-dashboard.md"
    },
    {
      "id": "m4",
      "title": "약사 인터뷰 5~10명 수요 검증",
      "state": "todo"
    }
  ],
  "nextActions": [
    {
      "rank": 1,
      "title": "8개 PENDING 엔트리 1차문헌 검증 → verified 승격",
      "why": "KB가 실질 2개라 도구 효용이 거의 안 나옴. evidence_level 강인 철분·퀴놀론칼슘·비타민K가 검증 쉬우면서 임팩트 큼.",
      "priority": "high"
    },
    {
      "rank": 2,
      "title": "약사 인터뷰 5~10명 — 수요 검증",
      "why": "B 아키텍처를 '수요는 내가 안다'로 확정했으나 외부 검증 미완.",
      "priority": "medium"
    },
    {
      "rank": 3,
      "title": "harness 입력 강화 스펙 구현",
      "why": "docs/harness-tool-input-hardening-spec-20260621.md 에 설계안 존재.",
      "priority": "medium"
    }
  ],
  "constraints": [
    {
      "icon": "🚫",
      "title": "사주·한의학 임상경로 배제",
      "body": "임상 신뢰성 차단 요인. 한약은 제한적 안전선에서만."
    },
    {
      "icon": "⚖️",
      "title": "개인화 = SaMD 위험",
      "body": "환자 프로필 기반 개인화 → 의료기기 분류 위험. 확장 전 반드시 검토."
    },
    {
      "icon": "ℹ️",
      "title": "정보 제공용",
      "body": "진단·처방 아님. 약사 검토 게이트가 전제."
    }
  ],
  "gates": [
    {
      "num": "1",
      "name": "verified 게이트",
      "file": "src/lib/lookup.ts",
      "body": "verified === true 인 엔트리만 반환. 약사가 1차문헌과 대조한 것만 노출. 나머지는 결과에 절대 안 나옴."
    },
    {
      "num": "2",
      "name": "abstain 상수",
      "file": "ABSTAIN_MESSAGE",
      "body": "미스 시 문구를 생성하지 않고 고정 상수만 반환. '안전함'을 절대 뜻하지 않음."
    },
    {
      "num": "3",
      "name": "closed-set 어휘",
      "file": "src/data/vocabulary.ts",
      "body": "입력은 드롭다운 고정 목록뿐. 자유 텍스트 NLP 매칭 원천 배제. KB 키와 정확 일치 필수."
    }
  ],
  "flow": [
    { "label": "interactions.json", "gate": false },
    { "label": "validateKb()", "gate": true },
    { "label": "lookup()", "gate": true },
    { "label": "ResultCard", "gate": false }
  ],
  "artifacts": [
    {
      "name": "@krdn/gons-health",
      "cmd": "npm run build → dist/",
      "out": "tsup · React 의존 0인 순수 코어",
      "use": "loadKb / lookup / validateKb / 어휘 / 타입만 export. 다른 프로젝트에 GitHub 태그 의존성으로 임베드."
    },
    {
      "name": "standalone 웹앱",
      "cmd": "npm run build:app → dist-app/",
      "out": "tsc + vite · React UI 포함",
      "use": "단독 실행 웹앱. ResultCard 등 UI 컴포넌트는 코어 패키지에서 제외(소비처 React 충돌 방지)."
    }
  ],
  "help": {
    "stats": "상단 지표는 코드에서 자동 집계된 사실이다. 테스트·KB·산출물 수치는 매 생성 시 파일에서 다시 읽는다.",
    "safetyGates": "3중 게이트는 합성으로만 안전하다. verified 필터·ABSTAIN 상수·closed-set 어휘 중 하나라도 무너지면 미검증/환각 경고가 약사에게 샌다.",
    "kbStatus": "lookup은 verified=true 엔트리만 반환한다. PENDING은 '의심스러우면 기권' 설계가 작동 중인 것이지 버그가 아니다. 다만 도구 효용은 verified 개수에 비례한다.",
    "milestones": "마일스톤 완료 여부는 사람이 state로 판단한다(plan 체크박스는 실행 후 갱신 안 될 수 있어 1차 소스로 쓰지 않음). 진행 중 마일스톤만 plan 체크박스로 세부 진행을 보조 표시한다.",
    "nextActions": "코드에서 끌어올 수 없는 우선순위 판단. 임팩트 순으로 사람이 project-state.json에서 관리한다.",
    "dualArtifact": "이 repo는 standalone 웹앱이면서 @krdn/gons-health 코어 패키지다. dist/는 git에 커밋해야 GitHub 의존성 소비처가 깨지지 않는다.",
    "constraints": "건드리면 안 되는 제품 결정. 범위 확장 전 반드시 재검토."
  }
}
```

- [ ] **Step 2: JSON 유효성 확인**

Run:
```bash
node -e "console.log('ok:', !!require('./project-state.json').project.name)"
```
Expected: `ok: true`

- [ ] **Step 3: Commit**

```bash
git add project-state.json
git commit -m "feat: 대시보드 의도 메타파일 부트스트랩 (현재 dashboard.html 콘텐츠 이관)"
```

---

## Task 3: collect.ts — 소스 수집

**Files:**
- Create: `scripts/dashboard/collect.ts`
- Test: `scripts/dashboard/collect.test.ts`

**Interfaces:**
- Consumes: `ProjectState`, `RawData`, `SourceResult`, `KbRaw`, `KbEntryRaw`, `CheckboxCount` (Task 1)
- Produces:
  - `loadState(stateJson: unknown): ProjectState` — fail-loud 검증
  - `countKb(kbJson: unknown[]): KbRaw` — raw 카운트
  - `countCheckboxes(markdown: string): CheckboxCount` — 체크박스 파싱
  - `collect(opts?: { root?: string }): RawData` — 전체 오케스트레이션 (실제 파일 I/O)

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/dashboard/collect.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { loadState, countKb, countCheckboxes } from './collect'

describe('loadState — 메타파일 fail-loud', () => {
  it('project.name 누락 시 throw', () => {
    expect(() => loadState({ milestones: [], nextActions: [], constraints: [], help: {} })).toThrow()
  })

  it('milestones 배열 아니면 throw', () => {
    expect(() =>
      loadState({ project: { name: 'x', tagline: 't', phase: 'p', status: 'active' }, milestones: 'no', nextActions: [], constraints: [], help: {} }),
    ).toThrow()
  })

  it('유효한 메타는 그대로 반환', () => {
    const valid = {
      project: { name: 'gons-health', tagline: 't', phase: 'p', status: 'active' },
      milestones: [{ id: 'm1', title: 'A', state: 'done' }],
      nextActions: [],
      constraints: [],
      gates: [],
      flow: [],
      artifacts: [],
      help: { kbStatus: 'x' },
    }
    const result = loadState(valid)
    expect(result.project.name).toBe('gons-health')
    expect(result.milestones).toHaveLength(1)
  })

  it('gates 배열 아니면 throw', () => {
    expect(() =>
      loadState({ project: { name: 'x', tagline: 't', phase: 'p', status: 'active' }, milestones: [], nextActions: [], constraints: [], gates: 'no', flow: [], artifacts: [], help: {} }),
    ).toThrow()
  })
})

describe('countKb — raw 비여과 카운트', () => {
  it('verified와 PENDING을 둘 다 센다 (verified만 거르지 않음)', () => {
    const kb = [
      { id: 'a', drug_class: 'D1', supplement: 'S1', evidence_level: '중', action_type: 'avoid', verified: true, source: { id: 'PMID:111' } },
      { id: 'b', drug_class: 'D1', supplement: 'S2', evidence_level: '약', action_type: 'avoid', verified: false, source: { id: 'PENDING' } },
      { id: 'c', drug_class: 'D2', supplement: 'S3', evidence_level: '강', action_type: 'spacing', verified: false, source: { id: 'PENDING' } },
    ]
    const result = countKb(kb)
    expect(result.total).toBe(3)
    expect(result.verified).toBe(1)
    expect(result.pending).toBe(2)
    expect(result.entries[0].sourceId).toBe('PMID:111')
  })
})

describe('countCheckboxes — 체크박스 파싱', () => {
  it('완료/전체를 센다', () => {
    const md = `
# Plan
- [ ] 미완료 1
- [x] 완료 1
- [ ] 미완료 2
일반 텍스트
- [x] 완료 2
`
    const result = countCheckboxes(md)
    expect(result.done).toBe(2)
    expect(result.total).toBe(4)
  })

  it('체크박스 없으면 0/0', () => {
    const result = countCheckboxes('# 제목\n본문만')
    expect(result.done).toBe(0)
    expect(result.total).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
npx vitest run scripts/dashboard/collect.test.ts
```
Expected: FAIL — "Cannot find module './collect'" 또는 함수 미정의.

- [ ] **Step 3: collect.ts 구현**

`scripts/dashboard/collect.ts`:
```typescript
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import type {
  ProjectState,
  RawData,
  SourceResult,
  KbRaw,
  KbEntryRaw,
  CheckboxCount,
  GitCommit,
  TestResult,
  GhIssue,
} from './types'

// ---- 메타파일: fail-loud ----
// 필수 필드 누락이면 즉시 throw. 조용한 폴백 금지(코어 validateKb 패턴).
export function loadState(json: unknown): ProjectState {
  if (typeof json !== 'object' || json === null) {
    throw new Error('project-state.json: 객체가 아님')
  }
  const o = json as Record<string, unknown>
  const p = o.project as Record<string, unknown> | undefined
  if (!p || typeof p.name !== 'string') {
    throw new Error('project-state.json: project.name 누락')
  }
  if (!Array.isArray(o.milestones)) {
    throw new Error('project-state.json: milestones 배열 아님')
  }
  if (!Array.isArray(o.nextActions)) {
    throw new Error('project-state.json: nextActions 배열 아님')
  }
  if (!Array.isArray(o.constraints)) {
    throw new Error('project-state.json: constraints 배열 아님')
  }
  if (!Array.isArray(o.gates)) {
    throw new Error('project-state.json: gates 배열 아님')
  }
  if (!Array.isArray(o.flow)) {
    throw new Error('project-state.json: flow 배열 아님')
  }
  if (!Array.isArray(o.artifacts)) {
    throw new Error('project-state.json: artifacts 배열 아님')
  }
  if (typeof o.help !== 'object' || o.help === null) {
    throw new Error('project-state.json: help 객체 아님')
  }
  return json as ProjectState
}

// ---- KB: raw 비여과 카운트 ----
// loadKb()/lookup() 경유 금지 — verified만 통과시켜 PENDING이 사라진다.
export function countKb(kbJson: unknown[]): KbRaw {
  const entries: KbEntryRaw[] = kbJson.map((raw) => {
    const e = raw as Record<string, unknown>
    const source = (e.source ?? {}) as Record<string, unknown>
    return {
      id: String(e.id ?? ''),
      drug_class: String(e.drug_class ?? ''),
      supplement: String(e.supplement ?? ''),
      evidence_level: String(e.evidence_level ?? ''),
      action_type: String(e.action_type ?? ''),
      verified: e.verified === true,
      sourceId: String(source.id ?? ''),
    }
  })
  return {
    total: entries.length,
    verified: entries.filter((e) => e.verified).length,
    pending: entries.filter((e) => e.sourceId === 'PENDING').length,
    entries,
  }
}

// ---- 체크박스 파싱 ----
const CHECKBOX_RE = /^\s*-\s\[([ xX])\]/

export function countCheckboxes(markdown: string): CheckboxCount {
  let done = 0
  let total = 0
  for (const line of markdown.split('\n')) {
    const m = CHECKBOX_RE.exec(line)
    if (!m) continue
    total++
    if (m[1].toLowerCase() === 'x') done++
  }
  return { done, total }
}

// ---- 보조 소스 (실패 격리) ----
function tryGitLog(root: string): SourceResult<GitCommit[]> {
  try {
    const out = execSync('git log --oneline -10', {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
    })
    const commits = out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const sp = line.indexOf(' ')
        return { sha: line.slice(0, sp), subject: line.slice(sp + 1) }
      })
    return { ok: true, value: commits }
  } catch (err) {
    return { ok: false, reason: gitReason(err) }
  }
}

function tryGitSha(root: string): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
    }).trim()
  } catch {
    return 'unknown'
  }
}

function tryTest(root: string): SourceResult<TestResult> {
  // vitest를 JSON 리포터로 인라인 실행. 실패해도 throw 안 함.
  try {
    const reportPath = join(root, '.dashboard-test-report.json')
    execSync(`npx vitest run --reporter=json --outputFile=${reportPath}`, {
      cwd: root,
      encoding: 'utf8',
      timeout: 120000,
      stdio: 'pipe',
    })
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      numPassedTests?: number
      numFailedTests?: number
      numTotalTests?: number
    }
    return {
      ok: true,
      value: {
        passed: report.numPassedTests ?? 0,
        failed: report.numFailedTests ?? 0,
        total: report.numTotalTests ?? 0,
      },
    }
  } catch (err) {
    // vitest는 테스트 실패 시 비-0 종료코드를 내지만 리포트는 쓴다.
    // 리포트가 있으면 그걸 읽어 실패 카운트를 보존.
    try {
      const reportPath = join(root, '.dashboard-test-report.json')
      if (existsSync(reportPath)) {
        const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
          numPassedTests?: number
          numFailedTests?: number
          numTotalTests?: number
        }
        return {
          ok: true,
          value: {
            passed: report.numPassedTests ?? 0,
            failed: report.numFailedTests ?? 0,
            total: report.numTotalTests ?? 0,
          },
        }
      }
    } catch {
      // 리포트도 못 읽으면 아래로 떨어짐
    }
    return { ok: false, reason: '테스트 실행 실패' }
  }
}

function tryGhIssues(root: string): SourceResult<GhIssue[]> {
  try {
    const out = execSync(
      'gh issue list --state open --limit 20 --json number,title,url',
      { cwd: root, encoding: 'utf8', timeout: 5000, stdio: 'pipe' },
    )
    const issues = JSON.parse(out) as GhIssue[]
    return { ok: true, value: issues }
  } catch (err) {
    return { ok: false, reason: 'gh 미설치/오프라인/미인증' }
  }
}

function gitReason(err: unknown): string {
  return err instanceof Error ? err.message : 'git 실패'
}

// ---- 오케스트레이션 ----
// 경고: collect()는 tryTest()에서 vitest를 인라인 실행한다. 이 함수를 vitest
// 테스트 안에서 직접 호출하면 중첩 vitest 실행이 발생한다. collect.test.ts는
// 순수 헬퍼(loadState/countKb/countCheckboxes)만 테스트하고 collect()는 부르지 않는다.
export function collect(opts: { root?: string } = {}): RawData {
  const root = opts.root ?? process.cwd()

  // 필수 — 깨지면 throw
  const stateJson = JSON.parse(
    readFileSync(join(root, 'project-state.json'), 'utf8'),
  )
  const state = loadState(stateJson)

  const kbJson = JSON.parse(
    readFileSync(join(root, 'src/data/interactions.json'), 'utf8'),
  ) as unknown[]
  const kb = countKb(kbJson)

  // 체크박스: in_progress 마일스톤의 planFile만
  const checkboxes: Record<string, CheckboxCount> = {}
  for (const m of state.milestones) {
    if (m.state === 'in_progress' && m.planFile) {
      const path = join(root, m.planFile)
      if (existsSync(path)) {
        checkboxes[m.planFile] = countCheckboxes(readFileSync(path, 'utf8'))
      }
    }
  }

  // 보조 — 실패 격리
  const git = tryGitLog(root)
  const test = tryTest(root)
  const gh = tryGhIssues(root)
  const gitSha = tryGitSha(root)

  return {
    state,
    kb,
    git,
    test,
    gh,
    checkboxes,
    gitSha,
    generatedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npx vitest run scripts/dashboard/collect.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/dashboard/collect.ts scripts/dashboard/collect.test.ts
git commit -m "feat: 대시보드 소스 수집 (메타 fail-loud, 보조 실패격리, KB raw 카운트)"
```

---

## Task 4: aggregate.ts — 순수 집계 + 동적 해설

**Files:**
- Create: `scripts/dashboard/aggregate.ts`
- Test: `scripts/dashboard/aggregate.test.ts`

**Interfaces:**
- Consumes: `RawData`, `DashboardModel`, `Stat`, `MilestoneView`, `ChipView`, `SectionHelp` (Task 1)
- Produces:
  - `pct(done: number, total: number): number` — 0~100 정수
  - `milestonePct(m: Milestone, cb?: CheckboxCount): number`
  - `kbDynamicHelp(kb: KbRaw): string` — "20% — 8개 PENDING이 병목"
  - `aggregate(raw: RawData): DashboardModel` — 순수 함수

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/dashboard/aggregate.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { pct, milestonePct, kbDynamicHelp, aggregate } from './aggregate'
import type { RawData } from './types'

describe('pct', () => {
  it('3/5 → 60', () => expect(pct(3, 5)).toBe(60))
  it('2/10 → 20', () => expect(pct(2, 10)).toBe(20))
  it('0/0 → 0 (0 나눗셈 안전)', () => expect(pct(0, 0)).toBe(0))
})

describe('milestonePct — state 1차 소스', () => {
  it('done은 체크박스 무관 100', () => {
    expect(milestonePct({ id: 'm', title: 't', state: 'done' })).toBe(100)
  })
  it('todo는 0', () => {
    expect(milestonePct({ id: 'm', title: 't', state: 'todo' })).toBe(0)
  })
  it('in_progress는 체크박스 비율', () => {
    expect(milestonePct({ id: 'm', title: 't', state: 'in_progress' }, { done: 3, total: 5 })).toBe(60)
  })
  it('in_progress인데 체크박스 없으면 0', () => {
    expect(milestonePct({ id: 'm', title: 't', state: 'in_progress' })).toBe(0)
  })
})

describe('kbDynamicHelp — 동적 해설', () => {
  it('PENDING 있으면 병목 문구 포함', () => {
    const help = kbDynamicHelp({ total: 10, verified: 2, pending: 8, entries: [] })
    expect(help).toContain('20%')
    expect(help).toContain('8')
    expect(help).toContain('병목')
  })
  it('PENDING 없으면 병목 문구 없음', () => {
    const help = kbDynamicHelp({ total: 2, verified: 2, pending: 0, entries: [] })
    expect(help).not.toContain('병목')
    expect(help).toContain('100%')
  })
})

describe('aggregate — 통합 모델', () => {
  const raw: RawData = {
    state: {
      project: { name: 'gons-health', tagline: 'T', phase: 'P', status: 'active' },
      milestones: [
        { id: 'm1', title: 'A', state: 'done' },
        { id: 'm2', title: 'B', state: 'in_progress', planFile: 'docs/p.md' },
      ],
      nextActions: [{ rank: 1, title: 'X', why: 'Y', priority: 'high' }],
      constraints: [{ icon: '🚫', title: 'C', body: 'D' }],
      gates: [{ num: '1', name: 'G1', file: 'f.ts', body: 'b' }],
      flow: [{ label: 'A', gate: false }, { label: 'B', gate: true }],
      artifacts: [{ name: 'pkg', cmd: 'c', out: 'o', use: 'u' }],
      help: { kbStatus: '고정설명' },
    },
    kb: {
      total: 3,
      verified: 1,
      pending: 2,
      entries: [
        { id: 'a', drug_class: 'D1', supplement: 'S1', evidence_level: '중', action_type: 'avoid', verified: true, sourceId: 'PMID:111' },
        { id: 'b', drug_class: 'D1', supplement: 'S2', evidence_level: '약', action_type: 'avoid', verified: false, sourceId: 'PENDING' },
        { id: 'c', drug_class: 'D2', supplement: 'S3', evidence_level: '강', action_type: 'spacing', verified: false, sourceId: 'PENDING' },
      ],
    },
    git: { ok: true, value: [{ sha: 'abc123', subject: '커밋1' }] },
    test: { ok: true, value: { passed: 21, failed: 0, total: 21 } },
    gh: { ok: false, reason: 'gh 미설치' },
    checkboxes: { 'docs/p.md': { done: 1, total: 4 } },
    gitSha: 'abc123',
    generatedAt: '2026-06-22T00:00:00.000Z',
  }

  it('KB 모델 계산', () => {
    const model = aggregate(raw)
    expect(model.kb.total).toBe(3)
    expect(model.kb.verified).toBe(1)
    expect(model.kb.pct).toBe(33)
    expect(model.kb.chips).toHaveLength(3)
  })

  it('verified chip은 src 채움, PENDING은 빈 문자열', () => {
    const model = aggregate(raw)
    const verifiedChip = model.kb.chips.find((c) => c.verified)
    const pendingChip = model.kb.chips.find((c) => !c.verified)
    expect(verifiedChip?.src).toBe('PMID:111')
    expect(pendingChip?.src).toBe('')
  })

  it('마일스톤 뷰: done 100, in_progress 체크박스 비율', () => {
    const model = aggregate(raw)
    expect(model.milestones[0].pct).toBe(100)
    expect(model.milestones[1].pct).toBe(25)
    expect(model.milestones[1].detail).toBe('1/4 태스크')
  })

  it('도움말 2층: 고정 + 동적', () => {
    const model = aggregate(raw)
    expect(model.help.kbStatus.fixed).toBe('고정설명')
    expect(model.help.kbStatus.dynamic).toContain('병목')
  })

  it('테스트 통과 stat 생성', () => {
    const model = aggregate(raw)
    const testStat = model.stats.find((s) => s.label.includes('테스트'))
    expect(testStat?.num).toBe('21/21')
    expect(testStat?.tone).toBe('good')
  })

  it('gh 실패 시 ghIssues는 ok:false 보존', () => {
    const model = aggregate(raw)
    expect(model.ghIssues.ok).toBe(false)
  })

  it('gates/flow/artifacts를 메타에서 그대로 통과', () => {
    const model = aggregate(raw)
    expect(model.gates).toHaveLength(1)
    expect(model.flow).toHaveLength(2)
    expect(model.artifacts[0].name).toBe('pkg')
  })

  it('chip label: drug_class는 / 앞, supplement는 ( 앞만 남긴다', () => {
    const labelRaw: RawData = {
      ...raw,
      kb: {
        total: 1,
        verified: 1,
        pending: 0,
        entries: [
          { id: 'x', drug_class: '항응고제/항혈소판제', supplement: '은행 (Ginkgo biloba)', evidence_level: '중', action_type: 'avoid', verified: true, sourceId: 'PMID:111' },
        ],
      },
    }
    const model = aggregate(labelRaw)
    expect(model.kb.chips[0].label).toBe('항응고제 × 은행')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
npx vitest run scripts/dashboard/aggregate.test.ts
```
Expected: FAIL — 모듈/함수 미정의.

- [ ] **Step 3: aggregate.ts 구현**

`scripts/dashboard/aggregate.ts`:
```typescript
import type {
  RawData,
  DashboardModel,
  Stat,
  MilestoneView,
  ChipView,
  SectionHelp,
  Milestone,
  CheckboxCount,
  KbRaw,
} from './types'

// 순수 함수. 네트워크·LLM·I/O 0. 입력 raw → 출력 모델.

export function pct(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

export function milestonePct(m: Milestone, cb?: CheckboxCount): number {
  // state가 1차 소스. 체크박스는 in_progress의 세부 진행 보조.
  if (m.state === 'done') return 100
  if (m.state === 'todo') return 0
  if (cb && cb.total > 0) return pct(cb.done, cb.total)
  return 0
}

export function kbDynamicHelp(kb: KbRaw): string {
  const p = pct(kb.verified, kb.total)
  if (kb.pending > 0) {
    return `검증 ${p}% — ${kb.pending}개 PENDING이 병목. 도구 효용은 verified(${kb.verified}개)에 비례한다.`
  }
  return `검증 ${p}% — 전 엔트리 검증 완료.`
}

function buildStats(raw: RawData): Stat[] {
  const stats: Stat[] = []

  // 1) 테스트
  if (raw.test.ok) {
    const t = raw.test.value
    stats.push({
      num: `${t.passed}/${t.total}`,
      label: '테스트 통과 · 빌드 OK',
      tone: t.failed === 0 ? 'good' : 'warn',
      spark: t.failed === 0 ? '✅' : '❌',
    })
  } else {
    stats.push({ num: '—', label: '테스트 미실행', tone: 'neutral', spark: '⏳' })
  }

  // 2) KB verified
  stats.push({
    num: `${raw.kb.verified}/${raw.kb.total}`,
    label: 'KB 엔트리 verified',
    tone: raw.kb.pending > 0 ? 'warn' : 'good',
    spark: raw.kb.pending > 0 ? '⏳' : '✅',
  })

  // 3) 안전 게이트 (고정 3)
  stats.push({ num: '3', label: '안전 게이트 (합성)', tone: 'neutral', spark: '🔒' })

  // 4) 산출물 (고정 2: 앱 + 코어패키지)
  stats.push({ num: '2', label: '산출물: 앱 + 코어패키지', tone: 'neutral', spark: '📦' })

  return stats
}

function buildMilestones(raw: RawData): MilestoneView[] {
  return raw.state.milestones.map((m) => {
    const cb = m.planFile ? raw.checkboxes[m.planFile] : undefined
    const p = milestonePct(m, cb)
    const detail =
      m.state === 'in_progress' && cb && cb.total > 0
        ? `${cb.done}/${cb.total} 태스크`
        : ''
    return { title: m.title, state: m.state, pct: p, detail }
  })
}

function buildChips(kb: KbRaw): ChipView[] {
  return kb.entries.map((e) => ({
    label: `${e.drug_class.split('/')[0]} × ${e.supplement.split(' (')[0]}`,
    evidence: `${e.evidence_level}·${e.action_type}`,
    verified: e.verified,
    src: e.verified ? e.sourceId : '',
  }))
}

function buildHelp(raw: RawData): Record<string, SectionHelp> {
  const help: Record<string, SectionHelp> = {}
  for (const [key, fixed] of Object.entries(raw.state.help)) {
    help[key] = { fixed, dynamic: '' }
  }
  // 동적 해설 주입
  help.kbStatus = {
    fixed: raw.state.help.kbStatus ?? '',
    dynamic: kbDynamicHelp(raw.kb),
  }
  return help
}

export function aggregate(raw: RawData): DashboardModel {
  return {
    project: raw.state.project,
    stats: buildStats(raw),
    milestones: buildMilestones(raw),
    nextActions: raw.state.nextActions,
    constraints: raw.state.constraints,
    gates: raw.state.gates,
    flow: raw.state.flow,
    artifacts: raw.state.artifacts,
    kb: {
      total: raw.kb.total,
      verified: raw.kb.verified,
      pct: pct(raw.kb.verified, raw.kb.total),
      chips: buildChips(raw.kb),
    },
    recentCommits: raw.git.ok ? raw.git.value : [],
    ghIssues: raw.gh,
    help: buildHelp(raw),
    gitSha: raw.gitSha,
    generatedAt: raw.generatedAt,
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npx vitest run scripts/dashboard/aggregate.test.ts
```
Expected: PASS (모든 테스트).

- [ ] **Step 5: Commit**

```bash
git add scripts/dashboard/aggregate.ts scripts/dashboard/aggregate.test.ts
git commit -m "feat: 대시보드 순수 집계 — 진행률·동적해설·2층 도움말"
```

---

## Task 5: render.ts — HTML 렌더 (기존 디자인 포팅)

**Files:**
- Create: `scripts/dashboard/render.ts`
- Test: `scripts/dashboard/render.test.ts`

**Interfaces:**
- Consumes: `DashboardModel` (Task 1)
- Produces:
  - `escapeHtml(s: string): string`
  - `render(model: DashboardModel): string` — 완전한 HTML 문서 문자열

**디자인 포팅 지침:** 현재 `dashboard.html`(루트)의 `<style>` 블록 전체(oklch 팔레트 :root 변수, .strip/.stat/.gates/.gate/.kb-bar/.chip/.act/.con/.dual/footer 등)를 그대로 render.ts의 CSS 템플릿 리터럴로 옮긴다. 추가로 `?` 토글용 CSS·JS만 신규. 색·반경·그림자·폰트스택을 바꾸지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/dashboard/render.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, escapeHtml } from './render'
import type { DashboardModel } from './types'

const model: DashboardModel = {
  project: { name: 'gons-health', tagline: '태그라인 <테스트>', phase: '1단계', status: 'active' },
  stats: [
    { num: '21/21', label: '테스트 통과', tone: 'good', spark: '✅' },
    { num: '2/10', label: 'KB verified', tone: 'warn', spark: '⏳' },
  ],
  milestones: [
    { title: 'MVP', state: 'done', pct: 100, detail: '' },
    { title: '파이프라인', state: 'in_progress', pct: 25, detail: '1/4 태스크' },
  ],
  nextActions: [{ rank: 1, title: '검증', why: '효용', priority: 'high' }],
  constraints: [{ icon: '🚫', title: '배제', body: '사유' }],
  gates: [
    { num: '1', name: 'verified 게이트', file: 'src/lib/lookup.ts', body: 'verified만 반환' },
    { num: '2', name: 'abstain 상수', file: 'ABSTAIN_MESSAGE', body: '고정 상수' },
    { num: '3', name: 'closed-set 어휘', file: 'src/data/vocabulary.ts', body: '드롭다운만' },
  ],
  flow: [
    { label: 'interactions.json', gate: false },
    { label: 'validateKb()', gate: true },
    { label: 'lookup()', gate: true },
    { label: 'ResultCard', gate: false },
  ],
  artifacts: [
    { name: '@krdn/gons-health', cmd: 'npm run build → dist/', out: '순수 코어', use: '코어 export' },
    { name: 'standalone 웹앱', cmd: 'npm run build:app', out: 'React UI', use: '단독 실행' },
  ],
  kb: {
    total: 2,
    verified: 1,
    pct: 50,
    chips: [
      { label: '항응고제 × 단삼', evidence: '중·avoid', verified: true, src: 'PMID:111' },
      { label: '항응고제 × 은행', evidence: '중·avoid', verified: false, src: '' },
    ],
  },
  recentCommits: [{ sha: 'abc123', subject: '커밋 메시지' }],
  ghIssues: { ok: false, reason: 'gh 미설치' },
  help: {
    kbStatus: { fixed: '고정 설명', dynamic: '동적 해설 병목' },
  },
  gitSha: 'abc123',
  generatedAt: '2026-06-22T00:00:00.000Z',
}

describe('escapeHtml', () => {
  it('꺾쇠·앰퍼샌드 이스케이프', () => {
    expect(escapeHtml('a <b> & c')).toBe('a &lt;b&gt; &amp; c')
  })
})

describe('render — HTML 무결성', () => {
  const html = render(model)

  it('완전한 HTML 문서', () => {
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('</html>')
  })

  it('외부 의존성 0 — script src/link href 없음', () => {
    expect(html).not.toMatch(/<script\s+[^>]*src=/i)
    expect(html).not.toMatch(/<link\s+[^>]*href=/i)
  })

  it('주요 섹션 모두 존재', () => {
    expect(html).toContain('gons-health')
    expect(html).toContain('21/21')
    expect(html).toContain('항응고제 × 단삼')
    expect(html).toContain('PMID:111')
    expect(html).toContain('검증') // nextAction
    expect(html).toContain('배제') // constraint
  })

  it('마일스톤 진행률 렌더', () => {
    expect(html).toContain('파이프라인')
    expect(html).toContain('1/4 태스크')
  })

  it('3중 안전 게이트 섹션 렌더 (원본 핵심 섹션)', () => {
    expect(html).toContain('verified 게이트')
    expect(html).toContain('abstain 상수')
    expect(html).toContain('closed-set 어휘')
    expect(html).toContain('src/lib/lookup.ts')
  })

  it('데이터 흐름 노드 렌더 + 게이트 마크', () => {
    expect(html).toContain('interactions.json')
    expect(html).toContain('validateKb()')
    expect(html).toContain('ResultCard')
  })

  it('듀얼 산출물 섹션 렌더 (원본 핵심 섹션)', () => {
    expect(html).toContain('@krdn/gons-health')
    expect(html).toContain('standalone 웹앱')
    expect(html).toContain('npm run build → dist/')
  })

  it('도움말 2층 주입 (고정 + 동적)', () => {
    expect(html).toContain('고정 설명')
    expect(html).toContain('동적 해설 병목')
  })

  it('? 토글 마크업 + 인라인 스크립트 존재', () => {
    expect(html).toContain('help-toggle')
    expect(html).toContain('<script>') // 인라인 (src 없는)
  })

  it('XSS — tagline 이스케이프', () => {
    expect(html).toContain('&lt;테스트&gt;')
    expect(html).not.toContain('<테스트>')
  })

  it('gh 실패 시 우아한 표시', () => {
    expect(html.toLowerCase()).toContain('github')
  })

  it('생성 시각·SHA 푸터', () => {
    expect(html).toContain('abc123')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
npx vitest run scripts/dashboard/render.test.ts
```
Expected: FAIL — 모듈 미정의.

- [ ] **Step 3: render.ts 구현**

먼저 현재 `dashboard.html`의 `<style>` 내용을 참고해 CSS를 옮긴다. `scripts/dashboard/render.ts`:
```typescript
import type { DashboardModel, SectionHelp } from './types'

// 모델 → 완전한 HTML 문서. 순수 함수. 기존 dashboard.html 디자인 포팅.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ? 토글: 섹션 제목 옆 버튼. 클릭 시 고정+동적 도움말 펼침.
function helpToggle(id: string, help?: SectionHelp): string {
  if (!help) return ''
  const fixed = escapeHtml(help.fixed)
  const dynamic = help.dynamic ? escapeHtml(help.dynamic) : ''
  return `<button class="help-toggle" data-help="${id}" aria-label="도움말">?</button>
    <div class="help-body" id="help-${id}" hidden>
      <p>${fixed}</p>
      ${dynamic ? `<p class="help-dynamic">▸ ${dynamic}</p>` : ''}
    </div>`
}

function renderStats(model: DashboardModel): string {
  return model.stats
    .map(
      (s) => `<div class="stat ${s.tone}"><span class="spark">${s.spark}</span>
        <div class="num">${escapeHtml(s.num)}</div>
        <div class="lbl">${escapeHtml(s.label)}</div></div>`,
    )
    .join('\n')
}

function renderMilestones(model: DashboardModel): string {
  return model.milestones
    .map((m) => {
      const stateLabel = m.state === 'done' ? '완료' : m.state === 'in_progress' ? '진행 중' : '예정'
      const detail = m.detail ? ` · ${escapeHtml(m.detail)}` : ''
      return `<div class="ms ${m.state}">
        <div class="ms-head"><span class="ms-title">${escapeHtml(m.title)}</span>
          <span class="ms-state">${stateLabel}${detail}</span></div>
        <div class="ms-bar"><div class="ms-fill" style="width:${m.pct}%"></div></div>
      </div>`
    })
    .join('\n')
}

function renderChips(model: DashboardModel): string {
  return model.kb.chips
    .map((c) => {
      const cls = c.verified ? 'chip v' : 'chip p'
      const src = c.src ? `<span class="src">${escapeHtml(c.src)}</span>` : ''
      return `<span class="${cls}"><span class="dot"></span>${escapeHtml(c.label)}
        <span class="ev">${escapeHtml(c.evidence)}</span>${src}</span>`
    })
    .join('\n')
}

function renderActions(model: DashboardModel): string {
  return model.nextActions
    .map((a) => {
      const prio = a.priority === 'high' ? ' prio' : ''
      return `<div class="act${prio}"><span class="rank">${a.rank}</span>
        <div><div class="a-title">${escapeHtml(a.title)}</div>
        <div class="a-why">${escapeHtml(a.why)}</div></div></div>`
    })
    .join('\n')
}

function renderConstraints(model: DashboardModel): string {
  return model.constraints
    .map(
      (c) => `<div class="con"><div class="c-icon">${c.icon}</div>
        <div class="c-title">${escapeHtml(c.title)}</div>
        <div class="c-body">${escapeHtml(c.body)}</div></div>`,
    )
    .join('\n')
}

function renderFlow(model: DashboardModel): string {
  if (model.flow.length === 0) return ''
  const nodes = model.flow
    .map((n, i) => {
      const cls = n.gate ? 'node gate-mark' : 'node'
      const arrow = i < model.flow.length - 1 ? '<span class="arr">→</span>' : ''
      return `<span class="${cls}">${escapeHtml(n.label)}</span>${arrow}`
    })
    .join('\n')
  return `<div class="flow-row">${nodes}
    <span class="arr flow-note">하나라도 무너지면 환각 경고가 샌다</span></div>`
}

function renderGates(model: DashboardModel): string {
  return model.gates
    .map(
      (g) => `<div class="gate">
        <div class="g-head"><span class="g-num">${escapeHtml(g.num)}</span>
          <span class="g-name">${escapeHtml(g.name)}</span></div>
        <div class="g-file">${escapeHtml(g.file)}</div>
        <div class="g-body">${escapeHtml(g.body)}</div></div>`,
    )
    .join('\n')
}

function renderArtifacts(model: DashboardModel): string {
  return model.artifacts
    .map(
      (a) => `<div class="art">
        <div class="a-name">${escapeHtml(a.name)}</div>
        <div class="a-cmd">${escapeHtml(a.cmd)}</div>
        <div class="a-out">${escapeHtml(a.out)}</div>
        <div class="a-use">${escapeHtml(a.use)}</div></div>`,
    )
    .join('\n')
}

function renderCommits(model: DashboardModel): string {
  if (model.recentCommits.length === 0) {
    return '<div class="empty">git 이력 없음</div>'
  }
  return model.recentCommits
    .map(
      (c) => `<div class="commit"><code>${escapeHtml(c.sha)}</code>
        <span>${escapeHtml(c.subject)}</span></div>`,
    )
    .join('\n')
}

function renderGhIssues(model: DashboardModel): string {
  if (!model.ghIssues.ok) {
    return `<div class="empty">GitHub 이슈 연계 안 됨 (${escapeHtml(model.ghIssues.reason)})</div>`
  }
  if (model.ghIssues.value.length === 0) {
    return '<div class="empty">열린 GitHub 이슈 없음</div>'
  }
  return model.ghIssues.value
    .map(
      (i) => `<div class="issue"><span class="issue-num">#${i.number}</span>
        <a href="${escapeHtml(i.url)}">${escapeHtml(i.title)}</a></div>`,
    )
    .join('\n')
}

const STYLE = `
  :root {
    --bg: oklch(16% 0.01 260); --panel: oklch(21% 0.015 260);
    --panel-2: oklch(25% 0.02 260); --line: oklch(32% 0.02 260);
    --text: oklch(94% 0.01 260); --muted: oklch(68% 0.015 260);
    --ok: oklch(72% 0.16 150); --pending: oklch(76% 0.14 75);
    --danger: oklch(68% 0.2 25); --accent: oklch(72% 0.15 250);
    --shadow: 0 1px 0 oklch(100% 0 0 / 0.04) inset, 0 8px 24px oklch(0% 0 0 / 0.35);
    --radius: 14px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; line-height: 1.45; }
  a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 22px 80px; }
  header { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
    border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 22px; }
  header h1 { font-size: 22px; margin: 0; letter-spacing: -0.02em; }
  header .tag { font-size: 12px; color: var(--muted); background: var(--panel-2);
    border: 1px solid var(--line); padding: 3px 9px; border-radius: 999px; }
  header .one-line { flex-basis: 100%; color: var(--muted); font-size: 14px; margin-top: 4px; }
  .strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
  .stat { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 16px 16px 14px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
  .stat .num { font-size: 30px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
  .stat .lbl { font-size: 12px; color: var(--muted); margin-top: 7px; }
  .stat.good .num { color: var(--ok); } .stat.warn .num { color: var(--pending); }
  .stat .spark { position: absolute; right: 12px; top: 12px; font-size: 16px; opacity: .55; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);
    margin: 30px 0 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .gates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .gate { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 16px; box-shadow: var(--shadow); }
  .gate .g-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .gate .g-num { font-size: 11px; font-weight: 700; color: var(--bg); background: var(--accent);
    width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; flex: none; }
  .gate .g-name { font-weight: 600; font-size: 15px; }
  .gate .g-file { font-size: 11px; color: var(--muted); font-family: ui-monospace, Menlo, monospace; }
  .gate .g-body { font-size: 13px; color: var(--muted); margin-top: 8px; }
  .flow-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 14px 16px; box-shadow: var(--shadow); font-size: 13px; margin-bottom: 14px; }
  .flow-row .node { background: var(--panel-2); border: 1px solid var(--line);
    padding: 7px 11px; border-radius: 8px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .flow-row .node.gate-mark { border-color: var(--ok); color: var(--ok); }
  .flow-row .arr { color: var(--muted); }
  .flow-row .flow-note { margin-left: auto; font-size: 12px; }
  .dual { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .art { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 16px; box-shadow: var(--shadow); }
  .art .a-name { font-family: ui-monospace, Menlo, monospace; font-size: 14px; font-weight: 600; }
  .art .a-cmd { font-size: 12px; color: var(--accent); font-family: ui-monospace, Menlo, monospace; margin-top: 6px; }
  .art .a-out { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .art .a-use { font-size: 12.5px; color: var(--muted); margin-top: 8px; }
  .kb-bar-wrap { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 18px; box-shadow: var(--shadow); }
  .kb-bar-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .kb-bar-head .pct { font-size: 26px; font-weight: 700; color: var(--pending); }
  .kb-bar { height: 14px; border-radius: 999px; background: var(--panel-2);
    overflow: hidden; border: 1px solid var(--line); }
  .kb-bar .fill { height: 100%; background: linear-gradient(90deg, var(--ok), oklch(78% 0.14 130));
    border-radius: 999px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px;
    border-radius: 9px; font-size: 12.5px; border: 1px solid var(--line); background: var(--panel-2); }
  .chip .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .chip.v { border-color: oklch(72% 0.16 150 / 0.45); }
  .chip.v .dot { background: var(--ok); box-shadow: 0 0 8px var(--ok); }
  .chip.p { opacity: .82; } .chip.p .dot { background: var(--pending); }
  .chip .ev { font-size: 10px; color: var(--muted); border: 1px solid var(--line);
    border-radius: 5px; padding: 1px 5px; }
  .chip .src { font-size: 10px; color: var(--ok); font-family: ui-monospace, Menlo, monospace; }
  .ms { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 13px 15px; box-shadow: var(--shadow); margin-bottom: 8px; }
  .ms-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .ms-title { font-weight: 600; font-size: 14px; }
  .ms-state { font-size: 11px; color: var(--muted); }
  .ms-bar { height: 8px; border-radius: 999px; background: var(--panel-2); overflow: hidden; }
  .ms-fill { height: 100%; background: var(--accent); border-radius: 999px; }
  .ms.done .ms-fill { background: var(--ok); }
  .actions { display: grid; gap: 10px; }
  .act { display: flex; gap: 14px; align-items: flex-start; background: var(--panel);
    border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 12px;
    padding: 14px 16px; box-shadow: var(--shadow); }
  .act.prio { border-left-color: var(--pending); }
  .act .rank { font-size: 12px; font-weight: 700; color: var(--muted); width: 18px; flex: none; }
  .act .a-title { font-weight: 600; font-size: 14.5px; }
  .act .a-why { font-size: 12.5px; color: var(--muted); margin-top: 3px; }
  .constr { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .con { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px; box-shadow: var(--shadow); font-size: 13px; }
  .con .c-icon { font-size: 18px; } .con .c-title { font-weight: 600; margin: 6px 0 4px; }
  .con .c-body { color: var(--muted); font-size: 12.5px; }
  .commit, .issue { display: flex; gap: 10px; padding: 7px 0; font-size: 13px;
    border-bottom: 1px solid var(--line); }
  .commit code { color: var(--accent); font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .commit span { color: var(--muted); }
  .list-wrap { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 8px 16px; box-shadow: var(--shadow); }
  .empty { color: var(--muted); font-size: 13px; padding: 12px 0; }
  .help-toggle { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--line);
    background: var(--panel-2); color: var(--muted); font-size: 11px; cursor: pointer; padding: 0;
    line-height: 1; } .help-toggle:hover { color: var(--text); border-color: var(--accent); }
  .help-body { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 14px; margin: 8px 0 12px; font-size: 13px; color: var(--muted); }
  .help-body p { margin: 0 0 6px; } .help-body p:last-child { margin: 0; }
  .help-dynamic { color: var(--pending); }
  footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid var(--line);
    font-size: 12px; color: var(--muted); display: flex; justify-content: space-between;
    flex-wrap: wrap; gap: 8px; }
  @media (max-width: 760px) { .strip, .gates, .constr { grid-template-columns: 1fr 1fr; }
    .dual { grid-template-columns: 1fr; } }
`

const SCRIPT = `
  document.querySelectorAll('.help-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-help');
      var body = document.getElementById('help-' + id);
      if (body) body.hidden = !body.hidden;
    });
  });
`

export function render(model: DashboardModel): string {
  const p = model.project
  const date = model.generatedAt.slice(0, 10)
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(p.name)} · 한눈에</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>🛡 ${escapeHtml(p.name)}</h1>
    <span class="tag">${escapeHtml(p.phase)}</span>
    <span class="tag">${escapeHtml(p.status)}</span>
    <p class="one-line">${escapeHtml(p.tagline)}</p>
  </header>

  <div class="strip">${renderStats(model)}</div>

  <h2>마일스톤 ${helpToggle('milestones', model.help.milestones)}</h2>
  ${renderMilestones(model)}

  <h2>안전 모델 — 데이터 흐름과 3중 게이트 ${helpToggle('safetyGates', model.help.safetyGates)}</h2>
  ${renderFlow(model)}
  <div class="gates">${renderGates(model)}</div>

  <h2>KB 검증 현황 ${helpToggle('kbStatus', model.help.kbStatus)}</h2>
  <div class="kb-bar-wrap">
    <div class="kb-bar-head"><div>검증된 엔트리 비율</div><div class="pct">${model.kb.pct}%</div></div>
    <div class="kb-bar"><div class="fill" style="width:${model.kb.pct}%"></div></div>
    <div class="chips">${renderChips(model)}</div>
  </div>

  <h2>다음 행동 ${helpToggle('nextActions', model.help.nextActions)}</h2>
  <div class="actions">${renderActions(model)}</div>

  <h2>듀얼 산출물 구조 ${helpToggle('dualArtifact', model.help.dualArtifact)}</h2>
  <div class="dual">${renderArtifacts(model)}</div>

  <h2>최근 작업</h2>
  <div class="list-wrap">${renderCommits(model)}</div>

  <h2>GitHub 이슈 (할 일)</h2>
  <div class="list-wrap">${renderGhIssues(model)}</div>

  <h2>범위 제약 ${helpToggle('constraints', model.help.constraints)}</h2>
  <div class="constr">${renderConstraints(model)}</div>

  <footer>
    <span>생성: ${escapeHtml(date)} · ${escapeHtml(model.gitSha)}</span>
    <span>npm run dashboard 로 갱신 · 의도는 project-state.json</span>
  </footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npx vitest run scripts/dashboard/render.test.ts
```
Expected: PASS (모든 테스트).

- [ ] **Step 5: Commit**

```bash
git add scripts/dashboard/render.ts scripts/dashboard/render.test.ts
git commit -m "feat: 대시보드 HTML 렌더 — 기존 디자인 포팅 + ? 토글 도움말"
```

---

## Task 6: dashboard.ts 오케스트레이터 + 육안 검증

**Files:**
- Create: `scripts/dashboard.ts`
- Modify: `dashboard.html` (생성기 출력으로 덮어씀)

**Interfaces:**
- Consumes: `collect` (Task 3), `aggregate` (Task 4), `render` (Task 5)

- [ ] **Step 1: 오케스트레이터 작성**

`scripts/dashboard.ts`:
```typescript
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { collect } from './dashboard/collect'
import { aggregate } from './dashboard/aggregate'
import { render } from './dashboard/render'

// 대시보드 생성 진입점. collect → aggregate → render → write.
// 메타파일 깨지면 collect가 throw → 비-0 종료로 드러남(fail-loud).
function main(): void {
  const root = process.cwd()
  const raw = collect({ root })
  const model = aggregate(raw)
  const html = render(model)
  const out = join(root, 'dashboard.html')
  writeFileSync(out, html, 'utf8')
  // eslint-disable-next-line no-console
  console.log(`✅ dashboard.html 생성됨 (KB ${model.kb.verified}/${model.kb.total}, 마일스톤 ${model.milestones.length}개)`)
}

main()
```

- [ ] **Step 2: 생성기 실행**

Run:
```bash
npm run dashboard
```
Expected: `✅ dashboard.html 생성됨 (KB 2/10, 마일스톤 4개)` 출력. `.dashboard-test-report.json` 도 생성됨(테스트 인라인 실행 산출물).

- [ ] **Step 3: 생성된 HTML 무결성 확인**

Run:
```bash
node -e "
const h = require('fs').readFileSync('dashboard.html','utf8');
console.log('외부 script src:', /<script\s+[^>]*src=/i.test(h));
console.log('KB 2/10 포함:', h.includes('2/10'));
console.log('PMID 포함:', h.includes('PMID:11302416'));
console.log('? 토글 포함:', h.includes('help-toggle'));
console.log('3중 게이트 포함:', h.includes('verified 게이트') && h.includes('closed-set 어휘'));
console.log('데이터 흐름 포함:', h.includes('validateKb()') && h.includes('ResultCard'));
console.log('듀얼 산출물 포함:', h.includes('@krdn/gons-health') && h.includes('standalone'));
"
```
Expected: `외부 script src: false` / 나머지 모두 `true`.

- [ ] **Step 3b: 원본 섹션 1:1 대조 (회귀 방지)**

생성된 대시보드가 원본 `dashboard.html`(사용자가 "매우 훌륭해"한 것)의 모든 핵심 섹션을 포함하는지 확인. 원본 섹션 인벤토리:

| 원본 섹션 | 생성본에 있어야 함 |
|-----------|-------------------|
| 상단 stat strip | ✓ (Task 5 renderStats) |
| 안전 모델 — 3중 게이트 + 데이터흐름 | ✓ (renderGates/renderFlow) |
| KB 검증 현황 + chip | ✓ (renderChips) |
| 다음 행동 | ✓ (renderActions) |
| 듀얼 산출물 구조 | ✓ (renderArtifacts) |
| 범위 제약 | ✓ (renderConstraints) |

신규 추가 섹션(마일스톤·최근 작업·GitHub 이슈)은 살아있는 대시보드의 확장이다.
Step 3 출력이 모두 `true`면 섹션 누락 없음.

- [ ] **Step 4: 테스트 리포트 아티팩트 gitignore**

`.gitignore` 에 한 줄 추가 (없으면 생성):
```
.dashboard-test-report.json
```

Run:
```bash
node -e "const fs=require('fs'); const p='.gitignore'; let c=fs.existsSync(p)?fs.readFileSync(p,'utf8'):''; if(!c.includes('.dashboard-test-report.json')){fs.writeFileSync(p, c+(c.endsWith('\n')||c===''?'':'\n')+'.dashboard-test-report.json\n')} console.log('done')"
```
Expected: `done`. (이 파일은 매 생성 시 만들어지는 임시 산출물이라 커밋하지 않는다.)

- [ ] **Step 5: 육안 검증 (사람 확인)**

Run:
```bash
xdg-open dashboard.html
```
브라우저에서 원본 디자인과 대조 확인:
- oklch 다크 팔레트·카드·그림자가 기존과 동일한가
- 상단 stat strip 4개, KB 진행바, chip(verified는 PMID 표시), 다음 행동, 범위 제약 모두 보이는가
- **3중 게이트 카드 3개 + 데이터 흐름(interactions.json → validateKb → lookup → ResultCard, 게이트는 초록)** 이 보이는가
- **듀얼 산출물 카드 2개(@krdn/gons-health, standalone 웹앱)** 가 보이는가
- `?` 버튼 클릭 시 고정+동적(병목) 도움말이 펼쳐지는가 (게이트·산출물 섹션 `?`도 동작하는가)
- 마일스톤 4개와 진행바가 보이는가

> 이 스텝은 자동 테스트로 대체 불가. 사용자가 "매우 훌륭해"한 디자인의 충실 재현이 합격 기준이다.

- [ ] **Step 6: Commit**

```bash
git add scripts/dashboard.ts dashboard.html .gitignore
git commit -m "feat: 대시보드 오케스트레이터 + 생성 산출물 전환"
```

---

## Task 7: 스킬 + CLAUDE.md + 문서 통합

**Files:**
- Create: `~/.claude/skills/gon:dashboard/SKILL.md`
- Modify: `CLAUDE.md` (프로젝트 루트)
- Create: `docs/DASHBOARD.md`

**스킬 분리 원칙:** 스킬은 **얇은 범용 런처**다 — `npm run dashboard` 실행 + 브라우저 열기 + 메타파일 편집 안내만. 프로젝트 특화 로직(KB 파싱·디자인)은 전부 `scripts/`·`project-state.json`에 있다. 스킬에 gons-health 특화 코드를 박지 않는다.

- [ ] **Step 1: 스킬 디렉토리·파일 작성**

Run:
```bash
mkdir -p ~/.claude/skills/gon:dashboard
```

`~/.claude/skills/gon:dashboard/SKILL.md`:
```markdown
---
name: gon:dashboard
description: 프로젝트 살아있는 대시보드 생성·갱신. project-state.json(의도)과 코드 파생 데이터(KB·git·테스트)를 읽어 dashboard.html을 재생성. "/gon:dashboard", "대시보드 갱신", "대시보드 열어줘", "프로젝트 현황" 요청 시 사용.
version: 1.0.0
context: fork
allowed-tools:
  - Bash
  - Read
  - Edit
---

# gon:dashboard — 살아있는 프로젝트 대시보드

프로젝트의 흩어진 소스를 읽어 `dashboard.html`을 재생성한다. 생성 로직은
프로젝트의 `scripts/dashboard/`(결정론적, LLM 0)에 있고, 이 스킬은 그것을
호출하는 얇은 런처다. 의도 데이터는 `project-state.json`에서만 읽는다.

## 서브커맨드 라우팅

ARGUMENTS를 보고 아래 중 하나만 실행한다.

| 입력 | 동작 |
|------|------|
| `/gon:dashboard` 또는 `update` | 재생성 + 열기 |
| `/gon:dashboard edit` | 메타파일 편집 안내 |
| `/gon:dashboard help` | 섹션 의미 설명 |

### update (기본)

1. `npm run dashboard` 실행.
   - 성공: `✅ dashboard.html 생성됨` 출력 확인.
   - 실패(throw): 보통 `project-state.json` 필드 누락이다. 에러 메시지의
     누락 필드를 사용자에게 알리고 수정 안내(edit 모드로).
2. `xdg-open dashboard.html` 로 브라우저에서 연다(이미 열려 있으면 새로고침 안내).
3. 갱신 요약 보고: KB verified 비율, 마일스톤 상태, 테스트 결과.

### edit

`project-state.json`은 코드에서 끌어올 수 없는 **의도**만 담는다:
milestones·nextActions·constraints·help. 다음을 안내한다.

1. 현재 `project-state.json`을 Read.
2. 코드 상태와 의도가 어긋난 곳을 짚는다. 예:
   - 마일스톤이 실제로 끝났는데 state가 in_progress인가?
   - 다음 행동 우선순위가 바뀌었나?
3. 사용자 합의 후 해당 필드만 Edit. 자동 추출 가능한 데이터(KB 통계·
   git·테스트)는 절대 메타파일에 넣지 않는다(드리프트 방지).
4. 편집 후 `npm run dashboard`로 갱신.

### help

대시보드 각 섹션의 의미를 설명한다(상단 지표·안전 모델·KB 현황·
마일스톤·다음 행동·범위 제약). 대시보드 자체의 `?` 토글에도 동일한
고정 설명이 들어있음을 안내한다.

## 주의

- 이 스킬은 프로젝트에 `scripts/dashboard.ts`와 `project-state.json`이
  있을 때만 동작한다. 없으면 "이 프로젝트엔 대시보드 생성기가 없습니다"
  라고 알리고 설계 문서(`docs/superpowers/specs/`)를 가리킨다.
- 한글은 리터럴 UTF-8로 출력한다(\uXXXX 이스케이프 금지).
```

- [ ] **Step 2: 스킬 인식 확인**

Run:
```bash
test -f ~/.claude/skills/gon:dashboard/SKILL.md && head -3 ~/.claude/skills/gon:dashboard/SKILL.md
```
Expected: frontmatter `name: gon:dashboard` 가 보임.

- [ ] **Step 3: CLAUDE.md에 트리거 문구 추가**

`CLAUDE.md`(프로젝트 루트)의 마지막 `## 도구 호출 규칙 (필수)` 섹션 **앞에** 다음 섹션을 추가:
```markdown
## 대시보드 자동 갱신 (gon:dashboard)

다음 작업을 한 뒤에는 `npm run dashboard`로 `dashboard.html`을 갱신한다:
- `interactions.json` KB 엔트리 추가·verified 승격
- plan 문서의 `- [ ]` 체크박스 완료
- 마일스톤 전환 / 다음 행동 변경 (→ `project-state.json`도 함께 편집)

의도(다음 행동·마일스톤·범위·도움말)가 바뀌면 `project-state.json`을 먼저 고치고 갱신한다.
대시보드는 코드 파생 데이터(KB·git·테스트)는 자동 집계하고, 의도는 메타파일에서만 읽는다.
생성기는 `scripts/dashboard/`에 격리된 결정론적 순수 스크립트다(런타임 LLM/API 0 불변식 유지).
상세: `docs/DASHBOARD.md`.

```

- [ ] **Step 4: docs/DASHBOARD.md 작성**

`docs/DASHBOARD.md`:
```markdown
# 대시보드 (Living Dashboard)

`dashboard.html`은 손으로 쓰는 파일이 아니라 **생성 산출물**이다.
`npm run dashboard` 가 프로젝트의 흩어진 소스를 읽어 재생성한다.

## 갱신

```bash
npm run dashboard      # dashboard.html 재생성
```

또는 `/gon:dashboard` 스킬(재생성 + 브라우저 열기).

## 데이터 소스

| 표시 | 소스 | 종류 |
|------|------|------|
| KB verified 비율·chip | `src/data/interactions.json` (raw 카운트) | 자동 |
| 마일스톤 상태·진행률 | `project-state.json` state + plan 체크박스 | 혼합 |
| 다음 행동·범위 제약·도움말 | `project-state.json` | 의도(수동) |
| 최근 작업 | `git log` | 자동 |
| 테스트 결과 | `vitest run --reporter=json` (인라인) | 자동 |
| GitHub 이슈 | `gh issue list` (선택, 없으면 스킵) | 자동 |

**원칙:** 자동 추출 가능한 데이터는 `project-state.json`에 넣지 않는다.
메타파일은 코드에 없는 **의도**만 담는다 → 드리프트 구조적 불가능.

## 의도 편집 — project-state.json

마일스톤 완료, 다음 행동 우선순위, 범위 제약, 섹션 도움말이 바뀌면
이 파일을 고친다. `milestone.state`(done/in_progress/todo)가 진행률의
1차 소스다(plan 체크박스는 실행 후 갱신 안 될 수 있어 보조로만 사용).

## GitHub 연계 (선택)

기본은 열린 이슈를 읽어 "할 일"에 단방향 표시한다(읽기 전용).
Project 보드까지 연계하려면 스코프를 추가한다:

```bash
gh auth refresh -s read:project,project
```

(현 범위는 issue 단방향 미러까지. Project 보드는 별도 작업.)

## 아키텍처

`scripts/dashboard/` 의 결정론적 순수 스크립트:
- `collect.ts` — 소스 수집. 메타파일 fail-loud, 보조 소스 실패격리.
- `aggregate.ts` — raw → 모델. 진행률·동적해설. 순수 함수.
- `render.ts` — 모델 → HTML. 의존성 0 단일 파일.
- `dashboard.ts` — 오케스트레이터.

런타임 코어(`src/lib/`)와 분리돼 LLM/API 0 불변식을 유지한다.
```

- [ ] **Step 5: 전체 테스트 + 생성 재확인**

Run:
```bash
npm test && npm run dashboard
```
Expected: 모든 테스트 PASS(기존 21 + 신규 collect/aggregate/render), `✅ dashboard.html 생성됨`.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/DASHBOARD.md
git commit -m "docs: 대시보드 스킬 트리거 문구·사용법 문서 추가"
```

> 참고: `~/.claude/skills/gon:dashboard/SKILL.md`는 프로젝트 repo 밖(글로벌 스킬)이라 이 커밋에 포함되지 않는다.

---

## Self-Review 결과

**1. Spec coverage:**
- 갱신 트리거(스킬만) → Task 7 (스킬·CLAUDE.md) ✓
- 의도 메타파일 + 파싱 혼합 → Task 2(부트스트랩) + Task 3(collect) ✓
- GitHub 단방향 미러 → Task 3(tryGhIssues) + Task 5(renderGhIssues) ✓
- 인라인 ? 토글 + 동적해설 2층 → Task 4(buildHelp) + Task 5(helpToggle) ✓
- LLM 0 / scripts 격리 / 단일 HTML / KB raw 카운트 / fail-loud → Global Constraints + 각 태스크 ✓
- 디자인 충실 재현 → Task 5 포팅 지침 + Task 6 육안 검증 ✓
- 부트스트랩(advisor #2) → Task 2 ✓
- 테스트 캐시 픽션 제거(advisor #1) → Task 3 인라인 vitest 실행 ✓
- 체크박스 함정(발견) → milestonePct state 1차 소스 ✓
- **3중 게이트 + 듀얼 산출물 섹션 복원(advisor 2차 #블로킹)** → types(Gate/FlowNode/Artifact) + Task 2 메타데이터 + Task 5 renderGates/renderFlow/renderArtifacts + render.test 3섹션 assert + Task 6 Step 3b 1:1 대조 ✓
- label 변환 테스트(advisor 2차) → aggregate.test "chip label" 케이스 ✓
- recursion 주석(advisor 2차) → collect.ts collect() 상단 경고 ✓

**2. Placeholder scan:** "TBD"/"TODO"/"적절히" 없음. 모든 코드 스텝에 완전한 코드. ✓

**3. Type consistency:** types.ts에 정의된 이름이 collect/aggregate/render에서 일관 사용(`countKb`/`countCheckboxes`/`milestonePct`/`kbDynamicHelp`/`SourceResult`/`DashboardModel`/`Gate`/`FlowNode`/`Artifact`). render는 `model.help.kbStatus`·`model.help.safetyGates`·`model.help.dualArtifact` 등 aggregate가 buildHelp로 채운 키를 참조 — 고아 help 키 없음 ✓

**4. 원본 섹션 충실성(advisor 2차 핵심):** 원본 dashboard.html의 6개 핵심 섹션(stat strip·3중 게이트+흐름·KB chip·다음 행동·듀얼 산출물·범위 제약)이 모두 render()에 존재. Step 3 자동 grep + Step 3b 1:1 대조표 + Step 5 육안 체크리스트 3중으로 회귀 방지 ✓
