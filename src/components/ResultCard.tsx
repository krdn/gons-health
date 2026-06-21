import type { LookupResult, InteractionEntry, Severity, ActionType } from '../types'
import { ABSTAIN_MESSAGE } from '../lib/lookup'

const SEVERITY_LABEL: Record<Severity, string> = {
  high: '🔴 높음',
  medium: '🟡 중간',
  low: '⚪ 낮음',
}

const ACTION_LABEL: Record<ActionType, string> = {
  avoid: '권하지 말 것',
  monitor: '모니터링',
  spacing: '복용 간격 두기',
}

function EntryCard({ entry }: { entry: InteractionEntry }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{SEVERITY_LABEL[entry.severity]}</strong>
        <span style={{ background: '#eef', padding: '2px 8px', borderRadius: 4 }}>
          {ACTION_LABEL[entry.action_type]}
        </span>
        <span style={{ background: '#efe', padding: '2px 8px', borderRadius: 4 }}>
          ✅ 검증됨 · 근거강도 {entry.evidence_level}
        </span>
      </div>
      <p style={{ margin: '8px 0' }}>
        <strong>{entry.drug_class}</strong> × <strong>{entry.supplement}</strong>
      </p>
      <p style={{ margin: '4px 0' }}>{entry.mechanism}</p>
      <p style={{ margin: '4px 0', fontWeight: 600 }}>{entry.recommendation}</p>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: '#555' }}>
        근거:{' '}
        <a href={entry.source.url} target="_blank" rel="noopener noreferrer">
          {entry.source.db} {entry.source.id}
        </a>{' '}
        — "{entry.source.quote}" (확인일 {entry.source.retrieved_date})
      </p>
    </div>
  )
}

export function ResultCard({ result }: { result: LookupResult }) {
  const shouldShowAbstain = result.kind === 'abstain' || (result.kind === 'hit' && result.entries.length === 0)

  if (shouldShowAbstain) {
    const message = result.kind === 'abstain' ? result.message : ABSTAIN_MESSAGE
    return (
      <div
        style={{
          border: '1px dashed #999',
          borderRadius: 8,
          padding: 16,
          background: '#fafafa',
          color: '#444',
        }}
      >
        {message}
      </div>
    )
  }

  return (
    <div>
      {result.entries.map((e) => (
        <EntryCard key={e.id} entry={e} />
      ))}
    </div>
  )
}
