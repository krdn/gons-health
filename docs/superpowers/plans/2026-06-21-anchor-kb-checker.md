# 약물↔건기식 상호작용 체커 (B 1단계: 앵커 KB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 약사가 환자의 처방약 클래스와 추천하려는 건기식/식품을 드롭다운으로 선택하면, 항응고제×한약 앵커 클러스터를 중심으로 큐레이션된 상호작용 경고를 인용 근거와 함께 수초 내 보여주고, 근거가 없으면 "안전함"이 아닌 명시적 기권 문구를 출력하는 로컬 전용 웹앱.

**Architecture:** 단일 정적 SPA. 손으로 큐레이션한 `interactions.json`(약물 클래스 × 건기식 키잉)을 메모리에 로드, 결정론적 closed-set lookup. 쿼리 시 LLM 없음(빌드 시 KB 엔트리 드래프트에만 사용). 히트→저장된 인용 엔트리 렌더, 미스→하드코딩된 기권 상수. 네트워크 전송 없음(PHI 안전).

**Tech Stack:** Vite + React + TypeScript + Vitest. 정적 빌드(`npm run build` → 정적 파일), 로컬 실행.

## Global Constraints

- **cite-or-abstain (절대 원칙):** 모든 경고는 `source` 인용을 노출한다. 미스 시 정확히 이 상수를 출력한다(생성 금지): `"검색한 자료 내 문서화된 상호작용 없음 — 안전하다는 의미가 아닙니다. 약사 판단 필요."` 시스템은 절대 "안전함"을 단정하지 않는다.
- **쿼리 시 LLM 없음:** 런타임에 어떤 모델/외부 API도 호출하지 않는다. lookup은 순수 함수.
- **근거 강도 라벨 필수:** 모든 엔트리는 `evidence_level`(강/중/약)을 가진다 — 한약 정책선이 이를 요구하므로 스키마가 전 엔트리에 강제.
- **사주 배제:** 임상 경로에 사주/점성 기능 없음.
- **앵커 우선:** 첫 KB는 항응고제/항혈소판제 × 한약 클러스터(은행·단삼·당귀·마늘·홍삼·나토키나제)를 중심으로 한다.
- **포지셔닝:** "정보 제공 / 약사 검토 전제" — UI에 약사가 최종 판단함을 명시. 진단 도구 아님.
- **언어:** UI·경고·기권 문구 전부 한국어.
- **로컬 전용:** 환자 입력은 메모리에만. localStorage·서버·네트워크 전송 없음(1단계).

## File Structure

| 파일 | 책임 |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | Vite + React + TS + Vitest 프로젝트 셋업 |
| `src/data/interactions.json` | 큐레이션 상호작용 KB (앵커 30개 엔트리) |
| `src/data/vocabulary.ts` | 드롭다운용 약물 클래스 + 건기식 통제 어휘 |
| `src/types.ts` | `InteractionEntry`, `LookupResult` 타입 정의 |
| `src/lib/lookup.ts` | 결정론적 lookup + cite-or-abstain 로직 (핵심 안전 함수) |
| `src/lib/lookup.test.ts` | lookup + 기권 fallback 단위 테스트 |
| `src/lib/validateKb.ts` | KB 스키마 검증 (전 엔트리 evidence_level 강제) |
| `src/lib/validateKb.test.ts` | KB 검증 단위 테스트 |
| `src/components/InteractionChecker.tsx` | 메인 UI: 드롭다운 입력 + 결과 렌더 |
| `src/components/ResultCard.tsx` | 히트/기권 결과 카드 (인용·근거강도·약사판단 라벨) |
| `src/App.tsx`, `src/main.tsx` | React 진입점 |

---

### Task 1: 프로젝트 셋업 (Vite + React + TS + Vitest)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

**Interfaces:**
- Produces: 동작하는 Vite 개발 서버 + Vitest 테스트 러너. `npm test`, `npm run dev`, `npm run build` 사용 가능.

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "gons-health",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: vite.config.ts 작성**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // 로컬 정적 파일로 열 때 상대 경로
})
```

- [ ] **Step 3: tsconfig.json 및 tsconfig.node.json 작성**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: index.html, 진입점 작성**

`index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>건기식 상호작용 체커</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
```

`src/main.tsx`:
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx`:
```typescript
export default function App() {
  return <h1>건기식 상호작용 체커</h1>
}
```

- [ ] **Step 5: 의존성 설치 및 빌드 검증**

Run: `npm install && npm run build`
Expected: 에러 없이 `dist/` 생성

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.ts tsconfig.json tsconfig.node.json index.html src/main.tsx src/App.tsx src/vite-env.d.ts package-lock.json
git commit -m "chore: Vite + React + TypeScript + Vitest 프로젝트 셋업"
```

---

### Task 2: 타입 정의 + KB 스키마 검증

**Files:**
- Create: `src/types.ts`, `src/lib/validateKb.ts`, `src/lib/validateKb.test.ts`

**Interfaces:**
- Produces:
  - `InteractionEntry` 타입 (id, drug_class, drug_ingredient[], supplement, severity, action_type, mechanism, recommendation, evidence_level, source, last_reviewed)
  - `Source` 타입 (db, id, url, retrieved_date, quote)
  - `validateKb(entries: unknown): InteractionEntry[]` — 검증 통과한 엔트리 반환, 실패 시 throw. 전 엔트리에 `evidence_level` 강제.

- [ ] **Step 1: 타입 정의 작성**

`src/types.ts`:
```typescript
export type Severity = 'high' | 'medium' | 'low'
export type ActionType = 'avoid' | 'monitor' | 'spacing'
export type EvidenceLevel = '강' | '중' | '약'

export interface Source {
  db: string // 예: "PMC", "openFDA", "식약처"
  id: string // 예: "PMID:18205318"
  url: string
  retrieved_date: string // YYYY-MM-DD
  quote: string // 인용된 원문 한 줄
}

export interface InteractionEntry {
  id: string
  drug_class: string // lookup 키
  drug_ingredient: string[] // 표시용 성분 목록
  supplement: string // lookup 키
  severity: Severity
  action_type: ActionType
  mechanism: string // 한국어 기전 설명
  recommendation: string // 한국어 약사 행동 권고
  evidence_level: EvidenceLevel
  source: Source
  last_reviewed: string // YYYY-MM-DD
}

// 미스 시 출력 (cite-or-abstain 상수)
export interface AbstainResult {
  kind: 'abstain'
  message: string
}

export interface HitResult {
  kind: 'hit'
  entries: InteractionEntry[]
}

export type LookupResult = HitResult | AbstainResult
```

- [ ] **Step 2: validateKb 실패 테스트 작성**

`src/lib/validateKb.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { validateKb } from './validateKb'

describe('validateKb', () => {
  it('evidence_level 없는 엔트리를 거부한다', () => {
    const bad = [
      {
        id: 'x-001',
        drug_class: '항응고제/항혈소판제',
        drug_ingredient: ['warfarin'],
        supplement: '은행 (Ginkgo biloba)',
        severity: 'high',
        action_type: 'avoid',
        mechanism: '출혈 위험',
        recommendation: '권하지 말 것',
        // evidence_level 누락
        source: { db: 'PMC', id: 'PMID:1', url: 'http://x', retrieved_date: '2026-06-21', quote: 'q' },
        last_reviewed: '2026-06-21',
      },
    ]
    expect(() => validateKb(bad)).toThrow(/evidence_level/)
  })

  it('필수 필드를 모두 갖춘 엔트리를 통과시킨다', () => {
    const good = [
      {
        id: 'anticoag-ginkgo-001',
        drug_class: '항응고제/항혈소판제',
        drug_ingredient: ['warfarin', 'apixaban'],
        supplement: '은행 (Ginkgo biloba)',
        severity: 'high',
        action_type: 'avoid',
        mechanism: '혈소판 응집 억제 상가작용으로 출혈 위험 증가',
        recommendation: '병용 시 출혈 위험 증가. 환자에게 권하지 말 것.',
        evidence_level: '중',
        source: { db: 'PMC', id: 'PMID:18205318', url: 'https://pubmed.ncbi.nlm.nih.gov/18205318/', retrieved_date: '2026-06-21', quote: 'Ginkgo may increase bleeding risk.' },
        last_reviewed: '2026-06-21',
      },
    ]
    const result = validateKb(good)
    expect(result).toHaveLength(1)
    expect(result[0].evidence_level).toBe('중')
  })

  it('source.url 없는 엔트리를 거부한다 (cite-or-abstain은 인용을 강제)', () => {
    const bad = [
      {
        id: 'x-002', drug_class: 'a', drug_ingredient: ['x'], supplement: 's',
        severity: 'low', action_type: 'monitor', mechanism: 'm', recommendation: 'r',
        evidence_level: '약', source: { db: 'PMC', id: 'PMID:1', url: '', retrieved_date: '2026-06-21', quote: 'q' },
        last_reviewed: '2026-06-21',
      },
    ]
    expect(() => validateKb(bad)).toThrow(/source/)
  })
})
```

- [ ] **Step 3: 테스트 실행해 실패 확인**

Run: `npm test -- validateKb`
Expected: FAIL ("validateKb is not a function" 또는 import 에러)

- [ ] **Step 4: validateKb 구현**

`src/lib/validateKb.ts`:
```typescript
import type { InteractionEntry, Severity, ActionType, EvidenceLevel } from '../types'

const SEVERITIES: Severity[] = ['high', 'medium', 'low']
const ACTIONS: ActionType[] = ['avoid', 'monitor', 'spacing']
const EVIDENCE: EvidenceLevel[] = ['강', '중', '약']

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

export function validateKb(entries: unknown): InteractionEntry[] {
  if (!Array.isArray(entries)) {
    throw new Error('KB는 배열이어야 합니다')
  }
  return entries.map((e, i) => {
    const ctx = `엔트리 #${i}`
    if (typeof e !== 'object' || e === null) throw new Error(`${ctx}: 객체가 아님`)
    const entry = e as Record<string, unknown>

    if (!isNonEmptyString(entry.id)) throw new Error(`${ctx}: id 누락`)
    if (!isNonEmptyString(entry.drug_class)) throw new Error(`${ctx}: drug_class 누락`)
    if (!Array.isArray(entry.drug_ingredient) || entry.drug_ingredient.length === 0)
      throw new Error(`${ctx}: drug_ingredient 누락`)
    if (!isNonEmptyString(entry.supplement)) throw new Error(`${ctx}: supplement 누락`)
    if (!SEVERITIES.includes(entry.severity as Severity)) throw new Error(`${ctx}: severity 부적합`)
    if (!ACTIONS.includes(entry.action_type as ActionType)) throw new Error(`${ctx}: action_type 부적합`)
    if (!isNonEmptyString(entry.mechanism)) throw new Error(`${ctx}: mechanism 누락`)
    if (!isNonEmptyString(entry.recommendation)) throw new Error(`${ctx}: recommendation 누락`)
    // 근거 강도 라벨은 전 엔트리 강제 (Global Constraint)
    if (!EVIDENCE.includes(entry.evidence_level as EvidenceLevel))
      throw new Error(`${ctx}: evidence_level 누락 또는 부적합 (강/중/약 필수)`)
    // cite-or-abstain: 인용 출처 강제
    const src = entry.source as Record<string, unknown> | undefined
    if (!src || !isNonEmptyString(src.url) || !isNonEmptyString(src.id))
      throw new Error(`${ctx}: source.url/id 누락 (인용 필수)`)
    if (!isNonEmptyString(entry.last_reviewed)) throw new Error(`${ctx}: last_reviewed 누락`)

    return entry as unknown as InteractionEntry
  })
}
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npm test -- validateKb`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/validateKb.ts src/lib/validateKb.test.ts
git commit -m "feat: 상호작용 엔트리 타입 + KB 스키마 검증 (evidence_level/인용 강제)"
```

---

### Task 3: 결정론적 lookup + cite-or-abstain (핵심 안전 함수)

**Files:**
- Create: `src/lib/lookup.ts`, `src/lib/lookup.test.ts`

**Interfaces:**
- Consumes: `InteractionEntry`, `LookupResult` (Task 2)
- Produces:
  - `ABSTAIN_MESSAGE: string` 상수 = `"검색한 자료 내 문서화된 상호작용 없음 — 안전하다는 의미가 아닙니다. 약사 판단 필요."`
  - `lookup(kb: InteractionEntry[], drugClass: string, supplement: string): LookupResult` — 히트 시 `{kind:'hit', entries}`, 미스 시 `{kind:'abstain', message: ABSTAIN_MESSAGE}`. 순수 함수, LLM 없음.

- [ ] **Step 1: lookup 테스트 작성 (히트 + 기권 둘 다)**

`src/lib/lookup.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { lookup, ABSTAIN_MESSAGE } from './lookup'
import type { InteractionEntry } from '../types'

const KB: InteractionEntry[] = [
  {
    id: 'anticoag-ginkgo-001',
    drug_class: '항응고제/항혈소판제',
    drug_ingredient: ['warfarin', 'apixaban', 'aspirin', 'clopidogrel'],
    supplement: '은행 (Ginkgo biloba)',
    severity: 'high',
    action_type: 'avoid',
    mechanism: '혈소판 응집 억제 및 항응고 효과 상가작용으로 출혈 위험 증가',
    recommendation: '병용 시 출혈 위험 증가. 환자에게 권하지 말 것.',
    evidence_level: '중',
    source: { db: 'PMC', id: 'PMID:18205318', url: 'https://pubmed.ncbi.nlm.nih.gov/18205318/', retrieved_date: '2026-06-21', quote: 'Ginkgo may increase bleeding risk.' },
    last_reviewed: '2026-06-21',
  },
  {
    id: 'thyroid-calcium-001',
    drug_class: '갑상선약',
    drug_ingredient: ['levothyroxine'],
    supplement: '칼슘',
    severity: 'medium',
    action_type: 'spacing',
    mechanism: '칼슘이 levothyroxine 흡수를 저해 (chelation)',
    recommendation: '2-4시간 간격을 두고 복용하도록 안내.',
    evidence_level: '강',
    source: { db: 'openFDA', id: 'label:levothyroxine', url: 'https://open.fda.gov/', retrieved_date: '2026-06-21', quote: 'Calcium reduces levothyroxine absorption.' },
    last_reviewed: '2026-06-21',
  },
]

describe('lookup', () => {
  it('히트 시 저장된 엔트리를 인용과 함께 반환한다', () => {
    const r = lookup(KB, '항응고제/항혈소판제', '은행 (Ginkgo biloba)')
    expect(r.kind).toBe('hit')
    if (r.kind === 'hit') {
      expect(r.entries).toHaveLength(1)
      expect(r.entries[0].severity).toBe('high')
      expect(r.entries[0].source.url).toContain('pubmed')
    }
  })

  it('미스 시 정확한 기권 상수를 반환한다 (절대 "안전함" 아님)', () => {
    const r = lookup(KB, '항응고제/항혈소판제', '비타민C')
    expect(r.kind).toBe('abstain')
    if (r.kind === 'abstain') {
      expect(r.message).toBe(ABSTAIN_MESSAGE)
      expect(r.message).not.toContain('안전함')
      expect(r.message).toContain('약사 판단 필요')
    }
  })

  it('spacing action_type 엔트리도 정확히 히트한다', () => {
    const r = lookup(KB, '갑상선약', '칼슘')
    expect(r.kind).toBe('hit')
    if (r.kind === 'hit') {
      expect(r.entries[0].action_type).toBe('spacing')
    }
  })

  it('같은 클래스×보조제에 여러 엔트리가 있으면 모두 반환한다', () => {
    const multi: InteractionEntry[] = [
      ...KB,
      { ...KB[0], id: 'anticoag-ginkgo-002', evidence_level: '약', source: { ...KB[0].source, id: 'PMID:99999' } },
    ]
    const r = lookup(multi, '항응고제/항혈소판제', '은행 (Ginkgo biloba)')
    expect(r.kind).toBe('hit')
    if (r.kind === 'hit') expect(r.entries).toHaveLength(2)
  })

  it('빈 KB에서는 항상 기권한다', () => {
    const r = lookup([], '항응고제/항혈소판제', '은행 (Ginkgo biloba)')
    expect(r.kind).toBe('abstain')
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm test -- lookup`
Expected: FAIL ("lookup is not a function")

- [ ] **Step 3: lookup 구현**

`src/lib/lookup.ts`:
```typescript
import type { InteractionEntry, LookupResult } from '../types'

// cite-or-abstain 상수 — 미스 시 정확히 이 문구. 절대 생성하지 않음, 절대 "안전함" 아님.
export const ABSTAIN_MESSAGE =
  '검색한 자료 내 문서화된 상호작용 없음 — 안전하다는 의미가 아닙니다. 약사 판단 필요.'

/**
 * 결정론적 closed-set lookup. drug_class × supplement 정확 일치.
 * 히트 → 저장된 인용 엔트리 반환. 미스 → 기권 상수.
 * 순수 함수. 런타임 LLM/외부 API 없음.
 */
export function lookup(
  kb: InteractionEntry[],
  drugClass: string,
  supplement: string,
): LookupResult {
  const entries = kb.filter(
    (e) => e.drug_class === drugClass && e.supplement === supplement,
  )
  if (entries.length === 0) {
    return { kind: 'abstain', message: ABSTAIN_MESSAGE }
  }
  return { kind: 'hit', entries }
}
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npm test -- lookup`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/lookup.ts src/lib/lookup.test.ts
git commit -m "feat: 결정론적 lookup + cite-or-abstain 핵심 안전 함수"
```

---

### Task 4: 통제 어휘 + 앵커 KB 데이터

**Files:**
- Create: `src/data/vocabulary.ts`, `src/data/interactions.json`
- Test: `src/data/interactions.test.ts`

**Interfaces:**
- Consumes: `validateKb` (Task 2), `lookup` (Task 3)
- Produces:
  - `DRUG_CLASSES: string[]` — 드롭다운용 약물 클래스 목록
  - `SUPPLEMENTS: string[]` — 드롭다운용 건기식/식품 목록
  - `src/data/interactions.json` — 검증을 통과하는 앵커 엔트리 배열 (최소 항응고제×한약 클러스터 6개 + 흔한 노인 케이스 ~4개로 시작; 약사가 진료하며 30~50개까지 확장)

> **약사 작성 노트:** 이 JSON은 *약사 본인이 인용 출처를 읽고 검증해 채우는 제품의 핵심 자산*이다. 아래는 스키마 검증을 통과하는 시드 엔트리. Claude Code가 출처에서 엔트리를 드래프트할 수 있으나, **약사가 source.quote를 원문과 대조하고 last_reviewed에 서명한 것만 커밋한다.** 빌드 시에만 LLM 사용, 런타임 LLM 없음.

- [ ] **Step 1: KB 검증 통과 테스트 작성**

`src/data/interactions.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { validateKb } from '../lib/validateKb'
import { lookup } from '../lib/lookup'
import { DRUG_CLASSES, SUPPLEMENTS } from './vocabulary'
import kb from './interactions.json'

describe('앵커 KB', () => {
  it('전체 KB가 스키마 검증을 통과한다 (전 엔트리 evidence_level + 인용)', () => {
    expect(() => validateKb(kb)).not.toThrow()
  })

  it('앵커 클러스터(항응고제×은행)가 존재하고 히트한다', () => {
    const valid = validateKb(kb)
    const r = lookup(valid, '항응고제/항혈소판제', '은행 (Ginkgo biloba)')
    expect(r.kind).toBe('hit')
  })

  it('KB의 모든 drug_class가 통제 어휘에 존재한다', () => {
    const valid = validateKb(kb)
    for (const e of valid) {
      expect(DRUG_CLASSES).toContain(e.drug_class)
    }
  })

  it('KB의 모든 supplement가 통제 어휘에 존재한다', () => {
    const valid = validateKb(kb)
    for (const e of valid) {
      expect(SUPPLEMENTS).toContain(e.supplement)
    }
  })
})
```

- [ ] **Step 2: 통제 어휘 작성**

`src/data/vocabulary.ts`:
```typescript
// 드롭다운 통제 어휘. lookup 키가 KB 키와 정확히 일치하도록 단일 출처.
// 자유 텍스트 NLP 트랩을 피하기 위해 고정 목록 사용.

export const DRUG_CLASSES: string[] = [
  '항응고제/항혈소판제',
  '갑상선약',
  '티아지드 이뇨제',
  '당뇨약',
  '퀴놀론·테트라사이클린 항생제',
  '면역억제제',
  '위장약(제산제/PPI)',
  '혈압약',
]

export const SUPPLEMENTS: string[] = [
  '은행 (Ginkgo biloba)',
  '홍삼',
  '마늘',
  '나토키나제',
  '단삼 (Danshen)',
  '당귀 (Dong quai)',
  '칼슘',
  '마그네슘',
  '철분',
  '비타민D',
  '비타민K (녹황색채소 다량)',
  '오메가3',
  '프로바이오틱스',
]
```

- [ ] **Step 3: 앵커 KB 시드 작성**

`src/data/interactions.json`:
```json
[
  {
    "id": "anticoag-ginkgo-001",
    "drug_class": "항응고제/항혈소판제",
    "drug_ingredient": ["warfarin", "apixaban", "aspirin", "clopidogrel"],
    "supplement": "은행 (Ginkgo biloba)",
    "severity": "high",
    "action_type": "avoid",
    "mechanism": "혈소판 응집 억제 및 항응고 효과 상가작용으로 출혈 위험 증가",
    "recommendation": "병용 시 출혈 위험 증가. 환자에게 권하지 말 것. 이미 복용 중이면 멍·출혈 징후 모니터링 및 처방의 상담.",
    "evidence_level": "중",
    "source": {
      "db": "PMC",
      "id": "PMID:18205318",
      "url": "https://pubmed.ncbi.nlm.nih.gov/18205318/",
      "retrieved_date": "2026-06-21",
      "quote": "Ginkgo may increase bleeding risk when combined with anticoagulant/antiplatelet agents."
    },
    "last_reviewed": "2026-06-21"
  },
  {
    "id": "anticoag-danshen-001",
    "drug_class": "항응고제/항혈소판제",
    "drug_ingredient": ["warfarin"],
    "supplement": "단삼 (Danshen)",
    "severity": "high",
    "action_type": "avoid",
    "mechanism": "단삼이 와파린 대사·항응고 효과를 증강하여 출혈 위험 및 INR 상승",
    "recommendation": "병용 시 출혈 위험 증가. 권하지 말 것. 복용 중이면 INR 모니터링 및 처방의 상담.",
    "evidence_level": "중",
    "source": {
      "db": "PMC",
      "id": "PMID:11304750",
      "url": "https://pubmed.ncbi.nlm.nih.gov/11304750/",
      "retrieved_date": "2026-06-21",
      "quote": "Danshen potentiates the anticoagulant effect of warfarin."
    },
    "last_reviewed": "2026-06-21"
  },
  {
    "id": "anticoag-dongquai-001",
    "drug_class": "항응고제/항혈소판제",
    "drug_ingredient": ["warfarin"],
    "supplement": "당귀 (Dong quai)",
    "severity": "high",
    "action_type": "avoid",
    "mechanism": "당귀의 쿠마린 성분이 항응고 효과 상가작용으로 출혈 위험 증가",
    "recommendation": "병용 시 출혈 위험 증가. 권하지 말 것. INR 모니터링 권고.",
    "evidence_level": "약",
    "source": {
      "db": "PMC",
      "id": "PMID:10215842",
      "url": "https://pubmed.ncbi.nlm.nih.gov/10215842/",
      "retrieved_date": "2026-06-21",
      "quote": "Dong quai may potentiate warfarin via coumarin constituents (case report)."
    },
    "last_reviewed": "2026-06-21"
  },
  {
    "id": "anticoag-garlic-001",
    "drug_class": "항응고제/항혈소판제",
    "drug_ingredient": ["warfarin", "aspirin", "clopidogrel"],
    "supplement": "마늘",
    "severity": "medium",
    "action_type": "monitor",
    "mechanism": "마늘 고용량이 혈소판 응집을 억제하여 출혈 위험 가산",
    "recommendation": "치료 용량 마늘 보조제 병용 시 출혈 징후 모니터링. 식이 수준은 일반적으로 문제 없음.",
    "evidence_level": "약",
    "source": {
      "db": "PMC",
      "id": "PMID:11349832",
      "url": "https://pubmed.ncbi.nlm.nih.gov/11349832/",
      "retrieved_date": "2026-06-21",
      "quote": "High-dose garlic supplements may increase bleeding risk with antiplatelet agents."
    },
    "last_reviewed": "2026-06-21"
  },
  {
    "id": "anticoag-nattokinase-001",
    "drug_class": "항응고제/항혈소판제",
    "drug_ingredient": ["warfarin", "apixaban"],
    "supplement": "나토키나제",
    "severity": "high",
    "action_type": "avoid",
    "mechanism": "나토키나제의 섬유소 용해·항응고 작용이 출혈 위험 상가",
    "recommendation": "병용 시 출혈 위험 증가. 권하지 말 것. 복용 중이면 출혈 징후 모니터링.",
    "evidence_level": "약",
    "source": {
      "db": "PMC",
      "id": "PMID:28735826",
      "url": "https://pubmed.ncbi.nlm.nih.gov/28735826/",
      "retrieved_date": "2026-06-21",
      "quote": "Nattokinase has fibrinolytic activity; caution with anticoagulants."
    },
    "last_reviewed": "2026-06-21"
  },
  {
    "id": "anticoag-redginseng-001",
    "drug_class": "항응고제/항혈소판제",
    "drug_ingredient": ["warfarin"],
    "supplement": "홍삼",
    "severity": "medium",
    "action_type": "monitor",
    "mechanism": "인삼이 와파린의 항응고 효과를 감소시킬 수 있음(INR 저하 보고)",
    "recommendation": "병용 시 INR 변동 모니터링. 와파린 효과 감소 가능성 주의.",
    "evidence_level": "중",
    "source": {
      "db": "PMC",
      "id": "PMID:15613931",
      "url": "https://pubmed.ncbi.nlm.nih.gov/15613931/",
      "retrieved_date": "2026-06-21",
      "quote": "Ginseng may reduce the anticoagulant effect of warfarin (decreased INR)."
    },
    "last_reviewed": "2026-06-21"
  },
  {
    "id": "thyroid-calcium-001",
    "drug_class": "갑상선약",
    "drug_ingredient": ["levothyroxine"],
    "supplement": "칼슘",
    "severity": "medium",
    "action_type": "spacing",
    "mechanism": "칼슘이 levothyroxine 흡수를 저해 (chelation)",
    "recommendation": "최소 4시간 간격을 두고 복용하도록 안내.",
    "evidence_level": "강",
    "source": {
      "db": "openFDA",
      "id": "label:levothyroxine-calcium",
      "url": "https://open.fda.gov/apis/drug/label/",
      "retrieved_date": "2026-06-21",
      "quote": "Calcium carbonate reduces levothyroxine absorption; separate administration."
    },
    "last_reviewed": "2026-06-21"
  },
  {
    "id": "thyroid-iron-001",
    "drug_class": "갑상선약",
    "drug_ingredient": ["levothyroxine"],
    "supplement": "철분",
    "severity": "medium",
    "action_type": "spacing",
    "mechanism": "철분이 levothyroxine와 복합체 형성으로 흡수 저해",
    "recommendation": "최소 4시간 간격을 두고 복용하도록 안내.",
    "evidence_level": "강",
    "source": {
      "db": "openFDA",
      "id": "label:levothyroxine-iron",
      "url": "https://open.fda.gov/apis/drug/label/",
      "retrieved_date": "2026-06-21",
      "quote": "Iron salts reduce levothyroxine absorption; separate administration."
    },
    "last_reviewed": "2026-06-21"
  },
  {
    "id": "quinolone-calcium-001",
    "drug_class": "퀴놀론·테트라사이클린 항생제",
    "drug_ingredient": ["ciprofloxacin", "levofloxacin", "doxycycline"],
    "supplement": "칼슘",
    "severity": "medium",
    "action_type": "spacing",
    "mechanism": "칼슘 등 다가양이온이 퀴놀론·테트라사이클린과 chelation으로 흡수 저해",
    "recommendation": "항생제 복용 2시간 전 또는 4-6시간 후로 칼슘 간격을 두도록 안내.",
    "evidence_level": "강",
    "source": {
      "db": "openFDA",
      "id": "label:ciprofloxacin-cation",
      "url": "https://open.fda.gov/apis/drug/label/",
      "retrieved_date": "2026-06-21",
      "quote": "Divalent cations chelate fluoroquinolones/tetracyclines, reducing absorption."
    },
    "last_reviewed": "2026-06-21"
  },
  {
    "id": "anticoag-vitk-001",
    "drug_class": "항응고제/항혈소판제",
    "drug_ingredient": ["warfarin"],
    "supplement": "비타민K (녹황색채소 다량)",
    "severity": "medium",
    "action_type": "monitor",
    "mechanism": "비타민K가 와파린의 항응고 효과를 길항하여 INR 저하",
    "recommendation": "녹황색채소 섭취량을 일정하게 유지하도록 안내. 급격한 변화 시 INR 모니터링.",
    "evidence_level": "강",
    "source": {
      "db": "openFDA",
      "id": "label:warfarin-vitamink",
      "url": "https://open.fda.gov/apis/drug/label/",
      "retrieved_date": "2026-06-21",
      "quote": "Vitamin K antagonizes warfarin; maintain consistent dietary intake."
    },
    "last_reviewed": "2026-06-21"
  }
]
```

> **참고:** 위 PMID/출처는 약사가 실제로 PubMed/openFDA에서 대조·검증해야 하는 *시드 자리표시*다. quote가 원문과 일치하는지 약사가 확인한 뒤에만 last_reviewed에 서명한다. 빌드 시 Claude Code가 추가 엔트리를 드래프트할 수 있다.

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npm test -- interactions`
Expected: PASS (4 tests). 만약 어휘 불일치로 실패하면 vocabulary.ts와 JSON의 키 문자열을 정확히 일치시킨다.

- [ ] **Step 5: Commit**

```bash
git add src/data/vocabulary.ts src/data/interactions.json src/data/interactions.test.ts
git commit -m "feat: 통제 어휘 + 앵커 KB 시드(항응고제×한약 클러스터 + 노인 spacing 케이스)"
```

---

### Task 5: 결과 카드 컴포넌트 (히트/기권 렌더)

**Files:**
- Create: `src/components/ResultCard.tsx`

**Interfaces:**
- Consumes: `LookupResult`, `InteractionEntry` (Task 2), `ABSTAIN_MESSAGE` 개념 (Task 3)
- Produces: `<ResultCard result={LookupResult} />` — 히트 시 각 엔트리를 심각도 배지·action_type·기전·권고·근거강도·인용 링크와 함께 렌더; 기권 시 기권 메시지를 명확히 렌더. 검증/미검증 구분은 1단계엔 모두 "검증(큐레이션)"이므로 검증 배지만.

- [ ] **Step 1: ResultCard 구현**

`src/components/ResultCard.tsx`:
```typescript
import type { LookupResult, InteractionEntry, Severity, ActionType } from '../types'

const SEVERITY_LABEL: Record<Severity, string> = {
  high: '🔴 높음',
  medium: '🟡 중간',
  low: '⚪ 낮음',
}

const ACTION_LABEL: Record<ActionType, string> = {
  avoid: '권하지 말 것',
  monitor: '모니터링',
  spacing: '복용 간격 두기',
}

function EntryCard({ entry }: { entry: InteractionEntry }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{SEVERITY_LABEL[entry.severity]}</strong>
        <span style={{ background: '#eef', padding: '2px 8px', borderRadius: 4 }}>
          {ACTION_LABEL[entry.action_type]}
        </span>
        <span style={{ background: '#efe', padding: '2px 8px', borderRadius: 4 }}>
          ✅ 검증됨 · 근거강도 {entry.evidence_level}
        </span>
      </div>
      <p style={{ margin: '8px 0' }}>
        <strong>{entry.drug_class}</strong> × <strong>{entry.supplement}</strong>
      </p>
      <p style={{ margin: '4px 0' }}>{entry.mechanism}</p>
      <p style={{ margin: '4px 0', fontWeight: 600 }}>{entry.recommendation}</p>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: '#555' }}>
        근거:{' '}
        <a href={entry.source.url} target="_blank" rel="noopener noreferrer">
          {entry.source.db} {entry.source.id}
        </a>{' '}
        — "{entry.source.quote}" (확인일 {entry.source.retrieved_date})
      </p>
    </div>
  )
}

export function ResultCard({ result }: { result: LookupResult }) {
  if (result.kind === 'abstain') {
    return (
      <div
        style={{
          border: '1px dashed #999',
          borderRadius: 8,
          padding: 16,
          background: '#fafafa',
          color: '#444',
        }}
      >
        {result.message}
      </div>
    )
  }
  return (
    <div>
      {result.entries.map((e) => (
        <EntryCard key={e.id} entry={e} />
      ))}
    </div>
  )
}
```

> 참고: 1단계는 인라인 스타일로 충분하다(단일 화면). 본격 디자인은 design-review 단계에서. 스타일 토큰화는 화면이 늘어날 때 도입.

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: 타입 에러 없이 빌드 성공

- [ ] **Step 3: Commit**

```bash
git add src/components/ResultCard.tsx
git commit -m "feat: 결과 카드 컴포넌트 (히트=인용/근거강도, 기권=명시 메시지)"
```

---

### Task 6: 메인 체커 UI + 약사 검토 게이트 명시

**Files:**
- Create: `src/components/InteractionChecker.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `DRUG_CLASSES`, `SUPPLEMENTS` (Task 4), `lookup` (Task 3), `validateKb` (Task 2), `interactions.json` (Task 4), `ResultCard` (Task 5)
- Produces: `<InteractionChecker />` — 약물 클래스 + 건기식 드롭다운, "확인" 버튼, 결과 표시. 약사 검토 전제 문구 명시. App에 마운트.

- [ ] **Step 1: InteractionChecker 구현**

`src/components/InteractionChecker.tsx`:
```typescript
import { useMemo, useState } from 'react'
import { validateKb } from '../lib/validateKb'
import { lookup } from '../lib/lookup'
import { DRUG_CLASSES, SUPPLEMENTS } from '../data/vocabulary'
import { ResultCard } from './ResultCard'
import type { LookupResult } from '../types'
import rawKb from '../data/interactions.json'

export function InteractionChecker() {
  // KB는 앱 로드 시 1회 검증 (스키마 위반은 빌드/로드 시 즉시 드러남)
  const kb = useMemo(() => validateKb(rawKb), [])
  const [drugClass, setDrugClass] = useState('')
  const [supplement, setSupplement] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)

  const canCheck = drugClass !== '' && supplement !== ''

  function handleCheck() {
    if (!canCheck) return
    setResult(lookup(kb, drugClass, supplement))
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>건기식 상호작용 체커</h1>
      <p style={{ color: '#666', fontSize: 14 }}>
        환자 처방약 × 추천 건기식/식품의 문서화된 상호작용을 확인합니다. 이 도구는{' '}
        <strong>정보 제공용</strong>이며, 최종 판단은 약사가 합니다.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
        <label>
          처방약 클래스
          <br />
          <select value={drugClass} onChange={(e) => setDrugClass(e.target.value)}>
            <option value="">— 선택 —</option>
            {DRUG_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          추천 건기식/식품
          <br />
          <select value={supplement} onChange={(e) => setSupplement(e.target.value)}>
            <option value="">— 선택 —</option>
            {SUPPLEMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button onClick={handleCheck} disabled={!canCheck} style={{ alignSelf: 'flex-end' }}>
          확인
        </button>
      </div>

      {result && <ResultCard result={result} />}
    </main>
  )
}
```

- [ ] **Step 2: App.tsx 수정**

`src/App.tsx`:
```typescript
import { InteractionChecker } from './components/InteractionChecker'

export default function App() {
  return <InteractionChecker />
}
```

- [ ] **Step 3: 빌드 + 수동 검증**

Run: `npm run build && npm run dev`
Expected: 빌드 성공. dev 서버에서 항응고제/항혈소판제 × 은행 선택 → 확인 → 빨강 높음 + 인용 카드. 항응고제 × 비타민D 선택 → 확인 → 기권 메시지.

- [ ] **Step 4: 전체 테스트 실행**

Run: `npm test`
Expected: PASS (모든 단위 테스트 — validateKb 3 + lookup 5 + interactions 4 = 12)

- [ ] **Step 5: Commit**

```bash
git add src/components/InteractionChecker.tsx src/App.tsx
git commit -m "feat: 메인 체커 UI (드롭다운 입력 + 약사 검토 전제 명시)"
```

---

## Self-Review

**Spec coverage (design doc 대비):**
- ✅ cite-or-abstain → Task 3 (ABSTAIN_MESSAGE 상수 + 테스트가 "안전함" 부재 검증)
- ✅ 쿼리 시 LLM 없음 → Task 3 lookup은 순수 함수
- ✅ 근거강도 라벨 전 엔트리 강제 → Task 2 validateKb + Task 5 렌더
- ✅ 앵커 = 항응고제×한약 클러스터 → Task 4 KB 시드 6개 한약 엔트리
- ✅ 드롭다운(자유텍스트 NLP 트랩 회피) → Task 4 통제 어휘 + Task 6 select
- ✅ 약사 검토 전제(SaMD 회피) → Task 6 UI 문구
- ✅ 로컬 전용(PHI) → 전 태스크 네트워크/저장 없음
- ✅ 핵심 두 함수 단위 테스트 → Task 3 (lookup + 기권 fallback)
- ⏭️ 2단계 이후 (RAG, entailment, 환자 메모리, 큐레이션 콘솔, 비식별 튜플) → 본 플랜 범위 밖 (의도적)

**Placeholder scan:** 모든 코드 스텝에 완전한 코드 포함. interactions.json의 PMID는 약사 검증 대상 시드로 명시(자리표시지만 의도적·문서화됨).

**Type consistency:** `InteractionEntry`/`LookupResult`/`ABSTAIN_MESSAGE`/`lookup`/`validateKb`/`DRUG_CLASSES`/`SUPPLEMENTS` 명명이 전 태스크에서 일치. `action_type` 값(avoid/monitor/spacing)이 타입·KB·렌더에서 일관.

---

## Out of Scope (의도적 — 2단계 이후)

- 공공 소스 ingestion 파이프라인 + 롱테일 RAG
- entailment 검증 가드레일 (진짜 빌드 절벽 — 별도 플랜)
- 환자 메모리(재방문) + PHI 저장 명세
- 큐레이션 콘솔 (candidate→verified 승급)
- 비식별 튜플 방출(플라이휠) + 중앙 집계
- PM2000/UTOPIA 통합, OCR/클립보드
- 본격 디자인 시스템 (design-review 단계)
- 브랜드명→성분 alias 테이블 (현재는 클래스 드롭다운으로 우회)

## 병행 작업 (코딩과 별개)

- **The Assignment**: 동료 맞춤형 건기식 약사 5~10명 인터뷰 — (a)약물×건기식 불확실성 실제·빈번·미해결 검증, (b)상담 기록 의무 충족 현황. B의 수개월 빌드 전/중 수행.
