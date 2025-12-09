import { useState, useRef, useEffect } from 'react'
import Page from '../components/Page'
import { dots } from '../utils'
import { initGutter, renderHighlighted, renderVars, collectVars } from '../utils/debugger'

function Debugger({ currentRoute }) {
  const [debugState, setDebugState] = useState({
    lines: [],
    index: 0,
    vars: [],
    language: 'JavaScript',
  })
  const [code, setCode] = useState('// paste code here')
  const codeInputRef = useRef(null)
  const gutterRef = useRef(null)
  const outputRef = useRef(null)
  const varsBodyRef = useRef(null)

  useEffect(() => {
    if (codeInputRef.current && gutterRef.current) {
      initGutter(codeInputRef.current, gutterRef.current)
    }
  }, [])

  const handleAction = (action) => {
    const newState = { ...debugState }
    const codeValue = codeInputRef.current?.value || ''

    if (action === 'run') {
      newState.lines = codeValue.split('\n')
      newState.index = 0
      newState.vars = collectVars(newState)
      setDebugState(newState)
      if (outputRef.current) renderHighlighted(outputRef.current, newState)
      if (varsBodyRef.current) renderVars(varsBodyRef.current, newState)
    } else if (action === 'clear') {
      newState.lines = []
      newState.index = 0
      newState.vars = []
      setCode('')
      if (codeInputRef.current) codeInputRef.current.value = ''
      if (gutterRef.current && codeInputRef.current) {
        const lines = codeInputRef.current.value.split('\n').length || 1
        gutterRef.current.innerHTML = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join('')
      }
      if (outputRef.current) outputRef.current.innerHTML = '<pre>Waiting for input…</pre>'
      if (varsBodyRef.current) varsBodyRef.current.innerHTML = '<div class="vars-empty muted">Run the code to see state.</div>'
      setDebugState(newState)
    } else if (action === 'next') {
      if (newState.lines.length === 0) return
      newState.index = Math.min(newState.index + 1, newState.lines.length - 1)
      setDebugState(newState)
      if (outputRef.current) renderHighlighted(outputRef.current, newState)
      if (varsBodyRef.current) renderVars(varsBodyRef.current, newState)
    } else if (action === 'prev') {
      if (newState.lines.length === 0) return
      newState.index = Math.max(newState.index - 1, 0)
      setDebugState(newState)
      if (outputRef.current) renderHighlighted(outputRef.current, newState)
      if (varsBodyRef.current) renderVars(varsBodyRef.current, newState)
    }
  }

  const handleLanguageChange = (lang) => {
    setDebugState({ ...debugState, language: lang })
  }

  return (
    <Page
      label="Debugger"
      title="OCV"
      subtitle="Online Code Visualizer"
      topExtra={dots(3)}
      currentRoute={currentRoute}
    >
      <div className="ai">
        <aside className="sidebar">
          <p className="eyebrow">OCV</p>
          <h4>Online Code Visualizer</h4>
          <p className="muted small">Language</p>
          {['JavaScript', 'Python', 'C'].map((lang) => (
            <button
              key={lang}
              className={`sidebar__item ${debugState.language === lang ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang)}
            >
              {lang}
            </button>
          ))}
        </aside>

        <div className="chat-window">
          <div className="chat-header">Debugger</div>
          <div className="code-toolbar">
            <button className="ghost" onClick={() => handleAction('run')}>
              Run
            </button>
            <button className="ghost" onClick={() => handleAction('clear')}>
              Clear
            </button>
            <button className="ghost" onClick={() => handleAction('prev')}>
              Step back
            </button>
            <button className="ghost" onClick={() => handleAction('next')}>
              Step forward
            </button>
          </div>
          <div className="lang-info">
            Selected language: <span className="pill">{debugState.language}</span>
          </div>
          <div className="code-editor">
            <div className="code-gutter" ref={gutterRef} aria-hidden="true"></div>
            <textarea
              ref={codeInputRef}
              className="code-input"
              aria-label="Code input"
              defaultValue={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="result-grid">
            <div className="code-box" ref={outputRef} aria-live="polite">
              <pre>Waiting for input…</pre>
            </div>
            <div className="vars-panel" aria-live="polite">
              <div className="vars-header">
                <span>Variables</span>
              </div>
              <div className="vars-body" ref={varsBodyRef}>
                <div className="vars-empty muted">Run the code to see state.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}

export default Debugger

