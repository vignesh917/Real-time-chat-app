import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class FatalErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected frontend error.',
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="login-shell">
        <section className="intro-panel">
          <p className="eyebrow">Frontend Recovery</p>
          <h1>PulseChat</h1>
          <p className="intro-copy">
            The app hit a browser-side error while loading. Refresh once, and if it still
            happens, clear this site&apos;s local storage and reopen the page.
          </p>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-heading">
              <p className="eyebrow">Error details</p>
              <h2>Startup failed</h2>
              <p>{this.state.message}</p>
            </div>
          </div>
        </section>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <FatalErrorBoundary>
    <App />
  </FatalErrorBoundary>,
)
