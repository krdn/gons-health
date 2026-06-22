// PENDING(verified=false 또는 source.id=PENDING) 엔트리에 대해
// PubMed 후보 검색 + abstract 수집 → 판정 큐(verify-queue.json) 작성.
// 의미 판정은 이 큐를 읽는 LLM 단계가 수행한다(여기서 하지 않음 — 분리 불변식).
import { readFileSync, writeFileSync } from 'node:fs'
import { searchPubmed, fetchAbstract } from './pubmed'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
    // PubMed 무료 API rate limit(10 req/s) 회피 — 엔트리 사이 1초 대기
    await sleep(1000)
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
