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

// 자동 검증(기계) 결과 메타. verified(약사 사인오프)와 분리된 티어.
export interface AutoReview {
  status: 'pass' | 'fail' // pass = PubMed 실존 + 의미일치
  pmid: string // 대조한 PMID (예: "PMID:11302416")
  evidence_sentence: string // abstract에서 그대로 추출한 근거 문장
  direction_match: boolean // 엔트리 주장 방향과 abstract 방향 일치 여부
  reason: string // fail 시 사유
  reviewed_date: string // YYYY-MM-DD
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
  // PubMed esearch용 영문 검색어. 한글 supplement는 PubMed에서 무시되므로 필수.
  // 예: "마늘" → "garlic Allium sativum". 없으면 검증 스크립트가 supplement 한글을 그대로 쓰며
  // 후보 정확도가 떨어진다(엉뚱한 약물 논문이 옴).
  supplement_en?: string
  // 기계 검증(PubMed 실존 + grounded 의미일치) 통과 여부. verified와 별개 티어 —
  // auto_verified=true 라도 lookup에는 노출되지 않는다. 약사 사인오프로만 verified 승격.
  auto_verified?: boolean
  auto_review?: AutoReview
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
