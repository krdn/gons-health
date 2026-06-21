# 진단: Ultracode 세션의 "형식 오류" 반복 원인

작성일: 2026-06-21
방법: systematic-debugging (transcript 1차 증거 분석)

## 증상 (사용자 인지)
"ScheduleWakeup 형식 오류가 반복된다."

## 근본 원인 (확정)
에러 도구는 **ScheduleWakeup이 아니라 `AskUserQuestion`**. 사용자 오귀속(misattribution).

`AskUserQuestion` 입력 JSON 직렬화 중, 한글을 `\uXXXX` 유니코드 이스케이프로 출력하다가
**특정 토큰에서 hex 4자리를 다 못 채우고 원본 글자가 섞이는 토큰 레벨 결함** 발생.

- 정상: "데이터" → `데이터` (모두 `\u`+hex 4자리)
- 결함: "지뢰"의 '뢰'(U+B8B0) → `뢰` 이어야 하는데 → **`\ub뢰`** (hex 자리에 리터럴 '뢰')
- JSON 파서가 `\ub뢰`를 invalid unicode escape로 보고 전체 파싱 실패
  → `InputValidationError: ... could not be parsed as JSON`

## 증거 (4개 세션 파일, is_error 플래그 기반 집계 — 텍스트매칭 배제)
| 파일 | 진짜 에러 | 도구 |
|---|---|---|
| 684e4f84 (현재) | 0 | — |
| 817ab734 | 0 | — |
| 8eebf03a | 7 | AskUserQuestion 5, Bash 2(무관) |
| d1d8a537 | 1 | AskUserQuestion 1 |

- **ScheduleWakeup 에러 = 0 (전 세션)**. 9회 호출 전부 성공.
- 모든 InputValidationError(6건) = AskUserQuestion.

## 왜 AskUserQuestion에서만?
도구 결함 아님. 결정적 차이:
- **성공한 ScheduleWakeup**: 한글이 **리터럴 UTF-8**로 들어감 (이스케이프 안 함) → glitch 불가능
- **실패한 AskUserQuestion**: 한글을 **`\uXXXX` 이스케이프**로 출력 → 이스케이프 토큰이 많을수록 glitch 누적확률↑
- AskUserQuestion은 입력이 큼(1700~1940 bytes, 중첩 questions/options 구조) → 이스케이프 한글 토큰 다수 → 확률적으로 결함 발생

## "반복"의 실체
데이터-라이선스 질문: 1910 → 1943 → 1858 bytes로 **3연속 재시도 실패**.
한 번 실패 후 self-heal이 아니라, 재시도 출력에서도 같은 클래스 결함이 반복 발생.

## Ultracode 관련성
긴 컨텍스트·다중 에이전트 세션이 직접 원인은 아님. 단, 긴 세션일수록 AskUserQuestion 호출이
잦고 입력이 커지는 경향 → 이스케이프 한글 토큰 누적 → 결함 노출 확률 상관. (인과 아님, 상관)

## 처방
1. **즉효 (모델 행동)**: tool 입력의 한글을 `\uXXXX`로 직렬화하지 말고 **리터럴 UTF-8**로 출력.
   ScheduleWakeup이 9/9 성공한 이유가 바로 이것. AskUserQuestion도 동일 적용 시 오류 클래스 소멸.
2. **질문 입력 축소**: AskUserQuestion question/option 텍스트를 짧게 → 이스케이프 토큰 수↓ → 결함 표면적↓.
3. **내구적 (harness)**: 잘린 `\uXX` 이스케이프 복구/재시도 로직. 이스케이프 선택은 부분적으로
   stochastic이라 모델 자율로 100% 못 막음 → harness 레벨 방어가 근본 해법. (사용자가 harness 소유)
