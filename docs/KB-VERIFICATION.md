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
