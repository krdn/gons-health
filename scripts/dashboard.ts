import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { collect } from './dashboard/collect'
import { aggregate } from './dashboard/aggregate'
import { render } from './dashboard/render'

// 대시보드 생성 진입점. collect → aggregate → render → write.
// 메타파일 깨지면 collect가 throw → 비-0 종료로 드러남(fail-loud).
function main(): void {
  const root = process.cwd()
  const raw = collect({ root })
  const model = aggregate(raw)
  const html = render(model)
  const out = join(root, 'dashboard.html')
  writeFileSync(out, html, 'utf8')
  // eslint-disable-next-line no-console
  console.log(`✅ dashboard.html 생성됨 (KB ${model.kb.verified}/${model.kb.total}, 마일스톤 ${model.milestones.length}개)`)
}

main()
