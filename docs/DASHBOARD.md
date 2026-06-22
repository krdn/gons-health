# 대시보드 (Living Dashboard)

`dashboard.html`은 손으로 쓰는 파일이 아니라 **생성 산출물**이다.
`npm run dashboard` 가 프로젝트의 흩어진 소스를 읽어 재생성한다.

## 갱신

```bash
npm run dashboard      # dashboard.html 재생성
```

또는 `/gon:dashboard` 스킬(재생성 + 브라우저 열기).

## 데이터 소스

| 표시 | 소스 | 종류 |
|------|------|------|
| KB verified 비율·chip | `src/data/interactions.json` (raw 카운트) | 자동 |
| 마일스톤 상태·진행률 | `project-state.json` state + plan 체크박스 | 혼합 |
| 다음 행동·범위 제약·도움말 | `project-state.json` | 의도(수동) |
| 최근 작업 | `git log` | 자동 |
| 테스트 결과 | `vitest run --reporter=json` (인라인) | 자동 |
| GitHub 이슈 | `gh issue list` (선택, 없으면 스킵) | 자동 |

**원칙:** 자동 추출 가능한 데이터는 `project-state.json`에 넣지 않는다.
메타파일은 코드에 없는 **의도**만 담는다 → 드리프트 구조적 불가능.

## 의도 편집 — project-state.json

마일스톤 완료, 다음 행동 우선순위, 범위 제약, 섹션 도움말이 바뀌면
이 파일을 고친다. `milestone.state`(done/in_progress/todo)가 진행률의
1차 소스다(plan 체크박스는 실행 후 갱신 안 될 수 있어 보조로만 사용).

## GitHub 연계 (선택)

기본은 열린 이슈를 읽어 "할 일"에 단방향 표시한다(읽기 전용).
Project 보드까지 연계하려면 스코프를 추가한다:

```bash
gh auth refresh -s read:project,project
```

(현 범위는 issue 단방향 미러까지. Project 보드는 별도 작업.)

## 아키텍처

`scripts/dashboard/` 의 결정론적 순수 스크립트:
- `collect.ts` — 소스 수집. 메타파일 fail-loud, 보조 소스 실패격리.
- `aggregate.ts` — raw → 모델. 진행률·동적해설. 순수 함수.
- `render.ts` — 모델 → HTML. 의존성 0 단일 파일.
- `dashboard.ts` — 오케스트레이터.

런타임 코어(`src/lib/`)와 분리돼 LLM/API 0 불변식을 유지한다.
