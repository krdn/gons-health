# KB 자동 검증 파이프라인 통합 (m2 완료) 설계

**날짜:** 2026-06-27
**상태:** 설계 확정 → 통합 실행 대기
**범위:** m2 마일스톤 "KB 자동 검증 파이프라인"을 `parked` → `done`으로 완료.

## 1. 배경 — 이건 신규 구현이 아니라 통합이다

m2는 백지가 아니다. `kb-auto-verify-isolated` 브랜치에 **4라운드 리뷰를 거친 설계·구현이 이미 완성**돼 있다. 그러나 main이 그 사이 25커밋(살아있는 대시보드 + milestone-drift)을 앞서가면서 isolated가 **stale 상태로 격리**됐고, 그래서 마일스톤이 `parked`로 잡혀 있었다.

따라서 m2 "완료"의 실제 작업은 **"검증된 stale 브랜치를 현재 main에 통합 + 완료 처리"**다.

### 1.1 두 m2 브랜치

| 브랜치 | 내용 | 결정 |
|---|---|---|
| `feat/kb-auto-verification` | pubmed 래퍼 + 타입/검증까지 (5커밋) | **폐기** — isolated의 부분집합 |
| `kb-auto-verify-isolated` | feat 전체 + verifyKb·applyVerdict·promoteQueue (10커밋) | **통합 대상** (superset) |

### 1.2 머지 실측 (`git merge-tree --write-tree main kb-auto-verify-isolated`)

stale 브랜치라 "대시보드가 날아간다"는 우려가 있었으나, 3-way 머지 실측 결과 **양성(benign)**으로 확정:

- **충돌(내용) 3개뿐** — 전부 "양쪽이 같은 영역에 다른 항목 추가" = 합집합으로 해소:
  - `.gitignore`: main `.dashboard-test-report.json` + isolated `verify-queue.json`/`verdicts.json`
  - `package.json`: main `dashboard`/`typecheck:scripts` + isolated `verify:kb`/`verify:apply`/`verify:promote` (tsx·@types/node는 양쪽 동일)
  - `dist/index.js.map`: 산출물 — 머지 후 `npm run build` 재빌드로 덮어씀
- **`interactions.json`: 자동 병합** (main의 verified 승격 + isolated의 supplement_en이 다른 줄)
- **대시보드 코드 전체(`scripts/dashboard/*`, `dashboard.html`): 충돌 없음 → 보존**

> 교훈: `git diff main..isolated`(two-dot 끝점 비교)는 main에만 있는 파일을 "삭제"로 오표시한다. stale 브랜치 통합 가능성은 반드시 `git merge-tree` 또는 스크래치 머지로 **실측**한다.

## 2. 통합할 파이프라인 아키텍처 (isolated 브랜치 — 확정 설계)

오프라인/개발타임 전용. **런타임 코어(`lookup`/`validateKb`)의 LLM·API 0 불변식을 그대로 유지**한다 — 파이프라인 코드는 전부 `scripts/`에만 둔다.

3스텝 반자동:

```
① 수집 (verifyKb.ts)        PENDING 엔트리 → PubMed esearch/efetch → verify-queue.json
② 판정 (사람/에이전트 인-루프)  큐의 abstract 원문을 읽고 grounded 판정 → verdicts.json
③ 머지 (applyVerdict.ts)     verdicts → interactions.json의 auto_verified/auto_review 갱신
④ 승격 (promoteQueue.ts)     auto_verified 엔트리를 약사가 CLI로 명시 승격 → verified
```

**핵심 안전 불변식 (코드에 이미 반영됨):**
- **금본위 보존**: `verified`는 약사 사인오프 전용. `auto_verified === true`라도 `verified`로 자동 승격 안 됨. `lookup()`의 verified 필터는 불변.
- **분리 티어**: 기계 검증 결과는 `auto_verified`/`auto_review`에만 기록. `lookup` 노출 0 (회귀 테스트로 못박음).
- **진실 소스 = PubMed**: PMID 실존·abstract 원문은 E-utilities로만 확인. LLM은 근거를 *생성*하지 않고 주어진 원문을 *판정*만 한다 (분리 불변식).
- **빈 근거 강등**: pass 판정이라도 `evidence_sentence`가 비면 `auto_verified=false`로 강등 (낡은 PENDING quote가 verified 배지를 다는 환각 경로 차단).
- **승격 시 quote 교체**: promote가 `source.quote`를 grounded 근거 문장으로 교체 (낡은 PENDING quote 제거).

## 3. "완료"의 범위 (사용자 확정: 도구 통합까지)

m2 완료 = **파이프라인이 도구로서 main에 통합 + 빌드·테스트 통과 + 문서화**.

**검증 실행(PENDING 5개에 파이프라인 실제 적용)은 범위 밖.** 현 PENDING 5개는 herbal(은행·홍삼·마늘·나토키나제·당귀)이고, 메모리 `kb-verification-20260622` + `project-state.json` rank-3이 **"새 1차문헌 없이 억지 승격 금지 — 그게 cite-or-abstain의 진짜 실패 모드"**로 못박은 바로 그 엔트리다. 파이프라인 완성이 이 5개를 verified로 미는 레버가 되어선 안 된다.

## 4. 통합 절차 (접근 A — 직접 머지, 이 세션 직접 실행)

1. main에서 작업 브랜치 분기 (`feat/kb-auto-verification-integration`).
2. `git merge kb-auto-verify-isolated` → 충돌 3개를 §1.2대로 합집합 해소.
3. 머지로 딸려온 문서 확인: isolated의 `2026-06-22-kb-auto-verification.md` plan이 추가되고(이력 보존), 현 main의 dashboard/milestone-drift 문서는 머지 후에도 그대로 존재해야 한다(실측상 충돌 없음). 머지 후 `ls docs/superpowers/{plans,specs}`로 무손실 확인.
4. `interactions.json` 확인: 자동 병합 결과가 verified 5개 + supplement_en 보강을 모두 담는지 검증.
5. `npm run build` (dist 재빌드) — KB·타입 변경 반영, dist 커밋 대상.
6. `npm test` + `npm run typecheck` + `npm run typecheck:scripts` 전부 GREEN 확인.
7. **완료 처리**: `project-state.json` m2 `parked` → `done` + `anchor`(머지 커밋 단축 해시), nextActions 재정렬, `npm run dashboard` 재생성.
8. milestone-drift 감지가 새 anchor를 정상 인식하는지 대시보드에서 확인.
9. `feat/kb-auto-verification`(폐기 대상) + `kb-auto-verify-isolated`(통합 완료) 브랜치 삭제.

## 5. 검증 기준 (완료 정의)

- [ ] `npm test` 전부 통과 (기존 + pubmed/applyVerdict/promoteQueue 테스트 포함)
- [ ] `npm run typecheck` + `npm run typecheck:scripts` 에러 0
- [ ] `npm run build` 성공, `dist/` 재빌드 커밋
- [ ] `npm run verify:kb` / `verify:apply` / `verify:promote` 가 package.json에 등록되고 도움말 출력 동작 (실제 PENDING 검증 실행은 안 함)
- [ ] 대시보드 코드(`scripts/dashboard/*`, `dashboard.html`) 무손실 보존
- [ ] `lookup()`은 여전히 verified만 반환 (auto_verified 노출 0 회귀 테스트 GREEN)
- [ ] `project-state.json` m2 = `done` + anchor, 대시보드에 드리프트 경고 없음
- [ ] KB verified 개수·PENDING 개수 변동 없음 (검증 실행 안 했으므로 5/10 유지)

## 6. 비범위 (명시)

- PENDING 5개의 실제 PubMed 검증·승격 (범위 밖, §3)
- `harness 입력 강화 스펙` 구현 (별도 작업, project-state rank-2)
- ResultCard에 auto_verified 티어 UI 노출 (lookup이 verified만 반환하므로 현 단계 불필요)
