type Severity = 'high' | 'medium' | 'low';
type ActionType = 'avoid' | 'monitor' | 'spacing';
type EvidenceLevel = '강' | '중' | '약';
interface Source {
    db: string;
    id: string;
    url: string;
    retrieved_date: string;
    quote: string;
}
interface InteractionEntry {
    id: string;
    drug_class: string;
    drug_ingredient: string[];
    supplement: string;
    severity: Severity;
    action_type: ActionType;
    mechanism: string;
    recommendation: string;
    evidence_level: EvidenceLevel;
    source: Source;
    last_reviewed: string;
    verified: boolean;
}
interface AbstainResult {
    kind: 'abstain';
    message: string;
}
interface HitResult {
    kind: 'hit';
    entries: InteractionEntry[];
}
type LookupResult = HitResult | AbstainResult;

declare const ABSTAIN_MESSAGE: "\uAC80\uC0C9\uD55C \uC790\uB8CC \uB0B4 \uBB38\uC11C\uD654\uB41C \uC0C1\uD638\uC791\uC6A9 \uC5C6\uC74C \u2014 \uC548\uC804\uD558\uB2E4\uB294 \uC758\uBBF8\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uC57D\uC0AC \uD310\uB2E8 \uD544\uC694.";
/**
 * 결정론적 closed-set lookup. drug_class × supplement 정확 일치.
 * 히트 → 저장된 인용 엔트리 반환. 미스 → 기권 상수.
 * 순수 함수. 런타임 LLM/외부 API 없음.
 */
declare function lookup(kb: InteractionEntry[], drugClass: string, supplement: string): LookupResult;

declare function validateKb(entries: unknown): InteractionEntry[];

declare const DRUG_CLASSES: string[];
declare const SUPPLEMENTS: string[];

/**
 * 검증된 KB를 반환한다. 번들된 interactions.json 을 validateKb 로 통과시킨 결과만 노출.
 * 스키마 위반 시 즉시 throw (fail-loud). 소비자가 raw JSON 을 직접 import 하지 못하게 하는
 * 단일 진입점 — verified 게이트와 인용 강제를 보존한다.
 */
declare function loadKb(): InteractionEntry[];

export { ABSTAIN_MESSAGE, type AbstainResult, type ActionType, DRUG_CLASSES, type EvidenceLevel, type HitResult, type InteractionEntry, type LookupResult, SUPPLEMENTS, type Severity, type Source, loadKb, lookup, validateKb };
