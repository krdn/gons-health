# 설계: 마일스톤 드리프트 해소 + 재발 자동감지

작성일: 2026-06-27
대상 마일스톤: m3(살아있는 대시보드)의 후속 — 대시보드 신뢰도 보강
관련: `docs/superpowers/specs/2026-06-22-living-dashboard-design.md`(대시보드 아키텍처)

---

## 0. TL;DR

`project-state.json`의 마일스톤 `state`(의도)가 git 현실(브랜치 병합 여부)과 어긋난다.
이 드리프트는 2026-06-23 세션에서 한 번 고친 의도 드리프트(rank-1 stale)와 같은 클래스로,
4일 만에 마일스톤 계층에서 재발했다.

- **즉시 수정:** m3 `in_progress`→`done`, m2 `in_progress`→`parked`, m2 planFile 댕글링 참조 제거.
- **재발 자동감지(A안):** 각 마일스톤에 출시 증거 커밋 `anchor`를 달고, 대시보드가
  `anchor`의 main 조상 여부와 `state`를 **양방향** 대조해 불일치를 항상-보이는 경고로 띄운다.
- 런타임 LLM/외부 API 0 불변식 유지. 대시보드 4계층(collect→aggregate→render) 안에 얹는다.

---

## 1. 문제 (git으로 검증된 사실)

`project-state.json`과 git 현실의 대조 (2026-06-27 확인):

| 마일스톤 | project-state.json | git 현실 | 진단 |
|---|---|---|---|
| m1 앵커 KB 체커 MVP | `done` | 핵심 커밋 `a025d6d` main에 있음 | 정상 (단 증거 연결 없음) |
| m2 KB 자동검증 | `in_progress` + planFile 참조 | **main 미병합**, 두 브랜치(`feat/kb-auto-verification` 7bf3f0e, `kb-auto-verify-isolated` 2656897)에 파편화. plan도 브랜치에만 존재 | **거짓 in_progress + 댕글링 planFile** |
| m3 살아있는 대시보드 | `in_progress`, 대시보드 "2/42 태스크" | **main 머지 완료**(`a95fbaf`, SDD 8/8) | **거짓 in_progress (출시됐는데 미완 표시)** |
| m4 약사 인터뷰 | `todo` | 미착수 | 정상 |

**근본 원인:** 마일스톤 `state`는 순수 의도로 취급돼 git 현실과 대조되지 않는다. KB 카운트·테스트 수는
자동 집계되는데, 똑같이 검증 가능한 "마일스톤이 main에 실재하는가"는 의도로 분류돼 있다.
→ **검증 가능한 사실인데 의도로 분류된 필드**가 드리프트의 원천.

**"2/42 태스크"의 출처:** 대시보드는 진행 중 마일스톤의 plan 체크박스를 세부 진행으로 보조 표시한다.
living-dashboard plan은 실제 `[x]` 2개 / `[ ]` 42개다(SDD는 8/8 완료지만 plan 체크박스는 실행 후 갱신
안 됨 — 프로젝트 help가 "plan 체크박스는 1차 소스 아님"이라 이미 인정). m3가 `done`이면 이 보조표시
자체가 사라진다.

---

## 2. 핵심 설계 결정 — anchor를 `done`에서 분리 (양방향 검사)

### 2.1 왜 양방향인가 (이 작업을 촉발한 버그 자체를 잡으려면)

순진한 설계는 "state=done인데 anchor가 main에 없음"(거짓 done, **lying up**)만 잡는다.
그러나 **실제 발생한 버그는 반대 방향**이다 — m3는 main에 있는데 `in_progress`로 표시(**lying down**).
anchor를 "done일 때만 필수"로 묶으면 m3는 done이 아니라 anchor가 없고 → 아무것도 안 울린다.
**그 설계는 자신이 동기로 삼은 버그를 못 잡는다.**

→ `anchor` 의미를 **"이 마일스톤이 출시됐음을 증명하는 커밋"**으로 재정의하고, state와 독립적으로
   둔 뒤 **양방향** 대조한다.

### 2.2 anchor 부여 규칙

- `anchor`는 단축 해시 문자열 1개. "이 마일스톤의 작업이 main에 들어갔다면 존재할 커밋"(보통 머지 커밋).
- **출시됐거나/출시 예정인 마일스톤에 단다.** done은 물론, "출시됐는지 검사하고 싶은" 마일스톤이면 단다.
- `parked`/`todo`처럼 아직 main에 없는 게 정상인 마일스톤은 anchor 없음(면제).

### 2.3 드리프트 4종

`anchor`의 main 조상 여부(`yes`/`no`/`unknown`)와 `state`를 대조:

| kind | 조건 | 의미 |
|---|---|---|
| `shipped-not-done` | anchor가 main에 있음(`yes`) AND `state !== 'done'` | **출시됐는데 done 아님 — m3 케이스** |
| `done-not-shipped` | `state === 'done'` AND anchor가 main에 없음(`no`) | 거짓 done |
| `done-without-anchor` | `state === 'done'` AND anchor 필드 없음 | done인데 증거 미연결(작성 실수) |
| `anchor-missing` | anchor 해시가 git에 아예 없음(`absent`) | 오타/유실 |

`unknown`(git 조회 실패 — shallow clone, main ref 부재 등)에서 온 경우는 드리프트로 단정하지 않는다(§4 참조).
`absent`(커밋이 git에 실제로 없음)와는 구분된다.

### 2.4 잔여 한계 (정직하게 명시)

**병합 후 아무도 project-state.json을 안 건드린 경우** — 정확히 m3 원본 시나리오(anchor 미부여 +
state 그대로) — 는 **검사할 anchor가 없으므로 어느 방향도 안 울린다.** 이 케이스까지 잡으려면
수동 anchor가 아니라 **git에서 완료를 역도출**해야 하는데(파일 경로↔마일스톤 매핑 등) 훨씬 무겁고
오탐이 많다 → **이번 범위 밖.**

이 설계가 막는 것: "anchor를 단 마일스톤"의 state↔git 불일치. once anchor가 붙으면 그 마일스톤은
영구히 양방향 감시된다. 막지 못하는 것: anchor를 **아직 안 단** 신규 마일스톤의 최초 드리프트.
→ 절차 보완: 마일스톤을 done으로 올릴 때 anchor를 함께 단다(`done-without-anchor`가 이걸 강제).

---

## 3. 데이터 모델 변경

### 3.1 `project-state.json` — 즉시 수정 + anchor 부여

| 마일스톤 | state | anchor | planFile |
|---|---|---|---|
| m1 | `done` (유지) | `a025d6d` (신규) | — |
| m2 | `in_progress`→**`parked`** | 없음 | **제거** (main에 없는 파일 참조) |
| m3 | `in_progress`→**`done`** | `a95fbaf` (신규) | (유지 — main에 있음) |
| m4 | `todo` (유지) | 없음 | — |

anchor 커밋은 git에서 검증함:
- `a025d6d` = "결정론적 lookup + cite-or-abstain 핵심 안전 함수" — m1의 본질, main 조상 확인.
- `a95fbaf` = "merge: 살아있는 대시보드" — m3 머지, main 조상 확인.

### 3.2 `scripts/dashboard/types.ts`

```typescript
export type MilestoneState = 'done' | 'in_progress' | 'parked' | 'todo'  // 'parked' 추가

export interface Milestone {
  id: string
  title: string
  state: MilestoneState
  planFile?: string
  anchor?: string          // 신규: 출시 증거 커밋(단축 해시)
}

// aggregate 산출, render가 경고로 표시
export interface MilestoneDrift {
  id: string
  title: string
  kind: 'shipped-not-done' | 'done-not-shipped' | 'done-without-anchor' | 'anchor-missing'
  detail: string           // 사람이 읽을 한 줄 (사실만, 가치판단 없음)
}
```

`'parked'` 라벨은 render의 상태 배지 매핑에도 추가한다(예: "보류").

---

## 4. 수집 계층 (`scripts/dashboard/collect.ts`)

collect는 이미 git을 읽는다(최근 커밋·생성 해시). anchor의 main 조상 여부를 판정하는 헬퍼를 추가.

```typescript
const SHA_RE = /^[0-9a-f]{7,40}$/   // 인젝션 방어: project-state.json은 사람 편집

// 4값: aggregate가 "커밋 자체가 없음(오타)"과 "조회 실패(환경)"를 구분할 수 있어야
// anchor-missing(드리프트)과 unknown(침묵)을 가른다. 3값(unknown 단일)이면 둘이 뭉개진다.
type Ancestry = 'yes' | 'no' | 'absent' | 'unknown'
//   yes = main 조상 / no = 커밋은 있으나 조상 아님 / absent = 커밋이 git에 없음(오타·유실) / unknown = 조회 실패

// anchor가 main의 조상인가. HEAD가 아니라 'main' 명시 — 대시보드는 feature 브랜치에서도
// 재생성되므로 checked-out 브랜치에 판정이 휘둘리면 안 된다.
function anchorAncestryOfMain(sha: string): Ancestry {
  if (!SHA_RE.test(sha)) return 'absent'           // 형식 위반 → 유효 해시 아님 = absent
  try {
    execSync(`git merge-base --is-ancestor ${sha} main`, { stdio: 'ignore' })
    return 'yes'                                    // exit 0 = 조상
  } catch {
    if (!commitExists(sha)) return 'absent'         // 커밋 부재(오타·유실)
    if (!mainRefExists()) return 'unknown'          // main ref 자체 부재 = 환경 문제
    return 'no'                                     // 커밋 있고 main 있는데 조상 아님
  }
}
```

- collect는 마일스톤별 `{ id, ancestry }` 맵을 만들어 model에 실어 aggregate로 넘긴다.
  (조상 판정 = git I/O는 collect에만, aggregate는 순수 유지.)
- **보조 실패 격리:** git 조회 자체가 환경 문제로 깨져도(`main` ref 부재 등) 대시보드 생성은 안 막힌다.
  해당 마일스톤은 `unknown` → §5에서 드리프트로 단정하지 않는다. `absent`(커밋 오타·유실)는
  `unknown`(환경 조회 실패)과 구분돼 전자만 `anchor-missing` 드리프트가 된다.
  collect의 기존 "메타 fail-loud / 보조 실패 격리" 패턴과 일치.
- **`main` vs `origin/main`:** 로컬 `main` 사용(푸시는 수동이라 로컬 main이 권위본). origin 비교는 fetch
  의존성을 끌어들여 결정론을 깬다.

---

## 5. 집계 계층 (`scripts/dashboard/aggregate.ts`)

순수 함수. collect가 만든 ancestry 맵 + 마일스톤 목록 → `MilestoneDrift[]`.

```typescript
export function detectMilestoneDrift(
  milestones: Milestone[],
  ancestry: Record<string, Ancestry>,   // id → anchor 조상여부 (anchor 없으면 키 없음)
): MilestoneDrift[]
```

판정 로직 (§2.3 표 그대로, 순수·결정론적):
- `state==='done'` & anchor 없음 → `done-without-anchor`
- anchor 있고 `ancestry==='yes'` & `state!=='done'` → `shipped-not-done`
- anchor 있고 `ancestry==='no'` & `state==='done'` → `done-not-shipped`
- anchor 있고 `ancestry==='absent'` → `anchor-missing` (커밋이 git에 실제로 없음 = 오타·유실)
- anchor 있고 `ancestry==='unknown'` → **침묵**(환경 조회 실패를 드리프트로 단정하지 않음)
- 그 외 → 드리프트 아님

`detail`은 사실만: 예) `"anchor a95fbaf가 main에 있으나 state=in_progress (출시됐는데 done 아님)"`.
가치판단·해석은 넣지 않는다(직전 kbDynamicHelp 가치판단 제거와 같은 원칙).

model에 `milestoneDrifts: MilestoneDrift[]` 필드 추가.

---

## 6. 렌더 계층 (`scripts/dashboard/render.ts`)

- 드리프트가 **있으면** 마일스톤 섹션 상단에 **항상-보이는 경고 박스**(기존 `artifactWarning`과 동일한
  빨강 스타일) 렌더. 각 드리프트 한 줄씩.
- 드리프트 **0이면 아무것도 안 그림**(정상 케이스에 노이즈 0).
- `'parked'` 상태 배지 라벨 추가("보류").
- escapeHtml 통과(기존 불변식).

---

## 7. 테스트 (TDD — 감지 로직 먼저 RED)

가장 먼저 쓸 테스트(이게 통과 어려우면 설계 결함을 출시 전 발견):

1. **m3-shaped 픽스처** — anchor가 main에 있음(`ancestry: 'yes'`) + `state: 'in_progress'`
   → `shipped-not-done` 1건. **(이 작업을 촉발한 바로 그 버그)**
2. 거짓 done — `state: 'done'` + `ancestry: 'no'` → `done-not-shipped`.
3. done인데 anchor 없음 → `done-without-anchor`.
4. 정상 done — `state: 'done'` + `ancestry: 'yes'` → 드리프트 0.
5. parked/todo + anchor 없음 → 드리프트 0(면제 확인).
6. `ancestry: 'absent'`(커밋 오타·유실) → `anchor-missing` 1건.
7. `ancestry: 'unknown'`(환경 조회 실패) → 드리프트 0(침묵 — 6과 구분되는지 확인).
8. collect: `SHA_RE` 위반 입력(`"a95fbaf; rm -rf"`) → `absent`, execSync 미실행(인젝션 방어).

기존 64 테스트 + 위 추가분 전부 GREEN. 대시보드 재생성 후 육안: m3=done(2/42 사라짐),
m2=보류 배지, 드리프트 경고 0건(수정 후 정상).

---

## 8. 비범위 (YAGNI)

- git에서 완료를 역도출하는 자동 완료 판정(§2.4 잔여 한계) — 무겁고 오탐, 범위 밖.
- m2 브랜치 파편화 정리(P2) — 별개 작업. 이번엔 state=parked 표기까지만.
- 테스트 fail-loud(CI에서 드리프트 시 빌드 실패, B안) — anchor 토대가 깔리면 후속으로 작은 추가.
- harness 입력 강화(rank-2) — gons-health 코드 아님(대상=harness 팀), in-repo 완화책 이미 존재.

---

## 9. 영향받는 파일 요약

| 파일 | 변경 |
|---|---|
| `project-state.json` | m2/m3 state 정정, m1/m3 anchor 추가, m2 planFile 제거 |
| `scripts/dashboard/types.ts` | `MilestoneState`에 parked, `Milestone.anchor?`, `MilestoneDrift` 신설 |
| `scripts/dashboard/collect.ts` | `anchorAncestryOfMain` + SHA 검증 + ancestry 맵 수집 |
| `scripts/dashboard/aggregate.ts` | `detectMilestoneDrift` 순수 함수 + model 필드 |
| `scripts/dashboard/render.ts` | 드리프트 경고 박스 + parked 배지 |
| 각 `*.test.ts` | §7 테스트 |
| `dashboard.html` | 재생성(소스↔산출물 정렬) |
