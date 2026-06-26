# 마일스톤 드리프트 감지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** project-state.json 마일스톤 `state`(의도)와 git 현실(main 병합 여부)의 드리프트를 즉시 수정하고, anchor 커밋 양방향 대조로 재발을 대시보드 경고로 자동 감지한다.

**Architecture:** 마일스톤에 출시 증거 커밋 `anchor`를 단다. collect가 `anchor`의 main 조상 여부(`yes/no/absent/unknown`)를 git으로 판정(I/O는 collect만), aggregate가 순수 함수로 state↔ancestry 양방향 드리프트를 산출, render가 드리프트를 항상-보이는 경고 박스로 표시. 기존 collect→aggregate→render 4계층에 얹는다.

**Tech Stack:** TypeScript, Vitest, tsx, Node child_process(execSync). 런타임 LLM/외부 API 0.

## Global Constraints

- 런타임 LLM·외부 API 호출 0 (결정론적 closed-set 도구 불변식).
- 대시보드 데이터 이원화: 코드 파생 사실은 자동 집계, 의도는 메타파일(project-state.json)에서만.
- git I/O는 collect.ts에만. aggregate.ts는 순수 함수(네트워크·I/O 0).
- 보조 소스 실패는 격리(throw 안 함). 메타파일(project-state.json) 깨짐만 fail-loud throw.
- execSync에 들어가는 외부 문자열은 정규식 검증 필수(인젝션 방어). anchor는 `/^[0-9a-f]{7,40}$/`.
- main 비교 기준은 로컬 `main` ref 명시(HEAD 아님 — 대시보드는 feature 브랜치에서도 재생성됨).
- 모든 render 출력 문자열은 escapeHtml 통과.
- 한글은 리터럴 UTF-8(도구 입력 \uXXXX 금지).
- 드리프트 `detail` 문구는 사실만, 가치판단 없음(kbDynamicHelp 원칙).
- 정상 케이스(드리프트 0)에 노이즈 0 — 경고 박스는 드리프트 있을 때만 렌더.

설계 출처: `docs/superpowers/specs/2026-06-27-milestone-drift-detection-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `scripts/dashboard/types.ts` | 타입 정의 | `MilestoneState`에 `'parked'`, `Milestone.anchor?`, `Ancestry`, `MilestoneDrift`, `RawData.milestoneAncestry`, `DashboardModel.milestoneDrifts` |
| `scripts/dashboard/collect.ts` | git I/O·메타 로드 | `anchorAncestryOfMain` + `commitExists`/`mainRefExists` 헬퍼, collect가 ancestry 맵 수집 |
| `scripts/dashboard/aggregate.ts` | 순수 집계 | `detectMilestoneDrift` + model에 `milestoneDrifts` 주입 |
| `scripts/dashboard/render.ts` | HTML 렌더 | 드리프트 경고 박스, parked 상태 라벨 |
| `project-state.json` | 의도 메타 | m2/m3 state 정정, m1/m3 anchor, m2 planFile 제거 |
| `dashboard.html` | 생성 산출물 | 재생성 |
| 각 `*.test.ts` | 테스트 | 각 Task 내 |

실행 순서: Task 1(타입) → Task 2(collect) → Task 3(aggregate, **핵심 양방향 로직**) → Task 4(render) → Task 5(project-state.json 수정 + 재생성 + 육안).

---

## Task 1: 타입 정의 확장

**Files:**
- Modify: `scripts/dashboard/types.ts:11-16` (Milestone), `:130-135` (MilestoneView), `:111-120` (RawData), `:149-170` (DashboardModel)
- Test: 없음 (타입만 — tsc로 검증)

**Interfaces:**
- Produces: `MilestoneState`, `Milestone.anchor?`, `Ancestry`, `MilestoneDrift`, `RawData.milestoneAncestry`, `DashboardModel.milestoneDrifts`

- [ ] **Step 1: `Milestone`에 parked + anchor 추가**

`scripts/dashboard/types.ts:11-16` 을 교체:

```typescript
export type MilestoneState = 'done' | 'in_progress' | 'parked' | 'todo'

export interface Milestone {
  id: string
  title: string
  state: MilestoneState
  planFile?: string // in_progress일 때 세부 진행률 계산용
  anchor?: string // 출시 증거 커밋(단축 해시). main 조상 여부로 state와 양방향 대조
}
```

- [ ] **Step 2: `MilestoneView.state` 타입을 MilestoneState로 통일**

`scripts/dashboard/types.ts:130-135` 의 `MilestoneView`에서 `state: 'done' | 'in_progress' | 'todo'` 를 `state: MilestoneState` 로 교체:

```typescript
export interface MilestoneView {
  title: string
  state: MilestoneState
  pct: number // 0~100
  detail: string // "3/5 태스크" 또는 ""
}
```

- [ ] **Step 3: `Ancestry`와 `MilestoneDrift` 타입 신설**

`scripts/dashboard/types.ts` 의 `Milestone` 인터페이스 바로 아래(`:16` 직후)에 추가:

```typescript
// anchor 커밋의 main 조상 여부.
// yes=main 조상 / no=커밋 있으나 조상 아님 / absent=커밋이 git에 없음(오타·유실) / unknown=조회 실패(환경)
export type Ancestry = 'yes' | 'no' | 'absent' | 'unknown'

// aggregate가 산출, render가 경고로 표시.
export interface MilestoneDrift {
  id: string
  title: string
  kind: 'shipped-not-done' | 'done-not-shipped' | 'done-without-anchor' | 'anchor-missing'
  detail: string // 사람이 읽을 한 줄(사실만, 가치판단 없음)
}
```

- [ ] **Step 4: `RawData`에 ancestry 맵, `DashboardModel`에 드리프트 배열 추가**

`scripts/dashboard/types.ts` `RawData` 인터페이스(`:111-120`)에 필드 추가 — `generatedAt: string` 줄 위에:

```typescript
  milestoneAncestry: Record<string, Ancestry> // 마일스톤 id → anchor 조상여부(anchor 없으면 키 없음)
```

`DashboardModel` 인터페이스(`:149-170`)에 필드 추가 — `milestones: MilestoneView[]` 줄 바로 아래:

```typescript
  milestoneDrifts: MilestoneDrift[] // 비면 경고 렌더 안 함
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc -p scripts/tsconfig.json --noEmit`
Expected: PASS (아직 collect/aggregate가 새 필드를 안 채워 에러 날 수 있음 — 그 경우 Step 6으로). 만약 "milestoneAncestry 누락" 류 에러가 collect.ts/aggregate.ts에서 나면 정상(다음 Task에서 채움). **types.ts 자체 문법 에러만 없으면 통과로 본다.**

- [ ] **Step 6: 커밋**

```bash
git add scripts/dashboard/types.ts
git commit -m "feat: 마일스톤 anchor·드리프트 타입 (parked state + Ancestry/MilestoneDrift)"
```

---

## Task 2: collect — anchor의 main 조상 판정

**Files:**
- Modify: `scripts/dashboard/collect.ts` (헬퍼 추가 + collect 본문에 ancestry 수집)
- Test: `scripts/dashboard/collect.test.ts`

**Interfaces:**
- Consumes: `Ancestry`, `Milestone` (types.ts)
- Produces: `anchorAncestryOfMain(sha: string, root: string): Ancestry` (export), `RawData.milestoneAncestry` 채움

- [ ] **Step 1: 실패하는 테스트 작성 (SHA 검증 = 인젝션 방어)**

`scripts/dashboard/collect.test.ts` 상단 import에 `anchorAncestryOfMain` 추가하고, 파일 끝에 describe 추가:

```typescript
describe('anchorAncestryOfMain — anchor의 main 조상 판정', () => {
  it('SHA 형식 위반은 execSync 실행 없이 absent (인젝션 방어)', () => {
    // 세미콜론·공백 포함 → 정규식 불통과 → absent (git 명령 미실행)
    expect(anchorAncestryOfMain('a95fbaf; rm -rf /', process.cwd())).toBe('absent')
    expect(anchorAncestryOfMain('not-a-sha', process.cwd())).toBe('absent')
    expect(anchorAncestryOfMain('', process.cwd())).toBe('absent')
  })

  it('main 조상 커밋은 yes', () => {
    // a95fbaf = "merge: 살아있는 대시보드" — 이 repo main의 실제 조상
    expect(anchorAncestryOfMain('a95fbaf', process.cwd())).toBe('yes')
  })

  it('git에 없는 유효형식 해시는 absent', () => {
    // 형식은 맞으나 존재하지 않는 커밋
    expect(anchorAncestryOfMain('deadbee', process.cwd())).toBe('absent')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run scripts/dashboard/collect.test.ts -t "anchorAncestryOfMain"`
Expected: FAIL — `anchorAncestryOfMain is not a function` (또는 import 에러)

- [ ] **Step 3: 헬퍼 구현**

`scripts/dashboard/collect.ts` 에서 `gitReason` 함수 정의(`:191-193`) **아래**에 추가:

```typescript
const SHA_RE = /^[0-9a-f]{7,40}$/ // 인젝션 방어: project-state.json은 사람 편집

function commitExists(sha: string, root: string): boolean {
  try {
    execSync(`git cat-file -e ${sha}^{commit}`, {
      cwd: root,
      timeout: 5000,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

function mainRefExists(root: string): boolean {
  try {
    execSync('git rev-parse --verify main', {
      cwd: root,
      timeout: 5000,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

// anchor가 main의 조상인가. HEAD가 아니라 'main' 명시 — 대시보드는 feature 브랜치에서도
// 재생성되므로 checked-out 브랜치에 판정이 휘둘리면 안 된다.
export function anchorAncestryOfMain(sha: string, root: string): Ancestry {
  if (!SHA_RE.test(sha)) return 'absent' // 형식 위반 = 유효 해시 아님
  try {
    execSync(`git merge-base --is-ancestor ${sha} main`, {
      cwd: root,
      timeout: 5000,
      stdio: 'ignore',
    })
    return 'yes' // exit 0 = 조상
  } catch {
    if (!commitExists(sha, root)) return 'absent' // 커밋 부재(오타·유실)
    if (!mainRefExists(root)) return 'unknown' // main ref 자체 부재 = 환경 문제
    return 'no' // 커밋 있고 main 있는데 조상 아님
  }
}
```

`scripts/dashboard/collect.ts:4-14` 의 type import 블록에 `Ancestry` 추가:

```typescript
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
  Ancestry,
} from './types'
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run scripts/dashboard/collect.test.ts -t "anchorAncestryOfMain"`
Expected: PASS (3개)

- [ ] **Step 5: collect 본문에 ancestry 맵 수집**

`scripts/dashboard/collect.ts` `collect()` 함수에서, 체크박스 수집 루프(`:212-221`) **아래**, `// 보조 — 실패 격리`(`:223`) **위**에 추가:

```typescript
  // anchor 조상 판정: anchor가 있는 마일스톤만 (git I/O는 여기서만)
  const milestoneAncestry: Record<string, Ancestry> = {}
  for (const m of state.milestones) {
    if (m.anchor) {
      milestoneAncestry[m.id] = anchorAncestryOfMain(m.anchor, root)
    }
  }
```

그리고 `collect()` 의 return 객체(`:229-238`)에 `milestoneAncestry` 추가 — `gitSha,` 줄 위:

```typescript
    milestoneAncestry,
```

- [ ] **Step 6: 전체 테스트 + 타입체크**

Run: `npx vitest run scripts/dashboard/collect.test.ts && npx tsc -p scripts/tsconfig.json --noEmit`
Expected: collect.test 전부 PASS. tsc는 aggregate.ts가 아직 `milestoneDrifts`를 안 채워 에러 가능 — collect.ts/types.ts 관련 에러만 없으면 통과로 본다.

- [ ] **Step 7: 커밋**

```bash
git add scripts/dashboard/collect.ts scripts/dashboard/collect.test.ts
git commit -m "feat: collect — anchor의 main 조상 판정 (SHA 검증·main 명시·실패격리)"
```

---

## Task 3: aggregate — 양방향 드리프트 감지 (핵심)

**Files:**
- Modify: `scripts/dashboard/aggregate.ts`
- Test: `scripts/dashboard/aggregate.test.ts`

**Interfaces:**
- Consumes: `Milestone`, `Ancestry`, `MilestoneDrift` (types.ts), `RawData.milestoneAncestry`
- Produces: `detectMilestoneDrift(milestones: Milestone[], ancestry: Record<string, Ancestry>): MilestoneDrift[]` (export), `DashboardModel.milestoneDrifts` 채움

- [ ] **Step 1: 실패하는 테스트 작성 (m3 버그 픽스처가 최우선)**

`scripts/dashboard/aggregate.test.ts` 상단 import에 `detectMilestoneDrift` 추가하고, 파일 끝에 describe 추가:

```typescript
describe('detectMilestoneDrift — 양방향 state↔git 대조', () => {
  const ms = (over: Partial<Milestone>): Milestone => ({
    id: 'm', title: 't', state: 'todo', ...over,
  })

  it('출시됐는데 done 아님 → shipped-not-done (이 작업을 촉발한 m3 버그)', () => {
    // anchor가 main에 있는데(yes) state는 in_progress
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm3', title: '살아있는 대시보드', state: 'in_progress', anchor: 'a95fbaf' })],
      { m3: 'yes' },
    )
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('shipped-not-done')
    expect(drifts[0].id).toBe('m3')
  })

  it('done인데 main에 없음 → done-not-shipped (거짓 done)', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm9', state: 'done', anchor: 'beef123' })],
      { m9: 'no' },
    )
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('done-not-shipped')
  })

  it('done인데 anchor 필드 없음 → done-without-anchor', () => {
    const drifts = detectMilestoneDrift([ms({ id: 'm9', state: 'done' })], {})
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('done-without-anchor')
  })

  it('정상 done (anchor main에 있음) → 드리프트 0', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm1', state: 'done', anchor: 'a025d6d' })],
      { m1: 'yes' },
    )
    expect(drifts).toHaveLength(0)
  })

  it('parked/todo + anchor 없음 → 드리프트 0 (면제)', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm2', state: 'parked' }), ms({ id: 'm4', state: 'todo' })],
      {},
    )
    expect(drifts).toHaveLength(0)
  })

  it('anchor가 absent(커밋 오타·유실) → anchor-missing', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm9', state: 'in_progress', anchor: 'deadbee' })],
      { m9: 'absent' },
    )
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('anchor-missing')
  })

  it('anchor가 unknown(환경 조회 실패) → 침묵 (드리프트 0)', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm9', state: 'done', anchor: 'a95fbaf' })],
      { m9: 'unknown' },
    )
    expect(drifts).toHaveLength(0)
  })
})
```

`scripts/dashboard/aggregate.test.ts` 의 import에 `Milestone` 타입이 없으면 추가(`import type { Milestone } from './types'`).

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run scripts/dashboard/aggregate.test.ts -t "detectMilestoneDrift"`
Expected: FAIL — `detectMilestoneDrift is not a function`

- [ ] **Step 3: detectMilestoneDrift 구현**

`scripts/dashboard/aggregate.ts` 의 `kbDynamicHelp` 함수(`:28-37`) **아래**에 추가:

```typescript
// 순수 함수. anchor의 main 조상여부(ancestry)와 state를 양방향 대조.
// anchor가 done에 묶이지 않음 — "출시 증거 커밋"이라 state와 독립이어야
// 'shipped-not-done'(출시됐는데 done 아님 = m3 버그)을 잡는다.
export function detectMilestoneDrift(
  milestones: Milestone[],
  ancestry: Record<string, Ancestry>,
): MilestoneDrift[] {
  const drifts: MilestoneDrift[] = []
  for (const m of milestones) {
    const anc = ancestry[m.id] // anchor 없으면 undefined

    if (m.state === 'done' && !m.anchor) {
      drifts.push({
        id: m.id, title: m.title, kind: 'done-without-anchor',
        detail: `state=done인데 anchor 미연결 — 출시 증거 커밋을 달아야 한다`,
      })
      continue
    }
    if (!m.anchor) continue // anchor 없는 비-done(parked/todo/in_progress)은 면제

    if (anc === 'absent') {
      drifts.push({
        id: m.id, title: m.title, kind: 'anchor-missing',
        detail: `anchor ${m.anchor}가 git에 없음 — 오타·유실 의심`,
      })
    } else if (anc === 'yes' && m.state !== 'done') {
      drifts.push({
        id: m.id, title: m.title, kind: 'shipped-not-done',
        detail: `anchor ${m.anchor}가 main에 있으나 state=${m.state} — 출시됐는데 done 아님`,
      })
    } else if (anc === 'no' && m.state === 'done') {
      drifts.push({
        id: m.id, title: m.title, kind: 'done-not-shipped',
        detail: `state=done인데 anchor ${m.anchor}가 main에 없음 — 거짓 done`,
      })
    }
    // anc === 'unknown' (환경 조회 실패) → 침묵
  }
  return drifts
}
```

`scripts/dashboard/aggregate.ts:1-11` 의 import 블록에 `Ancestry`, `MilestoneDrift` 추가 (`Milestone`은 이미 있음):

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
  Ancestry,
  MilestoneDrift,
} from './types'
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run scripts/dashboard/aggregate.test.ts -t "detectMilestoneDrift"`
Expected: PASS (7개 — 특히 첫 번째 `shipped-not-done`이 핵심)

- [ ] **Step 5: aggregate()가 model에 drifts 주입**

`scripts/dashboard/aggregate.ts` 의 `aggregate()` return 객체(`:107-128`)에서 `milestones: buildMilestones(raw),` 줄 **아래**에 추가:

```typescript
    milestoneDrifts: detectMilestoneDrift(raw.state.milestones, raw.milestoneAncestry),
```

- [ ] **Step 6: 전체 테스트 + 타입체크**

Run: `npx vitest run scripts/dashboard/aggregate.test.ts && npx tsc -p scripts/tsconfig.json --noEmit`
Expected: aggregate.test 전부 PASS. tsc는 render.ts가 아직 `milestoneDrifts`를 안 써도 통과(읽기만 추가됨). render 관련 에러 없으면 통과.

- [ ] **Step 7: 커밋**

```bash
git add scripts/dashboard/aggregate.ts scripts/dashboard/aggregate.test.ts
git commit -m "feat: aggregate — 양방향 마일스톤 드리프트 감지 (shipped-not-done 포함)"
```

---

## Task 4: render — 드리프트 경고 박스 + parked 라벨

**Files:**
- Modify: `scripts/dashboard/render.ts` (renderMilestones state 라벨, 드리프트 경고 함수, 마일스톤 섹션 삽입)
- Test: `scripts/dashboard/render.test.ts`

**Interfaces:**
- Consumes: `DashboardModel.milestoneDrifts`, `MilestoneView.state`(parked 포함)
- Produces: HTML 문자열에 드리프트 경고(`drift-warn` 클래스) + parked 배지("보류")

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/dashboard/render.test.ts` 의 `describe('render — HTML 무결성', ...)` 블록 안에 추가:

```typescript
  it('드리프트 있으면 경고 박스 렌더 (항상 보임)', () => {
    const drifted: DashboardModel = {
      ...model,
      milestoneDrifts: [
        { id: 'm3', title: '살아있는 대시보드', kind: 'shipped-not-done',
          detail: 'anchor a95fbaf가 main에 있으나 state=in_progress — 출시됐는데 done 아님' },
      ],
    }
    const html = renderDashboard(drifted)
    expect(html).toContain('class="drift-warn"')
    expect(html).toContain('출시됐는데 done 아님')
    expect(html).toContain('살아있는 대시보드')
  })

  it('드리프트 0이면 경고 박스 안 그림 (노이즈 0)', () => {
    const html = renderDashboard({ ...model, milestoneDrifts: [] })
    expect(html).not.toContain('class="drift-warn"')
  })

  it('parked 마일스톤은 "보류" 라벨', () => {
    const parked: DashboardModel = {
      ...model,
      milestones: [{ title: 'KB 자동검증', state: 'parked', pct: 0, detail: '' }],
    }
    const html = renderDashboard(parked)
    expect(html).toContain('보류')
  })
```

(`renderDashboard`/`model`은 기존 테스트가 쓰는 이름. 파일 상단에서 이미 import·구성돼 있으면 그대로 사용. `DashboardModel` 타입 import가 없으면 추가.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run scripts/dashboard/render.test.ts -t "드리프트"`
Expected: FAIL — `class="drift-warn"` 미포함

- [ ] **Step 3: parked 라벨 처리**

`scripts/dashboard/render.ts:52` 의 stateLabel 삼항을 교체:

```typescript
      const stateLabel =
        m.state === 'done' ? '완료'
        : m.state === 'in_progress' ? '진행 중'
        : m.state === 'parked' ? '보류'
        : '예정'
```

- [ ] **Step 4: 드리프트 경고 렌더 함수 추가**

`scripts/dashboard/render.ts` 의 `renderMilestones` 함수(`:49-60`) **위**에 추가:

```typescript
function renderMilestoneDrifts(model: DashboardModel): string {
  if (model.milestoneDrifts.length === 0) return '' // 노이즈 0
  const items = model.milestoneDrifts
    .map(
      (d) =>
        `<div class="drift-item"><b>⚠ ${escapeHtml(d.title)}</b> — ${escapeHtml(d.detail)}</div>`,
    )
    .join('\n')
  return `<div class="drift-warn"><b>마일스톤 상태 드리프트 감지</b>
    <div class="drift-sub">project-state.json의 state가 git 현실과 어긋남 — 메타파일을 수정하라.</div>
    ${items}</div>`
}
```

- [ ] **Step 5: 마일스톤 섹션에 경고 삽입 + CSS**

`scripts/dashboard/render.ts:390-391` 의 마일스톤 col-title 직후에 경고 삽입. `${renderMilestones(model)}` 줄 **위**에 `${renderMilestoneDrifts(model)}` 추가:

```typescript
      <div class="col-title">마일스톤 ${helpToggle('milestones', model.help['milestones'])}</div>
      ${renderMilestoneDrifts(model)}
      ${renderMilestones(model)}
```

그리고 `.warn-box` CSS 정의(`:324-326`) **아래**에 추가:

```typescript
  .drift-warn { margin: 10px 0 14px; background: var(--danger-bg); border: 1px solid var(--danger);
    border-radius: 8px; padding: 12px 14px; font-size: 13px; }
  .drift-warn > b { color: var(--danger); }
  .drift-sub { color: var(--muted); margin: 4px 0 8px; font-size: 12px; }
  .drift-item { margin-top: 6px; }
```

(변수 실재 확인 완료 — `:root`(render.ts:160-174)에 `--danger`/`--danger-bg`/`--muted` 모두 정의됨. `--mono`도 있음.)

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run scripts/dashboard/render.test.ts`
Expected: 신규 3개 포함 전부 PASS

- [ ] **Step 7: 전체 테스트 + 타입체크**

Run: `npm test && npx tsc -p scripts/tsconfig.json --noEmit`
Expected: 전체 PASS (기존 64 + 신규분), tsc 0 에러

- [ ] **Step 8: 커밋**

```bash
git add scripts/dashboard/render.ts scripts/dashboard/render.test.ts
git commit -m "feat: render — 마일스톤 드리프트 경고 박스 + parked 라벨"
```

---

## Task 5: project-state.json 수정 + 대시보드 재생성 + 육안 검증

**Files:**
- Modify: `project-state.json` (milestones)
- Regenerate: `dashboard.html`
- Test: 없음 (육안 + 드리프트 0 확인이 검증)

**Interfaces:**
- Consumes: Task 1~4의 anchor·드리프트 감지 전부

- [ ] **Step 1: milestones 수정**

`project-state.json` 의 `milestones` 배열(`:8-31`)을 교체:

```json
  "milestones": [
    {
      "id": "m1",
      "title": "앵커 KB 체커 MVP",
      "state": "done",
      "anchor": "a025d6d"
    },
    {
      "id": "m2",
      "title": "KB 자동 검증 파이프라인",
      "state": "parked"
    },
    {
      "id": "m3",
      "title": "살아있는 대시보드",
      "state": "done",
      "anchor": "a95fbaf"
    },
    {
      "id": "m4",
      "title": "약사 인터뷰 5~10명 수요 검증",
      "state": "todo"
    }
  ],
```

(m2의 `planFile` 제거 — main에 없는 파일 참조. m1/m3에 anchor 부여. 한글은 리터럴 UTF-8.)

- [ ] **Step 2: 대시보드 재생성**

Run: `npm run dashboard`
Expected: `✅ dashboard.html 생성됨 (KB 5/10, 마일스톤 4개)` 출력. **드리프트 경고 없이 정상 생성.**

- [ ] **Step 3: 드리프트 0 확인 (수정이 실제로 통했는지)**

Run: `grep -c 'class="drift-warn"' dashboard.html`
Expected: `0` (m3=done·m2=parked로 고쳐 드리프트가 사라졌어야 함). **만약 1이면** 경고 내용을 읽어 어떤 마일스톤이 여전히 어긋나는지 진단 → project-state.json 재수정.

- [ ] **Step 4: 핵심 변경 반영 확인**

Run: `grep -c '2/42' dashboard.html && grep -c '보류' dashboard.html`
Expected: 첫째 `0` (m3가 done이 되어 "2/42 태스크" 사라짐), 둘째 `1` 이상 (m2 "보류" 배지).

- [ ] **Step 5: 육안 검증 (브라우저)**

`file:///home/gon/projects/gon/gons-health/dashboard.html` 을 브라우저(chrome-devtools)로 열어 전체 스크린샷:
- 마일스톤: m1 완료 / m2 보류 / m3 **완료**(2/42 사라짐) / m4 예정
- 드리프트 경고 박스 **없음**(정상)
- 기존 항상-보이는 요소(3중 게이트·dist 경고·범위 제약) 전부 정상

- [ ] **Step 6: 커밋**

```bash
git add project-state.json dashboard.html
git commit -m "fix: 마일스톤 드리프트 해소 (m3=done·m2=parked, anchor 부여)"
```

---

## Self-Review (작성자 체크)

**1. Spec coverage:**
- §2 양방향 검사 → Task 3 (shipped-not-done 첫 테스트). ✓
- §2.3 드리프트 4종 → Task 3 Step 1 테스트 4종 전부. ✓
- §2.4 잔여 한계(unknown 침묵) → Task 3 "unknown → 드리프트 0" 테스트. ✓
- §3.1 project-state.json 수정 → Task 5. ✓
- §3.2 타입 → Task 1. ✓
- §4 collect(SHA 검증·main 명시·absent/unknown 구분) → Task 2. ✓
- §5 aggregate 순수 → Task 3 (ancestry 맵 주입받음, git 호출 없음). ✓
- §6 render(경고·parked·노이즈0) → Task 4. ✓
- §7 테스트 8항목 → Task 2(인젝션·yes·absent) + Task 3(드리프트 7종) + Task 4(렌더 3). ✓

**2. Placeholder scan:** TBD/TODO 없음. 모든 코드 스텝에 실제 코드 포함. ✓

**3. Type consistency:** `anchorAncestryOfMain(sha, root)` 2인자로 Task 2 정의·Task 2 호출 일치. `detectMilestoneDrift(milestones, ancestry)` Task 3 정의·호출 일치. `Ancestry` 4값(`yes/no/absent/unknown`) collect 산출↔aggregate 소비 일치. `MilestoneState`에 parked 추가가 Milestone/MilestoneView 양쪽 반영. ✓

**주의 사항 (실행자에게):**
- Task 4 Step 5 CSS 변수는 실재 확인됨(render.ts:160-174: `--danger`/`--danger-bg`/`--muted`/`--mono`). 그대로 사용.
- Task 1 Step 5 / Task 2 Step 6의 tsc는 "다음 Task가 채울 필드 누락" 에러가 정상 — 해당 파일 자체 문법 에러만 본다.
