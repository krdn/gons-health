import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            color: '#b00',
            border: '2px solid #b00',
            borderRadius: 8,
            margin: 24,
          }}
        >
          <strong>데이터 오류가 발생했습니다.</strong>
          <p>상호작용 데이터(KB)를 확인하세요. 오류가 해결될 때까지 이 도구를 사용하지 마세요.</p>
          <p style={{ fontSize: 12, color: '#666' }}>{this.state.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
