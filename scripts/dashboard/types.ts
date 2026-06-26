// 대시보드 생성기 타입. 메타파일 형태 → 수집 raw → 집계 모델 → 렌더 입력.

// ---- 메타파일 (project-state.json) ----
export interface ProjectMeta {
  name: string
  tagline: string
  phase: string
  status: 'active' | 'paused' | 'shipped'
}

export type MilestoneState = 'done' | 'in_progress' | 'parked' | 'todo'

export interface Milestone {
  id: string
  title: string
  state: MilestoneState
  planFile?: string // in_progress일 때 세부 진행률 계산용
  anchor?: string // 출시 증거 커밋(단축 해시). main 조상 여부로 state와 양방향 대조
}

// anchor 커밋의 main 조상 여부.
// yes=main 조상 / no=커밋 있으나 조상 아님 / absent=커밋이 git에 없음(오타·유실) / unknown=조회 실패(환경)
export type Ancestry = 'yes' | 'no' | 'absent' | 'unknown'

// aggregate가 산출, render가 경고로 표시.
export interface MilestoneDrift {
  id: string
  title: string
  kind: 'shipped-not-done' | 'done-not-shipped' | 'done-without-anchor' | 'anchor-missing'
  detail: string // 사람이 읽을 한 줄(사실만, 가치판단 없음)
}

export interface NextAction {
  rank: number
  title: string
  why: string
  priority: 'high' | 'medium' | 'low'
}

export interface Constraint {
  icon: string
  title: string
  body: string
}

// 3중 안전 게이트 — 런마다 안 변하는 설계 사실(의도). 원본 dashboard.html 핵심 섹션.
export interface Gate {
  num: string // "1" "2" "3"
  name: string // "verified 게이트"
  file: string // "src/lib/lookup.ts"
  body: string // 설명
}

// 데이터 흐름 노드 — interactions.json → validateKb → lookup → ResultCard
export interface FlowNode {
  label: string
  gate: boolean // 게이트 마크(초록 강조) 여부
}

// 듀얼 산출물 카드 — @krdn/gons-health 코어 + standalone 앱
export interface Artifact {
  name: string // "@krdn/gons-health"
  cmd: string // "npm run build → dist/"
  out: string // "tsup · React 의존 0인 순수 코어"
  use: string // 용도 설명
}

export interface ProjectState {
  project: ProjectMeta
  milestones: Milestone[]
  nextActions: NextAction[]
  constraints: Constraint[]
  gates: Gate[]
  flow: FlowNode[]
  artifacts: Artifact[]
  artifactWarning?: string // 듀얼 산출물 섹션 아래 항상 표시 경고 (옵셔널, 비면 렌더 안 함)
  help: Record<string, string> // 섹션ID → 고정 설명
}

// ---- 수집 raw ----
// 보조 소스(git/gh/test)는 실패해도 throw 안 함 → 성공/실패 래퍼
export type SourceResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string }

export interface KbEntryRaw {
  id: string
  drug_class: string
  supplement: string
  evidence_level: string
  action_type: string
  verified: boolean
  sourceId: string // source.id ('PENDING' 또는 'PMID:...')
}

export interface KbRaw {
  total: number
  verified: number
  pending: number
  entries: KbEntryRaw[]
}

export interface GitCommit {
  sha: string
  subject: string
}

export interface TestResult {
  passed: number
  failed: number
  total: number
}

export interface GhIssue {
  number: number
  title: string
  url: string
}

// planFile별 체크박스 카운트
export interface CheckboxCount {
  done: number
  total: number
}

export interface RawData {
  state: ProjectState // 필수 — 없으면 collect가 throw
  kb: KbRaw // 필수
  git: SourceResult<GitCommit[]>
  test: SourceResult<TestResult>
  gh: SourceResult<GhIssue[]>
  checkboxes: Record<string, CheckboxCount> // planFile 경로 → 카운트
  milestoneAncestry: Record<string, Ancestry> // 마일스톤 id → anchor 조상여부(anchor 없으면 키 없음)
  gitSha: string // 푸터용 (실패 시 'unknown')
  generatedAt: string // ISO 문자열
}

// ---- 집계 모델 (render 입력) ----
export interface Stat {
  num: string
  label: string
  tone: 'good' | 'warn' | 'neutral'
  spark: string
}

export interface MilestoneView {
  title: string
  state: MilestoneState
  pct: number // 0~100
  detail: string // "3/5 태스크" 또는 ""
}

export interface ChipView {
  label: string
  evidence: string // "중·avoid"
  verified: boolean
  src: string // "PMID:11302416" 또는 ""
}

export interface SectionHelp {
  fixed: string // 메타파일 help[sectionId]
  dynamic: string // aggregate가 계산한 현재 상태 문장
}

export interface DashboardModel {
  project: ProjectMeta
  stats: Stat[] // 상단 strip 4개
  milestones: MilestoneView[]
  milestoneDrifts: MilestoneDrift[] // 비면 경고 렌더 안 함
  nextActions: NextAction[]
  constraints: Constraint[]
  gates: Gate[] // 메타에서 그대로 통과
  flow: FlowNode[] // 메타에서 그대로 통과
  artifacts: Artifact[] // 메타에서 그대로 통과
  artifactWarning: string // 듀얼 산출물 섹션 아래 경고 (비면 렌더 안 함)
  kb: {
    total: number
    verified: number
    pct: number
    chips: ChipView[]
  }
  recentCommits: GitCommit[] // 빈 배열이면 "데이터 없음"
  ghIssues: SourceResult<GhIssue[]>
  help: Record<string, SectionHelp> // 섹션ID → 2층 도움말
  gitSha: string
  generatedAt: string
}
