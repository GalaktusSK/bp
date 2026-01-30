import { useState, useRef, useEffect } from 'react'
import Page from '../components/Page'
import { dots } from '../utils'
import { initGutter, updateGutter, renderVars } from '../utils/debugger'
import { createJavaScriptExecutor } from '../utils/executor'
import { runPython, createPythonExecutor } from '../utils/pythonRunner'

const LANGUAGES = [
  { id: 'JavaScript', stepSupport: true },
  { id: 'Python', stepSupport: true },
  { id: 'C', stepSupport: false },
]

const SAMPLES = [
  { id: '', label: '— Žiadna ukážka —', code: { JavaScript: '', Python: '', C: '' } },
  {
    id: 'vars',
    label: 'Premenné a súčet',
    code: {
      JavaScript: `let x = 10
let y = 20
let sum = x + y
console.log('Sum:', sum)
`,
      Python: `x = 10
y = 20
sum = x + y
print('Sum:', sum)
`,
      C: `// C nie je v prehliadači spustiteľné
int x = 10, y = 20;
int sum = x + y;
`,
    },
  },
  {
    id: 'for',
    label: 'For cyklus',
    code: {
      JavaScript: `for (let i = 0; i < 3; i++) {
  console.log('i =', i)
}
console.log('hotovo')
`,
      Python: `for i in range(3):
    print('i =', i)
print('hotovo')
`,
      C: `// C nie je v prehliadači spustiteľné
for (int i = 0; i < 3; i++) { }
`,
    },
  },
  {
    id: 'while',
    label: 'While cyklus',
    code: {
      JavaScript: `let j = 0
while (j < 3) {
  console.log('j =', j)
  j++
}
`,
      Python: `j = 0
while j < 3:
    print('j =', j)
    j += 1
`,
      C: `// C nie je v prehliadači spustiteľné
int j = 0;
while (j < 3) { j++; }
`,
    },
  },
  {
    id: 'if',
    label: 'If / else',
    code: {
      JavaScript: `let x = 5
let y = 10
if (x < y) {
  console.log('x je mensie')
} else {
  console.log('x nie je mensie')
}
`,
      Python: `x, y = 5, 10
if x < y:
    print('x je mensie')
else:
    print('x nie je mensie')
`,
      C: `// C nie je v prehliadači spustiteľné
int x = 5, y = 10;
if (x < y) { }
`,
    },
  },
  {
    id: 'full',
    label: 'Kompletný demo (všetko)',
    code: {
      JavaScript: `let x = 10
let y = 20
let sum = x + y
console.log('Sum:', sum)

if (x < y) {
  console.log('x je mensie')
} else {
  console.log('x nie je mensie')
}

for (let i = 0; i < 3; i++) {
  console.log('for i=', i)
}

let j = 0
while (j < 2) {
  console.log('while j=', j)
  j++
}

let k = 0
do {
  console.log('do-while k=', k)
  k++
} while (k < 2)

const arr = ['a', 'b']
for (const item of arr) {
  console.log('item:', item)
}

console.log('konec')
`,
      Python: `x, y = 10, 20
sum = x + y
print('Sum:', sum)
for i in range(3):
    print('for i=', i)
j = 0
while j < 2:
    print('while j=', j)
    j += 1
print('konec')
`,
      C: `// C execution is not supported in browser.
// Use JavaScript or Python.
int main() { return 0; }
`,
    },
  },
]

function formatVarValue(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function scopeToVars(scope) {
  if (!scope || typeof scope !== 'object') return []
  return Object.entries(scope).map(([name, value]) => ({
    name,
    value: formatVarValue(value),
  }))
}

function Debugger({ currentRoute }) {
  const [language, setLanguage] = useState('JavaScript')
  const [code, setCode] = useState('')
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [currentLine, setCurrentLine] = useState(null)
  const [vars, setVars] = useState([])
  const [output, setOutput] = useState('')
  const [error, setError] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [programFinished, setProgramFinished] = useState(false)
  const [stepHistory, setStepHistory] = useState([])
  const [stepHistoryIndex, setStepHistoryIndex] = useState(-1)
  const [pythonLoading, setPythonLoading] = useState(false)

  const codeInputRef = useRef(null)
  const gutterRef = useRef(null)
  const outputRef = useRef(null)
  const varsBodyRef = useRef(null)
  const executorRef = useRef(null)

  useEffect(() => {
    if (codeInputRef.current && gutterRef.current) {
      initGutter(codeInputRef.current, gutterRef.current)
    }
  }, [])

  useEffect(() => {
    if (codeInputRef.current && gutterRef.current) {
      updateGutter(codeInputRef.current, gutterRef.current)
    }
  }, [code])

  useEffect(() => {
    if (gutterRef.current && currentLine != null) {
      const spans = gutterRef.current.querySelectorAll('span')
      spans.forEach((s, i) => s.classList.toggle('active', i + 1 === currentLine))
    }
  }, [currentLine])

  useEffect(() => {
    const sample = SAMPLES.find((s) => s.id === selectedSampleId)
    setCode(sample ? (sample.code[language] ?? '') : '')
    setCurrentLine(null)
    setVars([])
    setOutput('')
    setError(null)
    executorRef.current = null
  }, [language, selectedSampleId])

  const getCode = () => codeInputRef.current?.value ?? code

  const applyStepState = (state) => {
    if (!state) return
    setCurrentLine(state.line != null ? Number(state.line) : null)
    setVars(scopeToVars(state.scope || {}))
    setOutput(state.output ?? '')
    setError(null)
  }

  const handleRun = async () => {
    const source = getCode().trim()
    setError(null)
    setOutput('')
    setVars([])
    setCurrentLine(null)
    setProgramFinished(false)
    setStepHistory([])
    setStepHistoryIndex(-1)
    executorRef.current = null

    if (language === 'JavaScript') {
      const exec = createJavaScriptExecutor(source, {
        onOutput: (text) => setOutput((o) => o + text),
      })
      if (!exec.ok) {
        setError(exec.error)
        setOutput((prev) => prev + '[Error] ' + exec.error + '\n')
        return
      }
      executorRef.current = exec
      exec.start().then(() => {
        setIsRunning(false)
        setCurrentLine(null)
        setVars(scopeToVars(exec.getScope()))
        if (exec.getError()) {
          setError(exec.getError())
          setOutput((prev) => prev + '[Error] ' + exec.getError() + '\n')
        }
      })
      const initialState = {
        line: exec.getCurrentLine(),
        scope: exec.getScope(),
        output: '',
      }
      setStepHistory([initialState])
      setStepHistoryIndex(0)
      applyStepState(initialState)
      setIsRunning(false)
    } else if (language === 'Python') {
      setPythonLoading(true)
      try {
        const exec = await createPythonExecutor(source)
        setPythonLoading(false)
        if (!exec.ok) {
          setError(exec.error)
          setOutput((prev) => prev + '[Error] ' + exec.error + '\n')
          return
        }
        executorRef.current = exec
        const initialState = await exec.start()
        const stateObj = {
          line: initialState.line != null ? Number(initialState.line) : null,
          scope: initialState.scope || {},
          output: initialState.output ?? '',
        }
        setStepHistory([stateObj])
        setStepHistoryIndex(0)
        applyStepState(stateObj)
        setIsRunning(false)
      } catch (e) {
        setPythonLoading(false)
        const errMsg = e.message || String(e)
        setError(errMsg)
        setOutput((prev) => prev + '[Error] ' + errMsg + '\n')
      }
    } else {
      const errMsg = 'C execution is not supported in the browser. Use JavaScript or Python for code visualization and stepping.'
      setError(errMsg)
      setOutput((prev) => prev + '[Error] ' + errMsg + '\n')
    }
  }

  const handleStep = async () => {
    const exec = executorRef.current
    if (!exec) return
    if (stepHistoryIndex < stepHistory.length - 1) {
      const nextIndex = stepHistoryIndex + 1
      setStepHistoryIndex(nextIndex)
      applyStepState(stepHistory[nextIndex])
      const atLast = nextIndex === stepHistory.length - 1
      setProgramFinished(atLast && stepHistory[nextIndex].line === null)
      return
    }
    const result = await exec.executeStep()
    if (result.done) {
      setIsRunning(false)
      setProgramFinished(true)
      const finalOutput = (result.output ?? '') + (result.error ? '[Error] ' + result.error + '\n' : '') + 'Program ukončený.\n'
      const finalState = { line: null, scope: exec.getScope(), output: finalOutput }
      setStepHistory((h) => [...h, finalState])
      setStepHistoryIndex((i) => i + 1)
      setCurrentLine(null)
      setVars(scopeToVars(exec.getScope()))
      setOutput(finalOutput)
      if (result.error) setError(result.error)
      return
    }
    const newState = { line: result.line != null ? Number(result.line) : null, scope: result.scope || {}, output: result.output ?? '' }
    setStepHistory((h) => [...h, newState])
    setStepHistoryIndex((i) => i + 1)
    applyStepState(newState)
  }

  const handleStepBack = () => {
    if (stepHistoryIndex <= 0) return
    const prevIndex = stepHistoryIndex - 1
    setStepHistoryIndex(prevIndex)
    applyStepState(stepHistory[prevIndex])
    if (programFinished) setProgramFinished(false)
  }

  const handleClear = () => {
    setCurrentLine(null)
    setVars([])
    setOutput('')
    setError(null)
    setIsRunning(false)
    setProgramFinished(false)
    setStepHistory([])
    setStepHistoryIndex(-1)
    executorRef.current = null
    setCode('')
    setSelectedSampleId('')
    if (gutterRef.current && codeInputRef.current) {
      updateGutter(codeInputRef.current, gutterRef.current)
    }
    if (outputRef.current) outputRef.current.innerHTML = '<pre class="output-pre"></pre>'
    if (varsBodyRef.current) {
      varsBodyRef.current.innerHTML = '<div class="vars-empty muted">Run the code to see variables.</div>'
    }
  }

  const lines = getCode().split('\n')

  useEffect(() => {
    if (outputRef.current) {
      const safe = output.replace(/</g, '&lt;').replace(/\n/g, '<br>') || '(no output)'
      outputRef.current.innerHTML = `<pre class="output-pre">${safe}</pre>`
    }
  }, [output])

  useEffect(() => {
    if (varsBodyRef.current) {
      renderVars(varsBodyRef.current, { vars, index: -1 })
    }
  }, [vars])

  const stepSupported = LANGUAGES.find((l) => l.id === language)?.stepSupport ?? false

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
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              className={`sidebar__item ${language === lang.id ? 'active' : ''}`}
              onClick={() => setLanguage(lang.id)}
            >
              {lang.id}
            </button>
          ))}
          <p className="muted small" style={{ marginTop: '16px', marginBottom: '6px' }}>
            Ukážka
          </p>
          <select
            className="sample-select"
            value={selectedSampleId}
            onChange={(e) => setSelectedSampleId(e.target.value)}
            aria-label="Vyber ukážkový kód"
          >
            {SAMPLES.map((s) => (
              <option key={s.id || 'none'} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </aside>

        <div className="chat-window">
          <div className="chat-header">Debugger</div>
          <div className="code-toolbar">
            <button type="button" className="ghost" onClick={handleRun} disabled={pythonLoading}>
              {pythonLoading ? 'Loading…' : 'Run'}
            </button>
            <button type="button" className="ghost" onClick={handleClear}>
              Clear
            </button>
            {stepSupported && (
              <>
                <button
                  type="button"
                  className="ghost"
                  onClick={handleStepBack}
                  disabled={!executorRef.current || stepHistoryIndex <= 0}
                  title="Step back"
                >
                  Step back
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={handleStep}
                  disabled={!executorRef.current || isRunning || programFinished}
                  title={programFinished ? 'Program ukončený' : 'Step forward'}
                >
                  Step forward
                </button>
              </>
            )}
          </div>
          {!stepSupported && language !== 'C' && (
            <div className="lang-info muted small">
              Stepping is only available for JavaScript. Run executes the full code.
            </div>
          )}
          {language === 'C' && (
            <div className="lang-info muted small">
              C cannot be executed in the browser. Use JavaScript or Python.
            </div>
          )}
          <div className="code-editor">
            <div className="code-gutter" ref={gutterRef} aria-hidden="true" />
            <textarea
              ref={codeInputRef}
              className="code-input"
              aria-label="Code input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="result-grid">
            <div className="console-panel">
              <div className="console-header">
                <span>Console</span>
              </div>
              <div className="code-box" ref={outputRef} aria-live="polite">
                <pre className="output-pre"></pre>
              </div>
            </div>
            <div className="vars-panel" aria-live="polite">
              <div className="vars-header">
                <span>Variables</span>
              </div>
              <div className="vars-body" ref={varsBodyRef}>
                <div className="vars-empty muted">Run the code to see variables.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}

export default Debugger
