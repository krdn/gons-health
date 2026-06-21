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
  // 인용 출처를 PubMed 등 1차문헌과 실제 대조해 제목·내용이 주장과 일치함을 확인한 경우에만 true.
  // verified=false 엔트리는 lookup에서 절대 반환되지 않음 → 약사가 보는 모든 경고는 검증+인용된 것.
  verified: boolean
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
