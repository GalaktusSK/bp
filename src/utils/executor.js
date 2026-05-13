import { instrumentJavaScript, wrapInstrumentedCode } from './instrument'
import { validateUserCode } from './safetyCheck'

const STEP_VAR = '__step'
const SCOPE_VAR = '__scope'

function cloneSnapshot(value) {
  if (value !== null && typeof value === 'object') {
    if (typeof value.get === 'function' && typeof value.set === 'function') {
      return value
    }
    if (value.__c_char_buf === true) {
      return { __c_char_buf: true, cap: value.cap, s: value.s }
    }
  }
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch (_) {}
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (_) {
    return value
  }
}

function cloneScope(scope) {
  if (!scope || typeof scope !== 'object') return {}
  const out = {}
  for (const [key, val] of Object.entries(scope)) {
    out[key] = cloneSnapshot(val)
  }
  return out
}

function jsonReplacer() {
  const ancestors = []
  return function (key, value) {
    if (typeof value === 'bigint') return `${value}n`
    if (typeof value === 'function') return `[Function${value.name ? `: ${value.name}` : ''}]`
    if (typeof value === 'symbol') return value.toString()
    if (typeof value !== 'object' || value === null) return value

    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop()
    }
    if (ancestors.includes(value)) return '[Circular]'
    ancestors.push(value)
    return value
  }
}

function formatConsoleArg(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'function') return `[Function${value.name ? `: ${value.name}` : ''}]`
  if (value instanceof Date) return value.toISOString()
  if (value instanceof RegExp) return value.toString()
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, jsonReplacer())
    } catch {
      return '[Object]'
    }
  }
  return String(value)
}

function formatConsoleLine(args) {
  if (args.length === 1) return formatConsoleArg(args[0])
  return args.map((a) => formatConsoleArg(a)).join(' ')
}

function createStepController() {
  let resolveCurrent = null
  const promise = new Promise((resolve) => {
    resolveCurrent = resolve
  })
  return {
    promise: Promise.resolve(null),
    resolve(line) {
      if (resolveCurrent) {
        resolveCurrent(line)
        resolveCurrent = null
      }
    },
    waitForStep(line) {
      return new Promise((resolve) => {
        resolveCurrent = (l) => {
          resolveCurrent = null
          resolve(l)
        }
        this._currentResolve = resolveCurrent
      })
    },
  }
}

export async function runJavaScriptStepped(source, opts = {}) {
  const onOutput = opts.onOutput || (() => {})
  const steps = []
  const scope = {}

  const safety = validateUserCode(source, 'JavaScript')
  if (!safety.ok) {
    return { success: false, error: safety.error }
  }

  const instrumented = instrumentJavaScript(source)
  if (instrumented.error) {
    return { success: false, error: instrumented.error }
  }

  const wrapped = wrapInstrumentedCode(instrumented.code)
  let runCode
  try {
    runCode = new Function(
      STEP_VAR,
      SCOPE_VAR,
      `return (${wrapped})`
    )
  } catch (err) {
    return { ok: false, error: err.message || 'Code compilation error' }
  }

  const stepResolvers = []
  const step = (line) => {
    return new Promise((resolve) => {
      stepResolvers.push({ line, resolve })
    })
  }

  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn
  console.log = (...args) => onOutput(formatConsoleLine(args) + '\n')
  console.error = (...args) => onOutput('[error] ' + formatConsoleLine(args) + '\n')
  console.warn = (...args) => onOutput('[warn] ' + formatConsoleLine(args) + '\n')

  let runPromise = null
  let runError = null

  try {
    const asyncFn = runCode(step, scope)
    runPromise = asyncFn(step, scope)
    await runPromise
  } catch (err) {
    runError = err.message || String(err)
  } finally {
    console.log = originalLog
    console.error = originalError
    console.warn = originalWarn
  }

  if (runError) {
    return { success: false, error: runError }
  }

  return {
    success: true,
    step,
    stepResolvers,
    scope,
    runPromise,
  }
}

export function createJavaScriptExecutor(source, opts = {}) {
  const onOutput = opts.onOutput || (() => {})
  const scope = {}

  const safety = validateUserCode(source, 'JavaScript')
  if (!safety.ok) {
    return { ok: false, error: safety.error }
  }

  const instrumented = instrumentJavaScript(source)
  if (instrumented.error) {
    return { ok: false, error: instrumented.error }
  }

  const wrapped = wrapInstrumentedCode(instrumented.code)
  let runCode
  try {
    runCode = new Function(
      STEP_VAR,
      SCOPE_VAR,
      `return (${wrapped})`
    )
  } catch (err) {
    return { ok: false, error: err.message || 'Code compilation error' }
  }

  let stepResolvers = []
  const step = (line) => {
    return new Promise((resolve) => {
      stepResolvers.push({ line, resolve })
    })
  }

  let execution = null
  let done = false
  let runError = null
  let outputBuffer = ''

  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn
  const appendOutput = (text) => {
    outputBuffer += text
    onOutput(text)
  }
  console.log = (...args) => appendOutput(formatConsoleLine(args) + '\n')
  console.error = (...args) => appendOutput('[error] ' + formatConsoleLine(args) + '\n')
  console.warn = (...args) => appendOutput('[warn] ' + formatConsoleLine(args) + '\n')

  const start = () => {
    outputBuffer = ''
    execution = runCode(step, scope)(step, scope).then(
      () => {
        done = true
        console.log = originalLog
        console.error = originalError
        console.warn = originalWarn
      },
      (err) => {
        runError = err.message || String(err)
        done = true
        console.log = originalLog
        console.error = originalError
        console.warn = originalWarn
      }
    )
    return execution
  }

  const executeStep = async () => {
    if (runError) return Promise.resolve({ done: true, error: runError, scope: cloneScope(scope), output: outputBuffer })
    const next = stepResolvers.shift()
    if (next) {
      next.resolve(next.line)
      await Promise.resolve()
      if (!stepResolvers[0] && execution && !done && !runError) {
        await execution
      }
      if (runError) return { done: true, error: runError, scope: cloneScope(scope), output: outputBuffer }
      return {
        done,
        line: stepResolvers[0] ? stepResolvers[0].line : null,
        scope: cloneScope(scope),
        output: outputBuffer,
      }
    }
    if (done) return Promise.resolve({ done: true, scope: cloneScope(scope), output: outputBuffer })
    return Promise.resolve({ done: false, waiting: true })
  }

  const getCurrentLine = () => (stepResolvers[0] ? stepResolvers[0].line : null)

  return {
    ok: true,
    start,
    executeStep,
    getScope: () => cloneScope(scope),
    getCurrentLine,
    getError: () => runError,
    isDone: () => done,
  }
}
