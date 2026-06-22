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
    console.warn(`[warn] 승격 후보 아님(건너뜀): ${skipped.join(', ')} — auto_verified=true & verified=false 만 승격 가능`)
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
      console.log(`  ${x.id} | ${x.drug_class} x ${x.supplement}`)
      console.log(`    근거: ${x.pmid} — "${x.evidence_sentence.slice(0, 80)}..."`)
    }
    console.log(`\n승격: npm run verify:promote -- <id1,id2> 또는 all`)
    return
  }

  const promoteArg = arg === '--promote' ? process.argv[3] : arg
  const ids = promoteArg === 'all' ? listPromotable(kb).map((x) => x.id) : promoteArg.split(',')
  const next = promote(kb, ids, today())
  writeFileSync(kbPath, JSON.stringify(next, null, 2) + '\n')
  console.log(`승격 완료: ${ids.length}개 -> verified=true. 다음: npm test && npm run build 후 커밋.`)
}

main()
