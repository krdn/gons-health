# KB 자동 검증 파이프라인 통합 (m2 완료) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) — 사용자가 이 세션 직접 실행을 선택. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** stale 격리된 `kb-auto-verify-isolated` 브랜치(4라운드 리뷰된 KB 자동 검증 파이프라인)를 현 main에 무손실 통합하고 m2 마일스톤을 `done`으로 완료한다.

**Architecture:** 신규 구현이 아니라 통합. `git merge`로 검증된 10커밋 히스토리를 보존하며 합치고, 양성 충돌 3개(`.gitignore`·`package.json` 합집합, `dist` 재빌드)를 해소한 뒤, 빌드·테스트로 무결성을 확인하고 완료 처리(project-state + 대시보드)한다.

**Tech Stack:** git, TypeScript, Node 20+, Vitest, tsup, tsx. 외부 의존성 추가 없음(파이프라인은 무료 PubMed E-utilities, 런타임 코어는 LLM/API 0 유지).

## Global Constraints

- **런타임 순수성:** `src/lib/lookup.ts`, `src/lib/validateKb.ts`, `src/index.ts`에 네트워크·LLM 호출 절대 추가 금지. 파이프라인 코드는 `scripts/`에만.
- **금본위 보존:** `lookup()`의 `e.verified === true` 필터 변경 금지. `verified`는 약사 사인오프 전용.
- **분리 티어:** 자동 검증 결과는 `auto_verified`/`auto_review`에만. `auto_verified===true`가 `verified`로 자동 승격되지 않음.
- **완료 범위 = 도구 통합까지:** PENDING 5개(herbal)의 실제 PubMed 검증·승격은 범위 밖. KB verified 5/PENDING 5 분포는 통합 후에도 불변.
- **KB/타입 변경 시 dist 재빌드:** `npm run build`(tsup → `dist/`) 후 `dist/`를 함께 커밋.
- **대시보드 무손실:** `scripts/dashboard/*`, `dashboard.html`은 머지로 삭제되면 안 됨(실측상 충돌 없음).
- **한국어 주석/응답, 영어 식별자.**

---

## File Structure (통합 후 추가/변경되는 것)

| 파일 | 책임 | 출처 |
|------|------|------|
| `scripts/pubmed.ts` | PubMed E-utilities 래퍼 (esearch/efetch) | isolated 신규 |
| `scripts/pubmed.test.ts` | esearch 파싱 단위 테스트 | isolated 신규 |
| `scripts/verifyKb.ts` | 수집 오케스트레이터 → verify-queue.json | isolated 신규 |
| `scripts/applyVerdict.ts` | 판정 머지 (auto_verified 기록) | isolated 신규 |
| `scripts/applyVerdict.test.ts` | mergeVerdict 단위 테스트 | isolated 신규 |
| `scripts/promoteQueue.ts` | 약사 승격 CLI (verified 승격) | isolated 신규 |
| `scripts/promoteQueue.test.ts` | listPromotable/promote 단위 테스트 | isolated 신규 |
| `src/types.ts` | `AutoReview` 타입 + 옵셔널 필드 | isolated 수정 |
| `src/lib/validateKb.ts` | auto_verified/auto_review 조건부 검증 | isolated 수정 |
| `src/data/interactions.json` | supplement_en 보강 (자동 병합) | 양쪽 병합 |
| `.gitignore` | verify-queue.json/verdicts.json 무시 (합집합) | 충돌 해소 |
| `package.json` | verify:kb/apply/promote 스크립트 (합집합) | 충돌 해소 |
| `project-state.json` | m2 done + anchor | Task 4 |
| `dashboard.html` | 재생성 | Task 4 |

---

### Task 1: 작업 브랜치 분기 + 머지 충돌 해소

**Files:**
- Modify: `.gitignore`, `package.json` (충돌 해소)

**Interfaces:**
- Produces: 충돌 해소된 머지 상태(아직 커밋 전). `.gitignore`에 dashboard+verify 항목 모두, `package.json`에 dashboard+verify 스크립트 모두.

- [ ] **Step 1: main 최신 확인 후 작업 브랜치 분기**

```bash
cd /home/gon/projects/gon/gons-health
git status --short        # 작업트리 untracked(docs/research, graphify-out)만 있어야 함
git checkout -b feat/kb-auto-verification-integration main
```

Expected: `Switched to a new branch 'feat/kb-auto-verification-integration'`

- [ ] **Step 2: 머지 시도 (충돌 발생 예상)**

```bash
git merge --no-ff kb-auto-verify-isolated -m "merge: KB 자동 검증 파이프라인 통합 (m2)"
```

Expected: `.gitignore`·`package.json`·`dist/index.js.map` 충돌 보고, exit 1. `git status`로 충돌 파일 3개 확인.

- [ ] **Step 3: `.gitignore` 합집합 해소**

충돌 마커를 제거하고 양쪽 항목을 모두 남긴다. 최종 `.gitignore` 꼬리 부분은:

```
*.tsbuildinfo
vite.config.d.ts
vite.config.js
.dashboard-test-report.json

# KB 검증 파이프라인 중간 산출물
scripts/verify-queue.json
scripts/verdicts.json
```

- [ ] **Step 4: `package.json` 합집합 해소**

`scripts` 블록에 dashboard 계열과 verify 계열을 모두 남긴다(중복 키 금지). 충돌 마커 제거 후 `scripts`에 다음이 모두 존재해야 한다:

```json
    "dashboard": "tsx scripts/dashboard.ts",
    "typecheck:scripts": "tsc -p scripts/tsconfig.json --noEmit",
    "verify:kb": "tsx scripts/verifyKb.ts",
    "verify:apply": "tsx scripts/applyVerdict.ts",
    "verify:promote": "tsx scripts/promoteQueue.ts",
```

`devDependencies`의 `tsx`·`@types/node`는 양쪽 동일하므로 한 벌만 남긴다. `prepack`은 `"prepack": "pnpm build"` 유지.

- [ ] **Step 5: `dist/index.js.map` 충돌은 재빌드로 해소 (Task 3에서) — 일단 한쪽 선택**

```bash
git checkout --theirs dist/index.js.map && git add dist/index.js.map
```

(Task 3의 `npm run build`가 올바른 map으로 덮어쓴다. 지금은 머지 진행을 위한 임시 선택.)

- [ ] **Step 6: JSON 유효성 즉시 검증 (충돌 마커 잔존 시 fail-loud)**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json OK')"
node -e "JSON.parse(require('fs').readFileSync('src/data/interactions.json','utf8')); console.log('interactions.json OK')"
```

Expected: 둘 다 `OK`. SyntaxError가 나면 충돌 마커(`<<<<<<<`)가 남은 것 — 제거.

- [ ] **Step 7: 충돌 파일 stage**

```bash
git add .gitignore package.json
git status --short    # 모든 파일이 stage(M/A)되고 UU(unmerged) 없어야 함
```

Expected: `UU`(unmerged) 항목 0.

---

### Task 2: 무손실 검증 (대시보드·파이프라인 파일 존재 확인)

**Files:** 없음 (검증만).

**Interfaces:**
- Consumes: Task 1의 머지 상태.
- Produces: 대시보드 코드와 파이프라인 코드가 모두 존재함을 확인한 사실.

- [ ] **Step 1: 대시보드 코드 무손실 확인**

```bash
ls scripts/dashboard/aggregate.ts scripts/dashboard/collect.ts scripts/dashboard/render.ts scripts/dashboard/types.ts dashboard.html
```

Expected: 5개 파일 모두 존재(No such file 에러 0).

- [ ] **Step 2: 파이프라인 코드 통합 확인**

```bash
ls scripts/pubmed.ts scripts/verifyKb.ts scripts/applyVerdict.ts scripts/promoteQueue.ts scripts/pubmed.test.ts scripts/applyVerdict.test.ts scripts/promoteQueue.test.ts
```

Expected: 7개 파일 모두 존재.

- [ ] **Step 3: 문서 무손실 확인**

```bash
ls docs/superpowers/plans/ docs/superpowers/specs/
```

Expected: milestone-drift 문서(2026-06-27-*)와 dashboard 문서(2026-06-22-living-dashboard*)가 plans/specs 양쪽에 모두 존재 + isolated의 kb-auto-verification plan 추가.

- [ ] **Step 4: KB 분포 불변 확인 (verified 5 / PENDING 5)**

```bash
node -e "const e=require('./src/data/interactions.json'); console.log('total',e.length,'verified',e.filter(x=>x.verified===true).length,'pending',e.filter(x=>x.source&&x.source.id==='PENDING').length);"
```

Expected: `total 10 verified 5 pending 5` (통합 범위는 도구까지 — 검증 실행 안 했으므로 분포 불변).

- [ ] **Step 5: supplement_en 자동 병합 확인**

```bash
node -e "const e=require('./src/data/interactions.json'); const w=e.filter(x=>x.supplement_en).length; console.log('supplement_en 보유 엔트리:', w);"
```

Expected: 1 이상(isolated가 PENDING 엔트리에 영문 검색어를 추가했으므로). 0이면 자동 병합이 supplement_en을 누락한 것 — `git show kb-auto-verify-isolated:src/data/interactions.json`와 대조해 보강.

---

### Task 3: 빌드·테스트 게이트 + 머지 커밋

**Files:**
- Modify: `dist/index.js`, `dist/index.js.map` (재빌드)

**Interfaces:**
- Consumes: Task 1·2의 검증된 머지 상태.
- Produces: 빌드·테스트 통과 + dist 재빌드가 포함된 머지 커밋.

- [ ] **Step 1: dist 재빌드 (KB/타입 변경 반영)**

```bash
npm run build
```

Expected: tsup 빌드 성공, `dist/index.js` 갱신. (CLAUDE.md: dist는 git 커밋 대상.)

- [ ] **Step 2: 코어 타입체크**

```bash
npm run typecheck
```

Expected: 에러 0.

- [ ] **Step 3: 스크립트 타입체크**

```bash
npm run typecheck:scripts
```

Expected: 에러 0. (pubmed/verifyKb/applyVerdict/promoteQueue가 scripts/tsconfig.json 하에 컴파일.)

- [ ] **Step 4: 전체 테스트 (회귀 가드 포함)**

```bash
npm test
```

Expected: 전부 통과. 특히 `lookup`의 "auto_verified는 lookup 노출에 영향 없음" 회귀 테스트 GREEN, applyVerdict/promoteQueue 테스트 GREEN.

- [ ] **Step 5: verify 스크립트 도움말 동작 확인 (실제 검증 실행 아님)**

```bash
npm run verify:promote
```

Expected: 승격 후보 목록 또는 "승격 후보 없음 (auto_verified=true & verified=false 엔트리 0)" 출력. (PENDING 검증을 안 했으므로 후보 0이 정상 — 도구가 등록·동작함만 확인.)

- [ ] **Step 6: dist 재빌드분 stage + 머지 커밋 마무리**

```bash
git add dist/ src/data/interactions.json
git status --short
git commit --no-edit    # Step 2의 머지 메시지 사용 (충돌 해소로 머지가 멈춰 있었음)
git rev-parse --short HEAD   # 머지 커밋 해시 → Task 4 anchor로 사용
```

Expected: 머지 커밋 생성, 해시 기록.

---

### Task 4: m2 완료 처리 (project-state + 대시보드)

**Files:**
- Modify: `project-state.json`
- Modify: `dashboard.html` (재생성)

**Interfaces:**
- Consumes: Task 3의 머지 커밋 해시(anchor).
- Produces: m2 = `done` + anchor, 드리프트 경고 없는 대시보드.

- [ ] **Step 1: project-state.json m2 갱신**

`milestones`의 m2를 `parked` → `done`으로 바꾸고 Task 3 Step 6의 머지 커밋 단축 해시를 anchor로 단다:

```json
    {
      "id": "m2",
      "title": "KB 자동 검증 파이프라인",
      "state": "done",
      "anchor": "<Task3-Step6-머지커밋-단축해시>"
    },
```

- [ ] **Step 2: nextActions 재정렬**

m2 완료를 반영해 nextActions를 갱신한다. rank-2 "harness 입력 강화 스펙"을 rank-1로 올리고, KB 자동 검증 파이프라인이 이제 도구로 존재함을 rank에 반영(예: "PENDING 5개는 파이프라인으로 검증 시도 가능하나 herbal은 근거상 계속 기권 예상"). rank-3 herbal 재검토 제약은 유지. (정확한 문구는 실행자가 현 상태 기준으로 작성 — 단 "herbal 억지 승격 금지" 제약은 반드시 보존.)

- [ ] **Step 3: 대시보드 재생성**

```bash
npm run dashboard
```

Expected: `dashboard.html` 재생성 성공.

- [ ] **Step 4: 드리프트 경고 부재 확인**

```bash
grep -c "drift-warn" dashboard.html
```

Expected: `0` (m2 anchor가 main 조상이므로 드리프트 없음). 1 이상이면 anchor 해시 오타 — Step 1 재확인.

- [ ] **Step 5: 완료 커밋**

```bash
git add project-state.json dashboard.html
git commit -m "feat: m2 KB 자동 검증 파이프라인 완료 처리 (done + anchor)"
```

---

### Task 5: 마무리 (finishing-a-development-branch)

**Files:** 없음 (브랜치 정리).

- [ ] **Step 1: 최종 테스트 재확인**

```bash
npm test
```

Expected: 전부 통과.

- [ ] **Step 2: superpowers:finishing-a-development-branch 스킬로 마무리**

옵션 1(main에 로컬 병합) 선택 — 지난번 milestone-drift와 동일 흐름. 머지 후 `feat/kb-auto-verification-integration` 삭제.

- [ ] **Step 3: stale m2 브랜치 2개 삭제**

```bash
git branch -D feat/kb-auto-verification kb-auto-verify-isolated
```

Expected: 두 브랜치 삭제. (isolated는 통합 완료, feat는 폐기 대상.)

- [ ] **Step 4: 메모리 갱신**

`~/.claude/projects/-home-gon-projects-gon-gons-health/memory/`에 m2 통합 완료 기록(또는 기존 메모리 갱신). MEMORY.md 인덱스에 한 줄 추가.

---

## Self-Review

**1. Spec coverage:** 스펙 §4 9단계 절차 → Task 1(1·2단계), Task 2(3단계 무손실), Task 3(4·5·6단계 빌드·테스트), Task 4(7·8단계 완료처리), Task 5(9단계 브랜치 삭제) 전부 매핑됨. 스펙 §5 검증 기준 8개 → Task 2~4의 검증 스텝에 분산 반영. ✅

**2. Placeholder scan:** Task 4 Step 1·2의 `<...>`와 "실행자가 작성"은 의도된 동적 값(머지 해시는 Task 3에서 생성, nextActions 문구는 현 상태 의존). 나머지 명령·코드는 전부 구체. ✅

**3. Type consistency:** 파이프라인 타입(`AutoReview`, `auto_verified`)은 isolated 브랜치에 이미 구현·테스트됨 — 이 플랜은 통합만 하므로 새 타입 정의 없음. ✅
