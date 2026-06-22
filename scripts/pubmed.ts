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
