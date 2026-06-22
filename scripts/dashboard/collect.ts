import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import type {
  ProjectState,
  RawData,
  SourceResult,
  KbRaw,
  KbEntryRaw,
  CheckboxCount,
  GitCommit,
  TestResult,
  GhIssue,
} from './types'

// ---- 메타파일: fail-loud ----
// 필수 필드 누락이면 즉시 throw. 조용한 폴백 금지(코어 validateKb 패턴).
export function loadState(json: unknown): ProjectState {
  if (typeof json !== 'object' || json === null) {
    throw new Error('project-state.json: 객체가 아님')
  }
  const o = json as Record<string, unknown>
  const p = o.project as Record<string, unknown> | undefined
  if (!p || typeof p.name !== 'string') {
    throw new Error('project-state.json: project.name 누락')
  }
  if (!Array.isArray(o.milestones)) {
    throw new Error('project-state.json: milestones 배열 아님')
  }
  if (!Array.isArray(o.nextActions)) {
    throw new Error('project-state.json: nextActions 배열 아님')
  }
  if (!Array.isArray(o.constraints)) {
    throw new Error('project-state.json: constraints 배열 아님')
  }
  if (!Array.isArray(o.gates)) {
    throw new Error('project-state.json: gates 배열 아님')
  }
  if (!Array.isArray(o.flow)) {
    throw new Error('project-state.json: flow 배열 아님')
  }
  if (!Array.isArray(o.artifacts)) {
    throw new Error('project-state.json: artifacts 배열 아님')
  }
  if (typeof o.help !== 'object' || o.help === null) {
    throw new Error('project-state.json: help 객체 아님')
  }
  return json as ProjectState
}

// ---- KB: raw 비여과 카운트 ----
// loadKb()/lookup() 경유 금지 — verified만 통과시켜 PENDING이 사라진다.
export function countKb(kbJson: unknown[]): KbRaw {
  const entries: KbEntryRaw[] = kbJson.map((raw) => {
    const e = raw as Record<string, unknown>
    const source = (e.source ?? {}) as Record<string, unknown>
    return {
      id: String(e.id ?? ''),
      drug_class: String(e.drug_class ?? ''),
      supplement: String(e.supplement ?? ''),
      evidence_level: String(e.evidence_level ?? ''),
      action_type: String(e.action_type ?? ''),
      verified: e.verified === true,
      sourceId: String(source.id ?? ''),
    }
  })
  return {
    total: entries.length,
    verified: entries.filter((e) => e.verified).length,
    pending: entries.filter((e) => e.sourceId === 'PENDING').length,
    entries,
  }
}

// ---- 체크박스 파싱 ----
const CHECKBOX_RE = /^\s*-\s\[([ xX])\]/

export function countCheckboxes(markdown: string): CheckboxCount {
  let done = 0
  let total = 0
  for (const line of markdown.split('\n')) {
    const m = CHECKBOX_RE.exec(line)
    if (!m) continue
    total++
    if (m[1].toLowerCase() === 'x') done++
  }
  return { done, total }
}

// ---- 보조 소스 (실패 격리) ----
function tryGitLog(root: string): SourceResult<GitCommit[]> {
  try {
    const out = execSync('git log --oneline -10', {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
    })
    const commits = out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const sp = line.indexOf(' ')
        return { sha: line.slice(0, sp), subject: line.slice(sp + 1) }
      })
    return { ok: true, value: commits }
  } catch (err) {
    return { ok: false, reason: gitReason(err) }
  }
}

function tryGitSha(root: string): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
    }).trim()
  } catch {
    return 'unknown'
  }
}

function tryTest(root: string): SourceResult<TestResult> {
  // tryTest는 vitest 컨텍스트(process.env.VITEST)면 스폰을 건너뛴다 →
  // 테스트에서 collect() 호출해도 중첩 vitest 재귀 없음(런타임 enforced).
  if (process.env.VITEST) {
    return { ok: false, reason: 'vitest 실행 중 — 중첩 회피' }
  }
  try {
    const reportPath = join(root, '.dashboard-test-report.json')
    execSync(`npx vitest run --reporter=json --outputFile=${reportPath}`, {
      cwd: root,
      encoding: 'utf8',
      timeout: 120000,
      stdio: 'pipe',
    })
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      numPassedTests?: number
      numFailedTests?: number
      numTotalTests?: number
    }
    return {
      ok: true,
      value: {
        passed: report.numPassedTests ?? 0,
        failed: report.numFailedTests ?? 0,
        total: report.numTotalTests ?? 0,
      },
    }
  } catch (err) {
    // vitest는 테스트 실패 시 비-0 종료코드를 내지만 리포트는 쓴다.
    // 리포트가 있으면 그걸 읽어 실패 카운트를 보존.
    try {
      const reportPath = join(root, '.dashboard-test-report.json')
      if (existsSync(reportPath)) {
        const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
          numPassedTests?: number
          numFailedTests?: number
          numTotalTests?: number
        }
        return {
          ok: true,
          value: {
            passed: report.numPassedTests ?? 0,
            failed: report.numFailedTests ?? 0,
            total: report.numTotalTests ?? 0,
          },
        }
      }
    } catch {
      // 리포트도 못 읽으면 아래로 떨어짐
    }
    return { ok: false, reason: '테스트 실행 실패' }
  }
}

function tryGhIssues(root: string): SourceResult<GhIssue[]> {
  try {
    const out = execSync(
      'gh issue list --state open --limit 20 --json number,title,url',
      { cwd: root, encoding: 'utf8', timeout: 5000, stdio: 'pipe' },
    )
    const issues = JSON.parse(out) as GhIssue[]
    return { ok: true, value: issues }
  } catch (err) {
    return { ok: false, reason: 'gh 미설치/오프라인/미인증' }
  }
}

function gitReason(err: unknown): string {
  return err instanceof Error ? err.message : 'git 실패'
}

// ---- 오케스트레이션 ----
// tryTest는 vitest 컨텍스트(process.env.VITEST)면 스폰을 건너뛴다 →
// 테스트에서 collect() 호출해도 중첩 vitest 재귀 없음(런타임 enforced).
export function collect(opts: { root?: string } = {}): RawData {
  const root = opts.root ?? process.cwd()

  // 필수 — 깨지면 throw
  const stateJson = JSON.parse(
    readFileSync(join(root, 'project-state.json'), 'utf8'),
  )
  const state = loadState(stateJson)

  const kbJson = JSON.parse(
    readFileSync(join(root, 'src/data/interactions.json'), 'utf8'),
  ) as unknown[]
  const kb = countKb(kbJson)

  // 체크박스: in_progress 마일스톤의 planFile만
  const checkboxes: Record<string, CheckboxCount> = {}
  for (const m of state.milestones) {
    if (m.state === 'in_progress' && m.planFile) {
      const path = join(root, m.planFile)
      if (existsSync(path)) {
        checkboxes[m.planFile] = countCheckboxes(readFileSync(path, 'utf8'))
      }
    }
  }

  // 보조 — 실패 격리
  const git = tryGitLog(root)
  const test = tryTest(root)
  const gh = tryGhIssues(root)
  const gitSha = tryGitSha(root)

  return {
    state,
    kb,
    git,
    test,
    gh,
    checkboxes,
    gitSha,
    generatedAt: new Date().toISOString(),
  }
}
