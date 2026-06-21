import { ErrorBoundary } from './components/ErrorBoundary'
import { InteractionChecker } from './components/InteractionChecker'

export default function App() {
  return (
    <ErrorBoundary>
      <InteractionChecker />
    </ErrorBoundary>
  )
}
