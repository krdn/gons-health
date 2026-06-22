// 대시보드 생성기 타입. 메타파일 형태 → 수집 raw → 집계 모델 → 렌더 입력.

// ---- 메타파일 (project-state.json) ----
export interface ProjectMeta {
  name: string
  tagline: string
  phase: string
  status: 'active' | 'paused' | 'shipped'
}

export interface Milestone {
  id: string
  title: string
  state: 'done' | 'in_progress' | 'todo'
  planFile?: string // in_progress일 때 세부 진행률 계산용
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
  state: 'done' | 'in_progress' | 'todo'
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
  nextActions: NextAction[]
  constraints: Constraint[]
  gates: Gate[] // 메타에서 그대로 통과
  flow: FlowNode[] // 메타에서 그대로 통과
  artifacts: Artifact[] // 메타에서 그대로 통과
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
