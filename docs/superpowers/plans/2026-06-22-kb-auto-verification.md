# KB 자동 검증 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PENDING 상태의 KB 엔트리를 사람이 매번 처음부터 손으로 검증하는 대신, 오프라인 파이프라인이 PubMed 근거를 모아 의미 일치를 판정하고 `auto_verified` 티어로 끌어올린 뒤, 약사가 큐에서 일괄 승인만 하면 `verified`(금본위)로 승격되게 한다.

**Architecture:** 오프라인/개발타임 전용. 3스텝 반자동 — ① 수집 스크립트(PubMed esearch/efetch) → ② Claude grounded 판정(인-루프) → ③ 머지 스크립트. 진실의 소스는 항상 PubMed abstract 원문이고, LLM은 근거를 *생성*하지 않고 주어진 원문을 *판정*만 한다. `verified` 승격은 약사의 명시적 CLI 행동으로만. 런타임 코어(`lookup`/`validateKb`)는 LLM·API 0 불변식을 그대로 유지한다.

**Tech Stack:** TypeScript, Node 20+ (내장 `fetch`), Vitest. 외부 의존성 추가 없음 — PubMed E-utilities는 무료·키 불필요. LLM 판정은 스크립트 실행자(이 파이프라인을 돌리는 에이전트/개발자)가 abstract 원문을 읽고 수행하는 단계로 설계(런타임 LLM 호출 아님).

## Global Constraints

- **런타임 순수성:** `src/lib/lookup.ts`, `src/lib/validateKb.ts`, `src/index.ts`(코어 배럴)에 네트워크·LLM 호출을 절대 추가하지 않는다. 검증 파이프라인 코드는 `scripts/` 디렉토리에만 둔다.
- **금본위 보존:** `lookup()`의 `e.verified === true` 필터는 변경하지 않는다. `verified`는 약사 사인오프 전용으로 남는다.
- **분리 티어:** 자동 검증 결과는 `verified`가 아니라 `auto_verified` 필드에 기록한다. `auto_verified === true`인 엔트리는 `verified === true`로 자동 승격되지 **않는다**.
- **진실 소스 = PubMed:** PMID 실존·abstract 원문은 PubMed E-utilities API로만 확인한다. LLM/웹검색은 후보 발굴·요약에만 쓰고, 진실 소스로 쓰지 않는다.
- **grounded 판정:** 의미 게이트는 단순 yes/no가 아니라 (i) abstract에서 근거 문장을 그대로 추출, (ii) 방향(증가/감소/영향없음)을 엔트리 주장과 대조, (iii) 근거 문장을 못 집으면 기권(불일치 처리)한다.
- **인용 quote는 verbatim 아님:** 기존 verified 엔트리의 `quote`는 패러프레이즈+저자/연도(예: 단삼 `"...the anticoagulant response to warfarin was exaggerated. (Chan TY, Ann Pharmacother 2001)"`)다. quote 정확 substring 매칭으로 검증하지 말 것 — 정상 엔트리도 탈락한다.
- **KB 변경 시 dist 재빌드:** `interactions.json`이 바뀌면 `npm run build`(tsup → `dist/`)를 다시 돌리고 `dist/`를 함께 커밋한다(GitHub 의존성 소비처가 깨지지 않게).
- **한국어 응답·주석:** 코드 주석은 한국어, 식별자는 영어.

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|------|------|----------|
| `src/types.ts` | `auto_verified` + `auto_review` 메타 필드를 `InteractionEntry`에 추가 | 수정 |
| `src/lib/validateKb.ts` | 새 옵셔널 필드 검증 (있으면 타입 강제, 없으면 통과) | 수정 |
| `src/lib/validateKb.test.ts` | 새 필드 검증 테스트 | 수정 |
| `src/lib/lookup.test.ts` | `auto_verified`가 lookup 노출에 영향 없음을 못박는 회귀 테스트 | 수정 |
| `scripts/pubmed.ts` | PubMed E-utilities 래퍼: esearch(후보 검색), efetch(abstract 원문) | 신규 |
| `scripts/pubmed.test.ts` | PubMed 응답 파싱 단위 테스트(네트워크 모킹) | 신규 |
| `scripts/verifyKb.ts` | 오케스트레이터: PENDING 엔트리 → 후보·근거 수집 → 판정 큐 작성 | 신규 |
| `scripts/applyVerdict.ts` | 판정 결과를 interactions.json에 머지(auto_verified 기록) | 신규 |
| `scripts/applyVerdict.test.ts` | 머지 로직 단위 테스트 | 신규 |
| `src/components/ResultCard.tsx` | (티어 분리가 UI에 닿을 경우) 라벨 구분 — 단 lookup은 verified만 반환하므로 현 단계에선 변경 불필요, 주석으로만 명시 | 참고 |
| `package.json` | `verify:kb` / `verify:apply` 스크립트 추가 | 수정 |
| `docs/PACKAGING.md` 또는 신규 `docs/KB-VERIFICATION.md` | 파이프라인 사용법 문서 | 신규 |

**티어 데이터 모델 (확정):**

```ts
// verified: 약사가 1차문헌 대조 + 사인오프한 금본위. lookup이 이것만 반환.
// auto_verified: 기계 검증(PubMed 실존 + grounded 의미일치) 통과. lookup 노출 안 됨.
//   약사는 별도 큐에서 auto_verified 엔트리를 일괄 검토 후 verified로 승격.
verified: boolean
auto_verified?: boolean        // 옵셔널 — 없으면 미검증으로 간주
auto_review?: {
  status: 'pass' | 'fail'      // pass = 실존 + 의미일치, fail = 둘 중 하나 실패
  pmid: string                 // 대조한 PMID (예: "PMID:11302416")
  evidence_sentence: string    // abstract에서 그대로 추출한 근거 문장
  direction_match: boolean     // 엔트리 주장 방향과 abstract 방향 일치 여부
  reason: string               // fail 시 사유 (예: "abstract는 영향없음, 엔트리는 증가 주장")
  reviewed_date: string        // YYYY-MM-DD
}
```

---

### Task 1: 티어 타입 추가 (`auto_verified` + `auto_review` + `supplement_en`)

**Files:**
- Modify: `src/types.ts:13-28`
- Test: `src/lib/validateKb.test.ts` (Task 2에서)

**Interfaces:**
- Consumes: 기존 `InteractionEntry`, `Source`
- Produces: `InteractionEntry`에 옵셔널 `supplement_en?: string`(PubMed 영문 검색어), `auto_verified?: boolean`, `auto_review?: AutoReview`. 새 export `AutoReview` 인터페이스.

**배경:** dry-run 결과 한글 supplement(마늘·나토키나제·홍삼·철분·칼슘·비타민K)는 PubMed esearch에서 무시되어 약물명만으로 **엉뚱한 논문**이 후보로 온다(예: "warfarin 마늘 interaction" → 마늘 무관 lenvatinib 케이스). 영문 검색어를 엔트리에 명시해야 정확한 후보가 나온다.

- [ ] **Step 1: 타입 추가**

`src/types.ts`의 `InteractionEntry` 인터페이스 바로 위에 `AutoReview` 추가하고, 인터페이스 끝(`verified: boolean` 다음)에 옵셔널 필드 추가:

```ts
// 자동 검증(기계) 결과 메타. verified(약사 사인오프)와 분리된 티어.
export interface AutoReview {
  status: 'pass' | 'fail' // pass = PubMed 실존 + 의미일치
  pmid: string // 대조한 PMID (예: "PMID:11302416")
  evidence_sentence: string // abstract에서 그대로 추출한 근거 문장
  direction_match: boolean // 엔트리 주장 방향과 abstract 방향 일치 여부
  reason: string // fail 시 사유
  reviewed_date: string // YYYY-MM-DD
}
```

그리고 `InteractionEntry` 안 `verified: boolean` 줄 **다음에** 추가:

```ts
  // PubMed esearch용 영문 검색어. 한글 supplement는 PubMed에서 무시되므로 필수.
  // 예: "마늘" → "garlic Allium sativum". 없으면 검증 스크립트가 supplement 한글을 그대로 쓰며
  // 후보 정확도가 떨어진다(엉뚱한 약물 논문이 옴).
  supplement_en?: string
  // 기계 검증(PubMed 실존 + grounded 의미일치) 통과 여부. verified와 별개 티어 —
  // auto_verified=true 라도 lookup에는 노출되지 않는다. 약사 사인오프로만 verified 승격.
  auto_verified?: boolean
  auto_review?: AutoReview
```

그리고 기존 8개 PENDING 엔트리에 `supplement_en`을 추가한다(`interactions.json` 직접 편집, Task 1 Step 1에 포함):

| id | supplement | supplement_en |
|----|-----------|---------------|
| anticoag-ginkgo-001 | 은행 (Ginkgo biloba) | `Ginkgo biloba` |
| anticoag-dongquai-001 | 당귀 (Dong quai) | `Dong quai Angelica sinensis` |
| anticoag-garlic-001 | 마늘 | `garlic Allium sativum` |
| anticoag-nattokinase-001 | 나토키나제 | `nattokinase` |
| anticoag-redginseng-001 | 홍삼 | `red ginseng Panax` |
| thyroid-iron-001 | 철분 | `iron ferrous` |
| quinolone-calcium-001 | 칼슘 | `calcium carbonate` |
| anticoag-vitk-001 | 비타민K (녹황색채소 다량) | `vitamin K` |

(이미 verified인 단삼·칼슘 엔트리에도 추가하면 일관성 ↑ — 단삼 `Salvia miltiorrhiza Danshen`, 칼슘 `calcium carbonate`)

- [ ] **Step 2: 타입체크로 컴파일 확인**

Run: `npm run typecheck`
Expected: 에러 없음 (옵셔널 필드라 기존 엔트리와 호환)

- [ ] **Step 3: 커밋**

```bash
git add src/types.ts
git commit -m "feat: auto_verified 티어 타입 추가 (verified와 분리)"
```

---

### Task 2: validateKb가 새 옵셔널 필드를 검증

**Files:**
- Modify: `src/lib/validateKb.ts:48-52`
- Test: `src/lib/validateKb.test.ts`

**Interfaces:**
- Consumes: Task 1의 `AutoReview`, `auto_verified`
- Produces: `validateKb`가 `auto_verified`(있으면 boolean 강제)와 `auto_review`(있으면 5필드 + status enum 강제)를 검증. 없으면 통과(하위호환).

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/validateKb.test.ts`에 추가:

```ts
test('auto_verified가 boolean이 아니면 throw', () => {
  const entry = { ...validBaseEntry(), auto_verified: 'yes' }
  expect(() => validateKb([entry])).toThrow(/auto_verified/)
})

test('auto_review.status가 pass/fail이 아니면 throw', () => {
  const entry = {
    ...validBaseEntry(),
    auto_review: {
      status: 'maybe',
      pmid: 'PMID:1',
      evidence_sentence: 's',
      direction_match: true,
      reason: '',
      reviewed_date: '2026-06-22',
    },
  }
  expect(() => validateKb([entry])).toThrow(/auto_review.*status/)
})

test('auto_verified/auto_review 없는 기존 엔트리는 통과', () => {
  expect(() => validateKb([validBaseEntry()])).not.toThrow()
})

test('fail 판정 엔트리는 validateKb를 통과한다 (evidence_sentence 비어도)', () => {
  // fail은 정상 경로 — 근거 못 집으면 fail. 이게 KB를 brick하면 안 됨.
  const e = {
    ...validBaseEntry(),
    auto_verified: false,
    auto_review: {
      status: 'fail', pmid: '', evidence_sentence: '',
      direction_match: false, reason: '관련 논문 없음', reviewed_date: '2026-06-22',
    },
  }
  expect(() => validateKb([e])).not.toThrow()
})

test('pass 판정인데 evidence_sentence 비면 throw (안전 불변식)', () => {
  const e = {
    ...validBaseEntry(),
    auto_verified: true,
    auto_review: {
      status: 'pass', pmid: 'PMID:1', evidence_sentence: '',
      direction_match: true, reason: '', reviewed_date: '2026-06-22',
    },
  }
  expect(() => validateKb([e])).toThrow()
})
```

`validBaseEntry()` 헬퍼가 파일에 없으면 파일 상단에 추가(기존 테스트가 인라인 객체를 쓰면 그 형태를 복사해 함수화):

```ts
function validBaseEntry() {
  return {
    id: 'x-1',
    drug_class: 'A',
    drug_ingredient: ['a'],
    supplement: 'B',
    severity: 'high',
    action_type: 'avoid',
    mechanism: 'm',
    recommendation: 'r',
    evidence_level: '중',
    source: { db: 'PubMed', id: 'PMID:1', url: 'https://x', quote: 'q', retrieved_date: '2026-06-22' },
    last_reviewed: '2026-06-22',
    verified: true,
  }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/validateKb.test.ts -t auto_`
Expected: FAIL (검증 로직 아직 없음)

- [ ] **Step 3: 검증 로직 구현**

`src/lib/validateKb.ts`의 `verified` 검증(50번 줄) **다음에** 추가:

```ts
    // auto_verified는 옵셔널 — 있으면 boolean 강제
    if (entry.auto_verified !== undefined && typeof entry.auto_verified !== 'boolean')
      throw new Error(`${ctx}: auto_verified는 boolean이어야 함`)
    // auto_review는 옵셔널 — 있으면 status 조건부 검증
    if (entry.auto_review !== undefined) {
      const ar = entry.auto_review as Record<string, unknown>
      if (ar.status !== 'pass' && ar.status !== 'fail')
        throw new Error(`${ctx}: auto_review.status는 pass|fail`)
      // 공통 필드
      if (
        typeof ar.direction_match !== 'boolean' ||
        typeof ar.reason !== 'string' ||
        typeof ar.pmid !== 'string' ||
        typeof ar.evidence_sentence !== 'string' ||
        !isNonEmptyString(ar.reviewed_date)
      )
        throw new Error(`${ctx}: auto_review 필드 누락/부적합`)
      // status별 강제: pass는 실제 근거 필수(안전 불변식), fail은 사유 필수
      if (ar.status === 'pass') {
        if (!isNonEmptyString(ar.pmid) || !isNonEmptyString(ar.evidence_sentence))
          throw new Error(`${ctx}: pass 판정은 pmid·evidence_sentence 필수 (근거 없는 통과 금지)`)
      } else {
        if (!isNonEmptyString(ar.reason))
          throw new Error(`${ctx}: fail 판정은 reason 필수`)
      }
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/validateKb.test.ts`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/validateKb.ts src/lib/validateKb.test.ts
git commit -m "feat: validateKb가 auto_verified/auto_review 옵셔널 필드 검증"
```

---

### Task 3: auto_verified가 lookup 노출에 영향 없음을 못박기 (회귀 가드)

**Files:**
- Modify: `src/lib/lookup.test.ts`

**Interfaces:**
- Consumes: 기존 `lookup`, Task 1 필드
- Produces: 회귀 테스트만 추가. `lookup.ts` 코드는 **변경 없음**(금본위 보존 증명).

- [ ] **Step 1: 회귀 테스트 작성**

`src/lib/lookup.test.ts`에 추가:

```ts
test('auto_verified=true 이지만 verified=false 인 엔트리는 lookup이 반환하지 않는다', () => {
  const kb = [
    {
      ...baseEntry(), // 기존 테스트의 헬퍼; 없으면 validBaseEntry 형태 복사
      drug_class: 'D',
      supplement: 'S',
      verified: false,
      auto_verified: true,
    },
  ] as any
  const result = lookup(kb, 'D', 'S')
  expect(result.kind).toBe('abstain')
})
```

(파일에 엔트리 생성 헬퍼가 없으면 Task 2의 `validBaseEntry` 형태를 인라인으로 작성)

- [ ] **Step 2: 테스트 실행 — 바로 통과해야 함**

Run: `npx vitest run src/lib/lookup.test.ts`
Expected: PASS (lookup이 이미 verified만 필터하므로 auto_verified는 무시됨 — 이게 증명하려는 것)

- [ ] **Step 3: 커밋**

```bash
git add src/lib/lookup.test.ts
git commit -m "test: auto_verified는 lookup 노출에 영향 없음을 회귀 가드로 못박음"
```

---

### Task 4: PubMed E-utilities 래퍼

**Files:**
- Create: `scripts/pubmed.ts`
- Test: `scripts/pubmed.test.ts`

**Interfaces:**
- Consumes: Node 내장 `fetch`
- Produces:
  - `searchPubmed(query: string, retmax?: number): Promise<string[]>` — esearch로 PMID 배열 반환
  - `fetchAbstract(pmid: string): Promise<string>` — efetch로 abstract 텍스트 반환
  - `parsePmidsFromESearch(xml: string): string[]` — XML에서 `<Id>` 추출(순수 함수, 테스트 대상)

- [ ] **Step 1: 파서 순수 함수의 실패 테스트 작성**

`scripts/pubmed.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { parsePmidsFromESearch } from './pubmed'

describe('parsePmidsFromESearch', () => {
  test('esearch XML에서 PMID 목록 추출', () => {
    const xml = `<eSearchResult><IdList><Id>11302416</Id><Id>10838651</Id></IdList></eSearchResult>`
    expect(parsePmidsFromESearch(xml)).toEqual(['11302416', '10838651'])
  })

  test('결과 없으면 빈 배열', () => {
    const xml = `<eSearchResult><IdList></IdList></eSearchResult>`
    expect(parsePmidsFromESearch(xml)).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run scripts/pubmed.test.ts`
Expected: FAIL ("parsePmidsFromESearch is not a function")

- [ ] **Step 3: pubmed.ts 구현**

`scripts/pubmed.ts`:

```ts
// PubMed E-utilities 래퍼. 오프라인 검증 파이프라인 전용 — 런타임 코어에서 import 금지.
// 무료·API키 불필요. 진실의 소스(PMID 실존 + abstract 원문).

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

/** esearch XML 응답에서 PMID 목록 추출 (순수 함수). */
export function parsePmidsFromESearch(xml: string): string[] {
  const ids: string[] = []
  const re = /<Id>(\d+)<\/Id>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) ids.push(m[1])
  return ids
}

/** 검색어로 후보 PMID 목록을 가져온다. */
export async function searchPubmed(query: string, retmax = 5): Promise<string[]> {
  const url = `${EUTILS}/esearch.fcgi?db=pubmed&retmax=${retmax}&term=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`esearch 실패: ${res.status}`)
  return parsePmidsFromESearch(await res.text())
}

/** PMID로 abstract 원문(텍스트)을 가져온다. 진실 소스. */
export async function fetchAbstract(pmid: string): Promise<string> {
  const id = pmid.replace(/^PMID:/, '')
  const url = `${EUTILS}/efetch.fcgi?db=pubmed&id=${id}&rettype=abstract&retmode=text`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`efetch 실패(${pmid}): ${res.status}`)
  return res.text()
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run scripts/pubmed.test.ts`
Expected: PASS

- [ ] **Step 5: 실제 API 스모크 테스트 (수동, 1회)**

Run: `npx tsx scripts/pubmed.ts` 대신 인라인 확인 —
```bash
node --input-type=module -e "import('./scripts/pubmed.ts').then(async m => { console.log((await m.fetchAbstract('PMID:11302416')).slice(0,120)) })" 2>/dev/null || echo "tsx 필요 시: npx tsx로 재시도"
```
Expected: "Ann Pharmacother. 2001..." 로 시작하는 abstract. (실패해도 단위 테스트가 통과하면 Task는 완료 — 스모크는 참고용)

- [ ] **Step 6: 커밋**

```bash
git add scripts/pubmed.ts scripts/pubmed.test.ts
git commit -m "feat: PubMed E-utilities 래퍼 (esearch/efetch + PMID 파서)"
```

---

### Task 5: 검증 오케스트레이터 — PENDING 엔트리의 판정 큐 생성

**Files:**
- Create: `scripts/verifyKb.ts`
- Test: 없음 (I/O 오케스트레이터 — 순수 로직은 Task 6 applyVerdict에서 테스트)

**Interfaces:**
- Consumes: Task 4의 `searchPubmed`, `fetchAbstract`; `loadKb`/raw json
- Produces: `scripts/verify-queue.json` 파일 — PENDING 엔트리별로 `{ id, drug_class, supplement, claim_direction, candidate_pmids, abstracts }` 를 담은 큐. 이 큐를 LLM(스크립트 실행자)이 읽고 grounded 판정 → `scripts/verdicts.json` 작성.

**설계 주의:** 이 스크립트는 abstract 원문을 *수집*만 한다. 의미 판정은 큐를 읽는 LLM 단계가 수행한다(런타임 LLM 호출이 아니라, 파이프라인을 돌리는 에이전트의 작업). 이렇게 분리해야 "LLM이 근거를 만들지 않고 주어진 원문만 판정"하는 불변식이 코드 구조로 강제된다.

- [ ] **Step 1: 오케스트레이터 구현**

`scripts/verifyKb.ts`:

```ts
// PENDING(verified=false 또는 source.id=PENDING) 엔트리에 대해
// PubMed 후보 검색 + abstract 수집 → 판정 큐(verify-queue.json) 작성.
// 의미 판정은 이 큐를 읽는 LLM 단계가 수행한다(여기서 하지 않음 — 분리 불변식).
import { readFileSync, writeFileSync } from 'node:fs'
import { searchPubmed, fetchAbstract } from './pubmed'

interface QueueItem {
  id: string
  drug_class: string
  supplement: string
  claim: string // 엔트리의 mechanism+recommendation (방향 판정 근거)
  candidate_pmids: string[]
  abstracts: Record<string, string>
}

async function main() {
  const kbPath = new URL('../src/data/interactions.json', import.meta.url)
  const kb = JSON.parse(readFileSync(kbPath, 'utf-8')) as any[]
  const pending = kb.filter((e) => !e.verified || e.source?.id === 'PENDING')

  const queue: QueueItem[] = []
  const noEn: string[] = []
  for (const e of pending) {
    // 영문 검색어: supplement_en 필수. 없으면 한글이 PubMed로 가 엉뚱한 후보가 오므로
    // 경고 후 건너뛴다(조용한 실패 금지 — fail-loud).
    const suppEn = e.supplement_en
    if (!suppEn) {
      noEn.push(e.id)
      console.warn(`[건너뜀] ${e.id}: supplement_en 없음 — interactions.json에 영문 검색어 추가 필요`)
      continue
    }
    const drugEn = e.drug_ingredient?.[0] ?? e.drug_class
    const query = `${drugEn} ${suppEn} interaction`
    const pmids = await searchPubmed(query, 5)
    const abstracts: Record<string, string> = {}
    for (const pmid of pmids) {
      try {
        abstracts[pmid] = await fetchAbstract(pmid)
      } catch (err) {
        abstracts[pmid] = `(efetch 실패: ${(err as Error).message})`
      }
    }
    queue.push({
      id: e.id,
      drug_class: e.drug_class,
      supplement: e.supplement,
      claim: `${e.mechanism} / ${e.recommendation}`,
      candidate_pmids: pmids,
      abstracts,
    })
    console.log(`[큐] ${e.id}: 후보 ${pmids.length}건`)
  }

  const outPath = new URL('./verify-queue.json', import.meta.url)
  writeFileSync(outPath, JSON.stringify(queue, null, 2))
  console.log(`\n판정 큐 작성 완료: scripts/verify-queue.json (${queue.length}개 엔트리)`)
  if (noEn.length) console.warn(`⚠️  supplement_en 없어 건너뛴 엔트리: ${noEn.join(', ')}`)
  console.log('다음: 이 큐의 각 항목에 대해 abstract를 읽고 grounded 판정 → scripts/verdicts.json 작성 후 npm run verify:apply')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: 의존성 확인 (tsx)**

Run: `npx tsx --version || npm i -D tsx`
Expected: tsx 버전 출력 또는 설치 완료 (TypeScript 스크립트 직접 실행용)

- [ ] **Step 3: 큐 생성 실행 (실제 API 호출)**

Run: `npx tsx scripts/verifyKb.ts`
Expected: `[큐] anticoag-ginkgo-001: 후보 N건` 같은 로그가 PENDING 엔트리 수(8개)만큼. `scripts/verify-queue.json` 생성. (네트워크 의존 — rate limit 시 retmax 줄이거나 재시도)

- [ ] **Step 4: gitignore에 큐 산출물 추가**

`scripts/verify-queue.json`과 `scripts/verdicts.json`은 중간 산출물 — 커밋 제외:

```bash
printf '\n# KB 검증 파이프라인 중간 산출물\nscripts/verify-queue.json\nscripts/verdicts.json\n' >> .gitignore
```

- [ ] **Step 5: 커밋**

```bash
git add scripts/verifyKb.ts .gitignore package.json
git commit -m "feat: 검증 오케스트레이터 — PubMed 후보·abstract 수집 큐 생성"
```

---

### Task 6: 판정 머지 — verdicts.json을 interactions.json에 반영

**Files:**
- Create: `scripts/applyVerdict.ts`
- Test: `scripts/applyVerdict.test.ts`

**Interfaces:**
- Consumes: `scripts/verdicts.json`(LLM 판정 결과), `src/data/interactions.json`
- Produces:
  - `mergeVerdict(entry, verdict): entry` — 순수 함수. 판정을 받아 `auto_verified`+`auto_review`를 채운 새 엔트리 반환(불변).
  - `applyVerdict.ts` main — verdicts.json을 읽어 KB에 머지 후 저장.

**verdicts.json 형식 (LLM이 큐를 읽고 작성):**
```json
[
  {
    "id": "anticoag-ginkgo-001",
    "status": "pass",
    "pmid": "PMID:10852273",
    "evidence_sentence": "Ginkgo biloba ... increased bleeding risk when combined with anticoagulants.",
    "direction_match": true,
    "reason": ""
  }
]
```

- [ ] **Step 1: mergeVerdict 실패 테스트 작성**

`scripts/applyVerdict.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { mergeVerdict } from './applyVerdict'

const baseEntry = {
  id: 'e-1',
  drug_class: 'A',
  supplement: 'B',
  verified: false,
  source: { db: '미확정', id: 'PENDING', url: 'https://x', quote: 'q', retrieved_date: '2026-06-21' },
}

describe('mergeVerdict', () => {
  test('pass 판정은 auto_verified=true + auto_review 기록', () => {
    const v = {
      id: 'e-1', status: 'pass' as const, pmid: 'PMID:1',
      evidence_sentence: 's', direction_match: true, reason: '',
    }
    const out = mergeVerdict(baseEntry, v, '2026-06-22')
    expect(out.auto_verified).toBe(true)
    expect(out.auto_review?.status).toBe('pass')
    expect(out.auto_review?.pmid).toBe('PMID:1')
  })

  test('fail 판정은 auto_verified=false + 사유 기록', () => {
    const v = {
      id: 'e-1', status: 'fail' as const, pmid: 'PMID:2',
      evidence_sentence: '', direction_match: false, reason: '방향 불일치',
    }
    const out = mergeVerdict(baseEntry, v, '2026-06-22')
    expect(out.auto_verified).toBe(false)
    expect(out.auto_review?.reason).toBe('방향 불일치')
  })

  test('verified는 절대 건드리지 않는다 (금본위 보존)', () => {
    const v = { id: 'e-1', status: 'pass' as const, pmid: 'PMID:1', evidence_sentence: 's', direction_match: true, reason: '' }
    const out = mergeVerdict({ ...baseEntry, verified: false }, v, '2026-06-22')
    expect(out.verified).toBe(false) // pass여도 verified는 그대로
  })

  test('원본 객체를 변형하지 않는다 (불변)', () => {
    const v = { id: 'e-1', status: 'pass' as const, pmid: 'PMID:1', evidence_sentence: 's', direction_match: true, reason: '' }
    mergeVerdict(baseEntry, v, '2026-06-22')
    expect((baseEntry as any).auto_verified).toBeUndefined()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run scripts/applyVerdict.test.ts`
Expected: FAIL ("mergeVerdict is not a function")

- [ ] **Step 3: applyVerdict.ts 구현**

`scripts/applyVerdict.ts`:

```ts
// verdicts.json(LLM grounded 판정)을 interactions.json에 머지.
// auto_verified/auto_review만 갱신 — verified(금본위)는 절대 건드리지 않는다.
import { readFileSync, writeFileSync } from 'node:fs'

export interface Verdict {
  id: string
  status: 'pass' | 'fail'
  pmid: string
  evidence_sentence: string
  direction_match: boolean
  reason: string
}

/** 판정을 엔트리에 머지한 새 객체 반환 (불변). verified는 건드리지 않음. */
export function mergeVerdict<T extends Record<string, any>>(
  entry: T,
  v: Verdict,
  reviewedDate: string,
): T & { auto_verified: boolean; auto_review: object } {
  return {
    ...entry,
    auto_verified: v.status === 'pass',
    auto_review: {
      status: v.status,
      pmid: v.pmid,
      evidence_sentence: v.evidence_sentence,
      direction_match: v.direction_match,
      reason: v.reason,
      reviewed_date: reviewedDate,
    },
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function main() {
  const kbPath = new URL('../src/data/interactions.json', import.meta.url)
  const verdictsPath = new URL('./verdicts.json', import.meta.url)
  const kb = JSON.parse(readFileSync(kbPath, 'utf-8')) as any[]
  const verdicts = JSON.parse(readFileSync(verdictsPath, 'utf-8')) as Verdict[]
  const byId = new Map(verdicts.map((v) => [v.id, v]))
  const date = today()

  let pass = 0
  const next = kb.map((e) => {
    const v = byId.get(e.id)
    if (!v) return e
    if (v.status === 'pass') pass++
    return mergeVerdict(e, v, date)
  })

  writeFileSync(kbPath, JSON.stringify(next, null, 2) + '\n')
  console.log(`머지 완료: ${verdicts.length}개 판정 반영 (pass ${pass}, fail ${verdicts.length - pass})`)
  console.log('주의: auto_verified만 갱신됨. verified(약사 사인오프)는 변경 안 됨.')
  console.log('다음: npm test && npm run build (dist 재빌드) 후 함께 커밋')
}

main()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run scripts/applyVerdict.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/applyVerdict.ts scripts/applyVerdict.test.ts
git commit -m "feat: 판정 머지 — auto_verified 기록, verified 금본위 보존 (불변)"
```

---

### Task 7: package.json 스크립트 + 문서

**Files:**
- Modify: `package.json:21-30`
- Create: `docs/KB-VERIFICATION.md`

**Interfaces:**
- Consumes: Task 5·6 스크립트
- Produces: `npm run verify:kb`(큐 생성), `npm run verify:apply`(머지) 명령. 사용법 문서.

- [ ] **Step 1: package.json 스크립트 추가**

`package.json`의 `scripts`에 추가:

```json
    "verify:kb": "tsx scripts/verifyKb.ts",
    "verify:apply": "tsx scripts/applyVerdict.ts",
```

- [ ] **Step 2: 문서 작성**

`docs/KB-VERIFICATION.md`:

```markdown
# KB 자동 검증 파이프라인

PENDING 엔트리를 PubMed 근거로 자동 대조해 `auto_verified` 티어로 승격한다.
`verified`(약사 사인오프 금본위)는 이 파이프라인이 절대 건드리지 않는다.

## 티어 구분

- `verified: true` — 약사가 1차문헌 대조 + 사인오프. **lookup이 이것만 반환.**
- `auto_verified: true` — 기계 검증(PubMed 실존 + grounded 의미일치) 통과. lookup 노출 안 됨.
  약사가 별도 큐에서 검토 후 verified로 승격하는 후보.

## 실행 순서 (3스텝 반자동 + 약사 승격)

이것은 버튼 하나 무인 파이프라인이 **아니다**. 수집(스크립트) → 판정(Claude 인-루프) → 머지(스크립트)
3스텝이고, verified 승격은 약사의 명시적 행동이다.

1. `npm run verify:kb`
   PENDING 엔트리마다 PubMed 후보 검색 + abstract 수집 → `scripts/verify-queue.json`.
   (`supplement_en` 없는 엔트리는 건너뛰며 경고 — 영문 검색어 먼저 추가.)
2. 큐의 각 항목에 대해 abstract 원문을 읽고 grounded 판정 → `scripts/verdicts.json` 작성. **(Claude 인-루프)**
   - **판정 규칙(불변):** abstract 원문에서 근거 문장을 그대로 추출(`evidence_sentence`),
     엔트리 주장 방향(증가/감소/영향없음)과 대조(`direction_match`). 근거 문장을 못 집으면 `status: fail`.
   - LLM은 근거를 *생성*하지 않는다 — API가 가져온 원문만 보고 *판정*한다.
3. `npm run verify:apply`
   판정을 interactions.json에 머지(auto_verified/auto_review 기록). **verified는 안 건드림.**
4. `npm run verify:promote`
   약사 승격 후보(auto_verified=true & verified=false) 목록 출력.
   약사가 검토 후 `npm run verify:promote -- <id1,id2>` 또는 `-- all` 로 verified 승격.
5. `npm test && npm run build` 후 `interactions.json` + `dist/` 함께 커밋.

## 티어 흐름 요약

```
PENDING ──(verify:kb 수집)──> 큐
   큐 ──(Claude grounded 판정)──> verdicts.json
verdicts ──(verify:apply 머지)──> auto_verified=true   [기계 통과, lookup 노출 안 됨]
auto_verified ──(verify:promote, 약사 승인)──> verified=true   [금본위, lookup 노출]
```

## 안전 불변식

- 진실 소스 = PubMed efetch abstract 원문. drugChecker MCP는 보조 신호로만.
- 런타임 코어(lookup/validateKb)는 네트워크·LLM 0 — 이 파이프라인은 `scripts/` 전용.
- `verified` 승격은 약사의 명시적 CLI 행동으로만. 어떤 스크립트도 자동으로 verified를 켜지 않는다.
- `verdicts.json`/`verify-queue.json`은 중간 산출물(gitignore).
```

- [ ] **Step 3: 전체 테스트 + 빌드 확인**

Run: `npm test && npm run build`
Expected: 전체 테스트 PASS, tsup 빌드 성공 (dist/ 갱신)

- [ ] **Step 4: 커밋**

```bash
git add package.json docs/KB-VERIFICATION.md
git commit -m "docs: KB 검증 파이프라인 npm 스크립트 + 사용법 문서"
```

---

### Task 8: 약사 승격 큐 — auto_verified → verified 일괄 승인 CLI

**Files:**
- Create: `scripts/promoteQueue.ts`
- Test: `scripts/promoteQueue.test.ts`

**Interfaces:**
- Consumes: `src/data/interactions.json`(auto_verified 엔트리), Task 6의 머지 결과
- Produces:
  - `listPromotable(kb): PromotableEntry[]` — 순수 함수. `auto_verified === true && verified === false`인 엔트리에서 약사 검토용 요약(`{id, drug_class, supplement, pmid, evidence_sentence}`) 추출.
  - `promote(kb, ids, reviewedDate): kb` — 순수 함수. 주어진 id들을 `verified: true`로 승격하고 `source`를 auto_review의 pmid로 채운 새 KB 반환(불변).
  - CLI: 인자 없으면 승격 후보 목록 출력, `--promote id1,id2,all`로 일괄 승격.

**이것이 선택한 모델의 "약사는 큐에서 일괄만 클릭" 부분.** 기계가 auto_verified까지 자동으로 끌고 온 뒤, 약사가 이 큐를 보고 일괄 승인하면 verified(금본위)로 올라간다. 승격은 명시적 사람 행동 — 자동 아님.

- [ ] **Step 1: listPromotable + promote 실패 테스트 작성**

`scripts/promoteQueue.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { listPromotable, promote } from './promoteQueue'

function autoVerifiedEntry(over = {}) {
  return {
    id: 'e-1', drug_class: 'A', supplement: 'B',
    severity: 'high', action_type: 'avoid', mechanism: 'm', recommendation: 'r',
    evidence_level: '중',
    source: { db: '미확정', id: 'PENDING', url: 'https://x', quote: 'q', retrieved_date: '2026-06-21' },
    last_reviewed: '2026-06-21', verified: false, auto_verified: true,
    auto_review: { status: 'pass', pmid: 'PMID:99', evidence_sentence: 'ES', direction_match: true, reason: '', reviewed_date: '2026-06-22' },
    ...over,
  }
}

describe('listPromotable', () => {
  test('auto_verified=true & verified=false 만 후보', () => {
    const kb = [autoVerifiedEntry(), autoVerifiedEntry({ id: 'e-2', verified: true }), autoVerifiedEntry({ id: 'e-3', auto_verified: false })]
    const out = listPromotable(kb)
    expect(out.map((x) => x.id)).toEqual(['e-1'])
    expect(out[0].pmid).toBe('PMID:99')
  })
})

describe('promote', () => {
  test('지정 id를 verified=true로 + source를 pmid로 채움', () => {
    const kb = [autoVerifiedEntry()]
    const out = promote(kb, ['e-1'], '2026-06-22')
    expect(out[0].verified).toBe(true)
    expect(out[0].source.id).toBe('PMID:99')
    expect(out[0].last_reviewed).toBe('2026-06-22')
  })

  test('지정 안 한 id는 그대로', () => {
    const kb = [autoVerifiedEntry(), autoVerifiedEntry({ id: 'e-2' })]
    const out = promote(kb, ['e-1'], '2026-06-22')
    expect(out.find((x) => x.id === 'e-2').verified).toBe(false)
  })

  test('승격 시 quote를 grounded 근거 문장으로 교체 (낡은 PENDING quote 제거)', () => {
    // fixture: source.quote='q', auto_review.evidence_sentence='ES'
    const out = promote([autoVerifiedEntry()], ['e-1'], '2026-06-22')
    expect(out[0].source.quote).toBe('ES') // 'q'(낡은 값) 아님 — 환각 quote가 verified로 새는 것 차단
  })

  test('fail 엔트리(auto_verified=false)는 명시 지정해도 승격 안 됨', () => {
    const kb = [autoVerifiedEntry({ auto_verified: false })]
    const out = promote(kb, ['e-1'], '2026-06-22')
    expect(out[0].verified).toBe(false) // 후보 아니므로 차단 — 오타 한 번에 미검증이 금본위로 새는 것 방지
  })

  test('원본 불변', () => {
    const kb = [autoVerifiedEntry()]
    promote(kb, ['e-1'], '2026-06-22')
    expect(kb[0].verified).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run scripts/promoteQueue.test.ts`
Expected: FAIL ("listPromotable is not a function")

- [ ] **Step 3: promoteQueue.ts 구현**

`scripts/promoteQueue.ts`:

```ts
// 약사 승격 큐. auto_verified(기계 검증 통과) 엔트리를 약사가 일괄 검토 후 verified(금본위)로 승격.
// 승격은 명시적 사람 행동 — 이 스크립트는 자동으로 verified를 켜지 않는다(CLI 인자 필요).
import { readFileSync, writeFileSync } from 'node:fs'

export interface PromotableEntry {
  id: string
  drug_class: string
  supplement: string
  pmid: string
  evidence_sentence: string
}

/** 약사 검토 대상: 기계 통과했지만 아직 사인오프 전인 엔트리. */
export function listPromotable(kb: any[]): PromotableEntry[] {
  return kb
    .filter((e) => e.auto_verified === true && e.verified === false)
    .map((e) => ({
      id: e.id,
      drug_class: e.drug_class,
      supplement: e.supplement,
      pmid: e.auto_review?.pmid ?? '(없음)',
      evidence_sentence: e.auto_review?.evidence_sentence ?? '',
    }))
}

/**
 * 지정 id를 verified로 승격. source를 검증된 pmid로 채운 새 KB 반환(불변).
 * 안전 핵심: source.quote를 grounded 근거 문장(auto_review.evidence_sentence)으로 교체한다.
 * 안 그러면 PENDING의 낡은 quote("...시드 PMID 환각으로 제거됨")가 verified 배지를 달고
 * ResultCard에 출력되는 모순(이 프로젝트 존재 이유 위반)이 발생한다.
 * 승격 대상은 listPromotable 후보(auto_verified=true & verified=false)와 교집합으로 제한 —
 * 오타로 미검증 엔트리가 금본위로 새는 것을 막는다.
 */
export function promote(kb: any[], ids: string[], reviewedDate: string): any[] {
  const promotable = new Set(listPromotable(kb).map((x) => x.id))
  const requested = new Set(ids)
  const skipped = ids.filter((id) => !promotable.has(id))
  if (skipped.length) {
    console.warn(`⚠️  승격 후보 아님(건너뜀): ${skipped.join(', ')} — auto_verified=true & verified=false 만 승격 가능`)
  }
  return kb.map((e) => {
    if (!requested.has(e.id) || !promotable.has(e.id)) return e
    const pmid = e.auto_review?.pmid ?? e.source.id
    return {
      ...e,
      verified: true,
      last_reviewed: reviewedDate,
      source: {
        ...e.source,
        db: e.source.db === '미확정' ? 'PubMed' : e.source.db,
        id: pmid,
        url: pmid.startsWith('PMID:') ? `https://pubmed.ncbi.nlm.nih.gov/${pmid.replace('PMID:', '')}/` : e.source.url,
        // grounded 근거 문장으로 quote 교체 — 낡은 PENDING quote 제거 (핵심 안전 수정)
        quote: e.auto_review?.evidence_sentence || e.source.quote,
        retrieved_date: reviewedDate,
      },
    }
  })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function main() {
  const kbPath = new URL('../src/data/interactions.json', import.meta.url)
  const kb = JSON.parse(readFileSync(kbPath, 'utf-8')) as any[]
  const arg = process.argv[2]

  if (!arg) {
    const list = listPromotable(kb)
    if (!list.length) {
      console.log('승격 후보 없음 (auto_verified=true & verified=false 엔트리 0).')
      return
    }
    console.log(`약사 승격 후보 ${list.length}개:\n`)
    for (const x of list) {
      console.log(`  ${x.id} | ${x.drug_class} × ${x.supplement}`)
      console.log(`    근거: ${x.pmid} — "${x.evidence_sentence.slice(0, 80)}..."`)
    }
    console.log(`\n승격: npm run verify:promote -- <id1,id2> 또는 all`)
    return
  }

  const promoteArg = arg === '--promote' ? process.argv[3] : arg
  const ids = promoteArg === 'all' ? listPromotable(kb).map((x) => x.id) : promoteArg.split(',')
  const next = promote(kb, ids, today())
  writeFileSync(kbPath, JSON.stringify(next, null, 2) + '\n')
  console.log(`승격 완료: ${ids.length}개 → verified=true. 다음: npm test && npm run build 후 커밋.`)
}

main()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run scripts/promoteQueue.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: package.json에 verify:promote 추가**

`package.json` scripts에:

```json
    "verify:promote": "tsx scripts/promoteQueue.ts",
```

- [ ] **Step 6: 전체 테스트 + 빌드**

Run: `npm test && npm run build`
Expected: 전체 PASS, 빌드 성공

- [ ] **Step 7: 커밋**

```bash
git add scripts/promoteQueue.ts scripts/promoteQueue.test.ts package.json
git commit -m "feat: 약사 승격 큐 — auto_verified를 일괄 검토 후 verified 승격 (CLI)"
```

---

## Self-Review

- 분리 티어(`verified` ↔ `auto_verified`) → Task 1·2·3 ✅
- PubMed 진실 소스 → Task 4 ✅
- grounded 의미 게이트(근거 문장 추출 + 방향 대조 + 못 집으면 기권) → verdicts.json 형식 + Task 7 문서 규칙 ✅
- **약사 승격 큐(auto_verified → verified 일괄 승인)** → Task 8 ✅ *(초안에서 누락됐던 부분 — dry-run 후 추가)*
- **한글 supplement 영문 검색어** → Task 1 `supplement_en` 필드 + Task 5 사용 ✅ *(dry-run에서 한글이 엉뚱한 후보를 반환함을 확인 후 추가)*
- 런타임 순수성 → Global Constraint + Task 3 회귀 가드 + scripts/ 격리 ✅
- dist 재빌드 → Task 7·8 빌드 스텝 + 문서 ✅
- drugChecker MCP 보조 신호 → 문서에 명시(코드 강제는 범위 밖 — 큐 작성 LLM이 교차참조)

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "적절히 처리" 류 없음. ✅

**3. Type consistency:** `AutoReview`(Task 1) 필드명 = validateKb 검증(Task 2) = mergeVerdict 출력(Task 6) = listPromotable/promote 사용(Task 8) = verdicts.json 형식. `auto_verified`·`supplement_en` 일관. ✅

**정직한 범위 명시 (과대포장 금지):**
- **"완전 무인" 아님 — 3스텝 반자동:** ① `verify:kb`(수집, 스크립트) → ② Claude가 큐의 abstract를 읽고 grounded 판정(verdicts.json 작성, 인-루프) → ③ `verify:apply`(머지, 스크립트). 판정 단계는 Claude가 수행하며 사람/에이전트가 한 번 개입한다. 일회성 무인 API 통과보다 *신중한* 설계지만, 버튼 하나로 끝나는 파이프라인은 아니다.
- **verified 승격은 명시적 사람 행동:** Task 8의 `verify:promote`는 인자 없이는 목록만 보여주고, 약사가 `--promote`로 승인해야 verified가 켜진다. 자동 승격 없음 — 금본위 보존.
- grounded 의미 판정의 품질은 Claude 판정 단계에 의존 — 코드로 강제되는 건 "원문이 주어진다"는 구조뿐. 잘못된 방향 판정 가능성은 약사 승격 게이트(Task 8)가 최종 차단.
- `supplement_en` 없는 새 엔트리는 Task 5에서 fail-loud로 건너뛴다(조용한 실패 아님).
