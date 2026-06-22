import { describe, it, expect } from 'vitest'
import { render, escapeHtml } from './render'
import type { DashboardModel } from './types'

const model: DashboardModel = {
  project: { name: 'gons-health', tagline: '태그라인 <테스트>', phase: '1단계', status: 'active' },
  stats: [
    { num: '21/21', label: '테스트 통과', tone: 'good', spark: '✅' },
    { num: '2/10', label: 'KB verified', tone: 'warn', spark: '⏳' },
  ],
  milestones: [
    { title: 'MVP', state: 'done', pct: 100, detail: '' },
    { title: '파이프라인', state: 'in_progress', pct: 25, detail: '1/4 태스크' },
  ],
  nextActions: [{ rank: 1, title: '검증', why: '효용', priority: 'high' }],
  constraints: [{ icon: '🚫', title: '배제', body: '사유' }],
  gates: [
    { num: '1', name: 'verified 게이트', file: 'src/lib/lookup.ts', body: 'verified만 반환' },
    { num: '2', name: 'abstain 상수', file: 'ABSTAIN_MESSAGE', body: '고정 상수' },
    { num: '3', name: 'closed-set 어휘', file: 'src/data/vocabulary.ts', body: '드롭다운만' },
  ],
  flow: [
    { label: 'interactions.json', gate: false },
    { label: 'validateKb()', gate: true },
    { label: 'lookup()', gate: true },
    { label: 'ResultCard', gate: false },
  ],
  artifacts: [
    { name: '@krdn/gons-health', cmd: 'npm run build → dist/', out: '순수 코어', use: '코어 export' },
    { name: 'standalone 웹앱', cmd: 'npm run build:app', out: 'React UI', use: '단독 실행' },
  ],
  artifactWarning: '⚠️ 함정: dist/ 는 반드시 git에 커밋. GitHub 의존성은 git-archive 타르볼이라 tracked 파일만 받음.',
  kb: {
    total: 2,
    verified: 1,
    pct: 50,
    chips: [
      { label: '항응고제 × 단삼', evidence: '중·avoid', verified: true, src: 'PMID:111' },
      { label: '항응고제 × 은행', evidence: '중·avoid', verified: false, src: '' },
    ],
  },
  recentCommits: [{ sha: 'abc123', subject: '커밋 메시지' }],
  ghIssues: { ok: false, reason: 'gh 미설치' },
  help: {
    kbStatus: { fixed: '고정 설명', dynamic: '동적 해설 병목' },
  },
  gitSha: 'abc123',
  generatedAt: '2026-06-22T00:00:00.000Z',
}

describe('escapeHtml', () => {
  it('꺾쇠·앰퍼샌드 이스케이프', () => {
    expect(escapeHtml('a <b> & c')).toBe('a &lt;b&gt; &amp; c')
  })
})

describe('render — HTML 무결성', () => {
  const html = render(model)

  it('완전한 HTML 문서', () => {
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('</html>')
  })

  it('외부 의존성 0 — script src/link href 없음', () => {
    expect(html).not.toMatch(/<script\s+[^>]*src=/i)
    expect(html).not.toMatch(/<link\s+[^>]*href=/i)
  })

  it('주요 섹션 모두 존재', () => {
    expect(html).toContain('gons-health')
    expect(html).toContain('21/21')
    expect(html).toContain('항응고제 × 단삼')
    expect(html).toContain('PMID:111')
    expect(html).toContain('검증') // nextAction
    expect(html).toContain('배제') // constraint
  })

  it('마일스톤 진행률 렌더', () => {
    expect(html).toContain('파이프라인')
    expect(html).toContain('1/4 태스크')
  })

  it('3중 안전 게이트 섹션 렌더 (원본 핵심 섹션)', () => {
    expect(html).toContain('verified 게이트')
    expect(html).toContain('abstain 상수')
    expect(html).toContain('closed-set 어휘')
    expect(html).toContain('src/lib/lookup.ts')
  })

  it('데이터 흐름 노드 렌더 + 게이트 마크', () => {
    expect(html).toContain('interactions.json')
    expect(html).toContain('validateKb()')
    expect(html).toContain('ResultCard')
  })

  it('듀얼 산출물 섹션 렌더 (원본 핵심 섹션)', () => {
    expect(html).toContain('@krdn/gons-health')
    expect(html).toContain('standalone 웹앱')
    expect(html).toContain('npm run build → dist/')
  })

  it('도움말 2층 주입 (고정 + 동적)', () => {
    expect(html).toContain('고정 설명')
    expect(html).toContain('동적 해설 병목')
  })

  it('? 토글 마크업 + 인라인 스크립트 존재', () => {
    expect(html).toContain('help-toggle')
    expect(html).toContain('<script>') // 인라인 (src 없는)
  })

  it('XSS — tagline 이스케이프', () => {
    expect(html).toContain('&lt;테스트&gt;')
    expect(html).not.toContain('<테스트>')
  })

  it('gh 실패 시 우아한 표시', () => {
    expect(html.toLowerCase()).toContain('github')
  })

  it('생성 시각·SHA 푸터', () => {
    expect(html).toContain('abc123')
  })

  it('warn-box: artifactWarning 텍스트 포함 (dist/ 또는 타르볼)', () => {
    expect(html).toContain('dist/')
    expect(html).toContain('타르볼')
  })

  it('gate.flow: 게이트 카드에 "gate flow" 클래스 포함', () => {
    expect(html).toContain('class="gate flow"')
  })

  it('kb-note: 동적 해설이 토글 밖(항상 보이는 위치)에도 존재 — kb-note 클래스 포함', () => {
    expect(html).toContain('class="kb-note"')
    // 동적 해설 문자열이 HTML에 2번 이상 등장 (kb-note + help-body 토글 안)
    const occurrences = html.split('동적 해설 병목').length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })
})
