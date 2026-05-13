import { useState, useRef, useEffect } from 'react'
import Page from '../components/Page'
import { dots } from '../utils'
import { initGutter, updateGutter, renderVars } from '../utils/debugger'
import { createJavaScriptExecutor } from '../utils/executor'
import { runPython, createPythonExecutor } from '../utils/pythonRunner'
import { createCExecutor, runCCode } from '../utils/cRunner'

const LANGUAGES = [
  { id: 'JavaScript', stepSupport: true },
  { id: 'Python', stepSupport: true },
  { id: 'C', stepSupport: true },
]

const SAMPLES = [
  { id: '', label: '— No sample —', code: { JavaScript: '', Python: '', C: '' } },
  {
    id: 'vars',
    label: 'Variables & sum',
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
      C: `#include <stdio.h>
int main() {
  int x = 10, y = 20;
  int sum = x + y;
  printf("Sum: %d\\n", sum);
  return 0;
}
`,
    },
  },
  {
    id: 'for',
    label: 'For loop',
    code: {
      JavaScript: `for (let i = 0; i < 3; i++) {
  console.log('i =', i)
}
console.log('done')
`,
      Python: `for i in range(3):
    print('i =', i)
print('done')
`,
      C: `#include <stdio.h>
int main() {
  int i;
  for (i = 0; i < 3; i++) {
    printf("i = %d\\n", i);
  }
  printf("done\\n");
  return 0;
}
`,
    },
  },
  {
    id: 'while',
    label: 'While loop',
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
      C: `#include <stdio.h>
int main() {
  int j = 0;
  while (j < 3) {
    printf("j = %d\\n", j);
    j++;
  }
  return 0;
}
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
  console.log('x is smaller')
} else {
  console.log('x is not smaller')
}
`,
      Python: `x, y = 5, 10
if x < y:
    print('x is smaller')
else:
    print('x is not smaller')
`,
      C: `#include <stdio.h>
int main() {
  int x = 5, y = 10;
  if (x < y) {
    printf("x is smaller\\n");
  } else {
    printf("x is not smaller\\n");
  }
  return 0;
}
`,
    },
  },
  {
    id: 'bubble-c',
    label: 'Bubble sort (C)',
    code: {
      JavaScript: '',
      Python: '',
      C: `#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define SIZE 15

void swap(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

void printArray(int arr[], int n) {
    for (int i = 0; i < n; i++) {
        printf("%d ", arr[i]);
    }
    printf("\\n");
}

int main() {
    int numbers[SIZE];

    srand((unsigned)time(NULL));

    for (int i = 0; i < SIZE; i++) {
        numbers[i] = rand() % 100;
    }

    printf("Original random array:\\n");
    printArray(numbers, SIZE);
    printf("----------------------------------\\n");

    for (int i = 0; i < SIZE - 1; i++) {
        for (int j = 0; j < SIZE - i - 1; j++) {
            if (numbers[j] > numbers[j + 1]) {
                swap(&numbers[j], &numbers[j + 1]);
            }
        }
    }

    printf("Sorted array (ascending):\\n");
    printArray(numbers, SIZE);

    return 0;
}
`,
    },
  },
  {
    id: 'struct-points-c',
    label: 'Structs + points (C)',
    code: {
      JavaScript: '',
      Python: '',
      C: `#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>

#define NUM_POINTS 10

typedef struct {
    int x;
    int y;
    double distance;
} Point;

int main() {
    Point points[NUM_POINTS];
    srand(time(NULL));

    printf("=== RANDOM POINTS ANALYSIS ===\\n\\n");

    for (int i = 0; i < NUM_POINTS; i++) {
        points[i].x = (rand() % 201) - 100;
        points[i].y = (rand() % 201) - 100;
        points[i].distance = sqrt(pow(points[i].x, 2) + pow(points[i].y, 2));

        printf("Point %d: [%4d, %4d] | Distance: %6.2f\\n",
                i + 1, points[i].x, points[i].y, points[i].distance);
    }

    int closestIndex = 0;
    for (int i = 1; i < NUM_POINTS; i++) {
        if (points[i].distance < points[closestIndex].distance) {
            closestIndex = i;
        }
    }

    printf("\\n-----------------------------------------------\\n");
    printf("CLOSEST POINT TO ORIGIN:\\n");
    printf("ID: %d, Coordinates: [%d, %d], Distance: %.2f\\n",
            closestIndex + 1,
            points[closestIndex].x,
            points[closestIndex].y,
            points[closestIndex].distance);
    printf("-----------------------------------------------\\n");

    return 0;
}
`,
    },
  },
  {
    id: 'names-analyzer-c',
    label: 'Name analyzer (C)',
    code: {
      JavaScript: '',
      Python: '',
      C: `#include <stdio.h>
#include <ctype.h>
#include <string.h>

#define NUM_NAMES 5

int countVowels(char *text) {
    int count = 0;
    char c;
    for (int i = 0; text[i] != '\\0'; i++) {
        c = tolower(text[i]);
        if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u' || c == 'y') {
            count++;
        }
    }
    return count;
}

void toUpperCase(char *text) {
    for (int i = 0; text[i] != '\\0'; i++) {
        text[i] = toupper(text[i]);
    }
}

int main() {
    char names[NUM_NAMES][20] = {
        "Peter",
        "Alexandra",
        "Martin",
        "Lucia",
        "Vladimir"
    };

    printf("=== NAME ANALYZER ===\\n\\n");
    printf("%-15s | %-10s | %-10s\\n", "ORIGINAL", "MODIFIED", "VOWELS");
    printf("---------------------------------------------\\n");

    for (int i = 0; i < NUM_NAMES; i++) {
        char original[20];
        strcpy(original, names[i]);

        int vowels = countVowels(names[i]);
        toUpperCase(names[i]);

        printf("%-15s | %-10s | %d\\n", original, names[i], vowels);
    }

    printf("---------------------------------------------\\n");
    printf("Analysis complete.\\n");

    return 0;
}
`,
    },
  },
  {
    id: 'caesar-cipher-c',
    label: 'Caesar cipher (C)',
    code: {
      JavaScript: '',
      Python: '',
      C: `#include <stdio.h>
#include <string.h>

void processText(char *text, int shift) {
    for (int i = 0; text[i] != '\\0'; i++) {
        char c = text[i];

        if (c >= 'A' && c <= 'Z') {
            text[i] = (c - 'A' + shift) % 26 + 'A';
        }
        else if (c >= 'a' && c <= 'z') {
            text[i] = (c - 'a' + shift) % 26 + 'a';
        }
    }
}

int main() {
    char message[] = "Programming in C is fun!";
    int key = 5;

    printf("=== CAESAR CIPHER ===\\n\\n");
    printf("Original: %s\\n", message);

    processText(message, key);
    printf("Cipher:   %s\\n", message);

    processText(message, 26 - key);
    printf("Decoded:  %s\\n", message);

    printf("\\n------------------------\\n");
    printf("Analysis complete.\\n");

    return 0;
}
`,
    },
  },
  {
    id: 'system-timer-c',
    label: 'System timer (C)',
    code: {
      JavaScript: '',
      Python: '',
      C: `#include <stdio.h>
#include <time.h>
#include <unistd.h>

int main() {
    time_t now, later;
    struct tm *info;
    char buffer[80];

    printf("=== SYSTEM TIMER ===\\n\\n");

    time(&now);
    info = localtime(&now);

    strftime(buffer, sizeof(buffer), "%d.%m.%Y %H:%M:%S", info);
    printf("Current date and time: %s\\n", buffer);

    printf("Day of year: %d\\n", info->tm_yday + 1);
    printf("Year: %d\\n", info->tm_year + 1900);

    printf("\\nSimulating computation (waiting 3 seconds)...\\n");
    sleep(3);

    time(&later);
    double elapsed = difftime(later, now);

    printf("--------------------------------------\\n");
    printf("Start time: %ld s\\n", (long)now);
    printf("End time:   %ld s\\n", (long)later);
    printf("Elapsed:    %.0f seconds.\\n", elapsed);
    printf("--------------------------------------\\n");

    return 0;
}
`,
    },
  },
  {
    id: 'full',
    label: 'Full demo (all)',
    code: {
      JavaScript: `let x = 10
let y = 20
let sum = x + y
console.log('Sum:', sum)

if (x < y) {
  console.log('x is smaller')
} else {
  console.log('x is not smaller')
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

console.log('done')
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
print('done')
`,
      C: `#include <stdio.h>
int main() {
  int x = 10, y = 20, sum = x + y;
  printf("Sum: %d\\n", sum);
  if (x < y) printf("x is smaller\\n");
  int i;
  for (i = 0; i < 3; i++) printf("for i= %d\\n", i);
  int j = 0;
  while (j < 2) {
    printf("while j= %d\\n", j);
    j++;
  }
  printf("done\\n");
  return 0;
}
`,
    },
  },
  {
    id: 'factorial-segfault-c',
    label: 'Factorial & segfault (C)',
    code: {
      JavaScript: '',
      Python: '',
      C: `#include <stdio.h>

unsigned long long factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int main() {
    int numbers[] = {3, 5, 7};
    int size = sizeof(numbers) / sizeof(numbers[0]);

    printf("--- Starting debugger test ---\\n");

    for (int i = 0; i < size; i++) {
        int current = numbers[i];

        unsigned long long result = factorial(current);

        printf("Factorial of %d is: %llu\\n", current, result);
    }

    int *ptr = NULL;
    printf("Attempting to read a NULL pointer (this will cause a Segfault):\\n");
    printf("%d", *ptr);

    return 0;
}
`,
    },
  },
]

function formatVarValue(value) {
  if (value === undefined) return ''
  if (value === null) return 'null'
  if (typeof value === 'object') return value
  return String(value)
}

function scopeToVars(scope) {
  if (!scope || typeof scope !== 'object') return []
  return Object.entries(scope)
    .filter(([name]) => !name.startsWith('__'))
    .map(([name, value]) => ({
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
  const [cLoading, setCLoading] = useState(false)

  const codeInputRef = useRef(null)
  const codeEditorRef = useRef(null)
  const fileInputRef = useRef(null)
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
    if (!gutterRef.current) return
    const spans = gutterRef.current.querySelectorAll('span')
    spans.forEach((s, i) => s.classList.toggle('active', currentLine != null && i + 1 === currentLine))
  }, [currentLine])

  useEffect(() => {
    const textarea = codeInputRef.current
    const editor = codeEditorRef.current
    if (!textarea || !editor) return

    const updateLineHighlight = () => {
      const line = currentLine != null ? Number(currentLine) : null
      if (!line) {
        editor.style.removeProperty('--active-line-top')
        editor.classList.remove('has-active-line')
        return
      }

      const computed = window.getComputedStyle(textarea)
      const lineHeight = Number.parseFloat(computed.lineHeight) || 20.8
      const paddingTop = Number.parseFloat(computed.paddingTop) || 12
      const top = paddingTop + (line - 1) * lineHeight - textarea.scrollTop
      editor.style.setProperty('--active-line-top', `${top}px`)
      editor.classList.add('has-active-line')
    }

    updateLineHighlight()
    textarea.addEventListener('scroll', updateLineHighlight)
    window.addEventListener('resize', updateLineHighlight)
    return () => {
      textarea.removeEventListener('scroll', updateLineHighlight)
      window.removeEventListener('resize', updateLineHighlight)
    }
  }, [currentLine, code])

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
    } else if (language === 'C') {
      const exec = createCExecutor(source, {
        onOutput: (text) => setOutput((o) => o + text),
      })
      if (!exec.ok) {
        if (exec.runRemote === false) {
          setError(exec.error)
          setOutput((prev) => prev + (prev ? '\n' : '') + '[Error] ' + exec.error + '\n')
          setCurrentLine(null)
          setVars([])
          setProgramFinished(true)
          return
        }
        setCLoading(true)
        try {
          const result = await runCCode(source)
          setCLoading(false)
          setOutput(result.output ?? '')
          if (!result.ok) {
            const msg = result.error || exec.error
            setError(msg)
            setOutput((prev) => prev + (prev ? '\n' : '') + '[Error] ' + msg + '\n')
          } else {
            const note = `Stepping is not supported for this C code (${exec.error}). The code was executed without stepping (Judge0).`
            setError(note)
            setOutput((prev) => prev + (prev ? '\n' : '') + '[Info] ' + note + '\n')
          }
          setCurrentLine(null)
          setVars([])
          setProgramFinished(true)
        } catch (e) {
          setCLoading(false)
          const msg = e.message || exec.error
          setError(msg)
          setOutput((prev) => prev + '[Error] ' + msg + '\n')
        }
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
      const finalOutput = (result.output ?? '') + (result.error ? '[Error] ' + result.error + '\n' : '') + 'Program finished.\n'
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

  const getLanguageExtension = (lang) => {
    if (lang === 'JavaScript') return '.js'
    if (lang === 'Python') return '.py'
    if (lang === 'C') return '.c'
    return ''
  }

  const handlePickFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const expectedExt = getLanguageExtension(language)
    const fileName = file.name || ''
    const lowerName = fileName.toLowerCase()
    const hasExpectedExt = expectedExt && lowerName.endsWith(expectedExt)

    if (!hasExpectedExt) {
      const msg = `Wrong file type. For ${language} upload a ${expectedExt} file.`
      setError(msg)
      setOutput((prev) => prev + '[Error] ' + msg + '\n')
      return
    }

    try {
      const text = await file.text()
      setCode(text)
      setSelectedSampleId('')
      setCurrentLine(null)
      setVars([])
      setOutput('')
      setError(null)
      setIsRunning(false)
      setProgramFinished(false)
      setStepHistory([])
      setStepHistoryIndex(-1)
      executorRef.current = null
    } catch (e) {
      const msg = e.message || 'Failed to read the file.'
      setError(msg)
      setOutput((prev) => prev + '[Error] ' + msg + '\n')
    }
  }

  const lines = getCode().split('\n')

  useEffect(() => {
    if (outputRef.current) {
      let pre = outputRef.current.querySelector('.output-pre')
      if (!pre) {
        outputRef.current.innerHTML = '<pre class="output-pre"></pre>'
        pre = outputRef.current.querySelector('.output-pre')
      }
      pre.textContent = output || '(no output)'
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
            Sample
          </p>
          <select
            className="sample-select"
            value={selectedSampleId}
            onChange={(e) => setSelectedSampleId(e.target.value)}
            aria-label="Select sample code"
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
          {!stepSupported && language !== 'C' && (
            <div className="lang-info muted small">
              Stepping is only available for JavaScript. Run executes the full code.
            </div>
          )}
          <div className="workspace-grid">
            <div className="debugger-editor-column">
              <div className="code-editor" ref={codeEditorRef}>
                <div className="code-gutter" ref={gutterRef} aria-hidden="true" />
                <textarea
                  ref={codeInputRef}
                  className="code-input"
                  aria-label="Code input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  wrap="off"
                  spellCheck={false}
                />
              </div>
              <div className="code-toolbar code-toolbar--below-editor" role="toolbar" aria-label="Debugger actions">
                <button
                  type="button"
                  className="ghost code-toolbar__run"
                  onClick={handleRun}
                  disabled={pythonLoading || cLoading}
                  aria-busy={pythonLoading || cLoading}
                  title={
                    pythonLoading
                      ? 'Loading Python (Pyodide)…'
                      : cLoading
                        ? 'Running C…'
                        : 'Run code'
                  }
                >
                  <span
                    className="code-toolbar__run-spinner"
                    aria-hidden="true"
                    data-active={pythonLoading || cLoading ? 'true' : 'false'}
                  />
                  <span>Run</span>
                </button>
                <button type="button" className="ghost" onClick={handlePickFile}>
                  Upload file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept={getLanguageExtension(language)}
                  style={{ display: 'none' }}
                  aria-label="Upload source code"
                />
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
                      title={programFinished ? 'Program finished' : 'Step forward'}
                    >
                      Step forward
                    </button>
                  </>
                )}
              </div>
              <div className="console-panel">
                <div className="console-header">
                  <span>Console</span>
                </div>
                <div className="code-box" ref={outputRef} aria-live="polite">
                  <pre className="output-pre"></pre>
                </div>
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
