// verdicts.json(LLM grounded 판정)을 interactions.json에 머지.
// auto_verified/auto_review만 갱신 — verified(금본위)는 절대 건드리지 않는다.
import { readFileSync, writeFileSync } from 'node:fs'
import { validateKb } from '../src/lib/validateKb'
import type { AutoReview } from '../src/types'

export interface Verdict {
  id: string
  status: 'pass' | 'fail'
  pmid: string
  evidence_sentence: string
  direction_match: boolean
  reason: string
}

/**
 * pmid 정규화: 숫자만 있는 bare pmid에 "PMID:" 접두를 붙인다.
 * LLM이 verify-queue.json의 candidate_pmids(bare 숫자)를 그대로 복사할 때
 * promote()의 URL 생성(`pmid.startsWith('PMID:')`)이 깨지는 것을 방지한다.
 * 빈 문자열은 그대로 유지 (fail 케이스).
 */
function normalizePmid(pmid: string): string {
  if (pmid && !/^PMID:/.test(pmid) && /^\d+$/.test(pmid)) {
    return `PMID:${pmid}`
  }
  return pmid
}

/** 판정을 엔트리에 머지한 새 객체 반환 (불변). verified는 건드리지 않음.
 *
 * 안전 규칙: pass 판정이라도 evidence_sentence가 비어 있으면 auto_verified=false로 강등한다.
 * 강등 시 status도 'fail'로 기록해 validateKb(pass 브랜치: pmid·evidence_sentence 필수)를
 * 통과시킨다 — 빈 근거로 auto_verified=true가 되면 promote()가 낡은 PENDING quote를
 * verified 배지와 함께 stamping하는 환각 경로가 열린다.
 */
export function mergeVerdict<T extends Record<string, any>>(
  entry: T,
  v: Verdict,
  reviewedDate: string,
): T & { auto_verified: boolean; auto_review: AutoReview } {
  const normalizedPmid = normalizePmid(v.pmid)
  // pass이지만 근거 문장이 없으면 강등: status→fail, auto_verified→false
  const isEffectivePass = v.status === 'pass' && v.evidence_sentence.trim() !== ''
  const effectiveStatus = isEffectivePass ? 'pass' : 'fail'
  const effectiveReason = !isEffectivePass && v.status === 'pass'
    ? `[강등: evidence_sentence 누락, pass→fail] ${v.reason}`.trim()
    : v.reason

  return {
    ...entry,
    auto_verified: isEffectivePass,
    auto_review: {
      status: effectiveStatus,
      pmid: normalizedPmid,
      evidence_sentence: v.evidence_sentence,
      direction_match: v.direction_match,
      reason: effectiveReason,
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

  // write 전 스키마 자체검증 — 위반 시 throw로 드러내 on-disk KB 오염을 방지한다
  validateKb(next)
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
