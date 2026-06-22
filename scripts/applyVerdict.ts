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

// import 시 자동 실행을 막아 테스트에서 mergeVerdict만 사용 가능하도록 한다.
// verdicts.json이 없는 환경(CI, 테스트)에서도 import할 수 있어야 한다.
import { pathToFileURL } from 'node:url'
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
