/**
 * Executes instrumented JavaScript step-by-step and captures scope + console.
 */
import { instrumentJavaScript, wrapInstrumentedCode } from './instrument'

const STEP_VAR = '__step'
const SCOPE_VAR = '__scope'

/**
 * Creates a step controller: resolve() is called when user clicks "Step".
 * @returns {{ promise: Promise<number>, resolve: (line: number) => void }}
 */
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
        // Store so that resolve() can call it
        this._currentResolve = resolveCurrent
      })
    },
  }
}

/**
 * Runs instrumented code step-by-step. Yields after each statement with { line, scope, done }.
 * @param {string} source - Raw user JavaScript
 * @param {object} opts - { onOutput: (text) => void }
 * @returns {Promise<{ success: boolean, error?: string, steps?: { line, scope }[] }>}
 */
export async function runJavaScriptStepped(source, opts = {}) {
  const onOutput = opts.onOutput || (() => {})
  const steps = []
  const scope = {}

  const instrumented = instrumentJavaScript(source)
  if (instrumented.error) {
    return { success: false, error: instrumented.error }
  }

  const wrapped = wrapInstrumentedCode(instrumented.code)
  const runCode = new Function(
    STEP_VAR,
    SCOPE_VAR,
    `return (${wrapped})`
  )

  const stepResolvers = []
  const step = (line) => {
    return new Promise((resolve) => {
      stepResolvers.push({ line, resolve })
    })
  }

  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn
  console.log = (...args) => onOutput(args.map(String).join(' ') + '\n')
  console.error = (...args) => onOutput('[error] ' + args.map(String).join(' ') + '\n')
  console.warn = (...args) => onOutput('[warn] ' + args.map(String).join(' ') + '\n')

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

/**
 * Prepares execution: instruments code and returns an object with
 * - executeStep(): call when user clicks Step; returns { line, scope } when step is done
 * - start(): starts execution; will pause at first __step
 * @param {string} source
 * @param {object} opts - { onOutput: (text) => void }
 */
export function createJavaScriptExecutor(source, opts = {}) {
  const onOutput = opts.onOutput || (() => {})
  const scope = {}

  const instrumented = instrumentJavaScript(source)
  if (instrumented.error) {
    return { ok: false, error: instrumented.error }
  }

  const wrapped = wrapInstrumentedCode(instrumented.code)
  const runCode = new Function(
    STEP_VAR,
    SCOPE_VAR,
    `return (${wrapped})`
  )

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
  console.log = (...args) => appendOutput(args.map(String).join(' ') + '\n')
  console.error = (...args) => appendOutput('[error] ' + args.map(String).join(' ') + '\n')
  console.warn = (...args) => appendOutput('[warn] ' + args.map(String).join(' ') + '\n')

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
        console.log = originalLog
        console.error = originalError
        console.warn = originalWarn
      }
    )
    return execution
  }

  const executeStep = () => {
    if (runError) return Promise.resolve({ done: true, error: runError })
    const next = stepResolvers.shift()
    if (next) {
      next.resolve(next.line)
      // Let async code run to next await step()
      return Promise.resolve().then(() => ({
        done,
        line: stepResolvers[0] ? stepResolvers[0].line : null,
        scope: { ...scope },
        output: outputBuffer,
      }))
    }
    if (done) return Promise.resolve({ done: true, scope: { ...scope }, output: outputBuffer })
    return Promise.resolve({ done: false, waiting: true })
  }

  const getCurrentLine = () => (stepResolvers[0] ? stepResolvers[0].line : null)

  return {
    ok: true,
    start,
    executeStep,
    getScope: () => ({ ...scope }),
    getCurrentLine,
    getError: () => runError,
    isDone: () => done,
  }
}
