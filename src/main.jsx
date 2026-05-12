import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '../css/base.css'
import '../css/components.css'
import '../css/pages.css'
import '../css/responsive.css'

class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 600 }}>
          <h1 style={{ color: '#b00' }}>Application Error</h1>
          <pre style={{ background: '#f5f5f5', padding: 16, overflow: 'auto' }}>
            {this.state.error.message}
          </pre>
          <p style={{ color: '#666' }}>Open the browser console (F12) for details.</p>
        </div>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) {
  document.body.innerHTML = '<p style="padding:24px">Missing #root element.</p>'
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

