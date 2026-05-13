import { validateUserCode } from './safetyCheck'

let worker = null
let msgId = 0
const pending = new Map()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./pythonWorker.js', import.meta.url))
  worker.onmessage = (e) => {
    const { id, result, error } = e.data
    const p = pending.get(id)
    if (!p) return
    pending.delete(id)
    if (error) p.reject(new Error(error))
    else p.resolve(result)
  }
  worker.onerror = (e) => {
    e.preventDefault()
    for (const [, p] of pending) p.reject(new Error(e.message || 'Worker error'))
    pending.clear()
  }
  return worker
}

function sendMessage(type, data = {}) {
  const id = ++msgId
  const w = getWorker()
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, type, ...data })
  })
}

let initialized = false

async function ensureInit() {
  if (initialized) return
  await sendMessage('init')
  initialized = true
}

export async function createPythonExecutor(source) {
  try {
    const safety = validateUserCode(source, 'Python')
    if (!safety.ok) {
      return { ok: false, error: safety.error }
    }
    await ensureInit()
    await sendMessage('createExecutor', { source })

    let stepIndex = 0
    let currentLine = null
    let lastScope = {}
    let lastOutput = ''
    let runError = null
    let done = false

    const runOneStep = async () => {
      const result = await sendMessage('step', { stepIndex })
      currentLine = result.line
      lastScope = result.scope || {}
      lastOutput = result.output ?? ''
      runError = result.error || null
      done = result.done
      return result
    }

    const start = async () => {
      stepIndex = 0
      return runOneStep()
    }

    const executeStep = async () => {
      if (runError) return { done: true, scope: lastScope, output: lastOutput, error: runError }
      stepIndex += 1
      return runOneStep()
    }

    return {
      ok: true,
      start,
      executeStep,
      getScope: () => ({ ...lastScope }),
      getCurrentLine: () => currentLine,
      getError: () => runError,
      isDone: () => done,
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) }
  }
}

export async function runPython(source) {
  try {
    const safety = validateUserCode(source, 'Python')
    if (!safety.ok) {
      return { success: false, error: safety.error }
    }
    await ensureInit()
    return await sendMessage('runFull', { source })
  } catch (err) {
    return { success: false, error: err.message || String(err) }
  }
}

export function isPythonSupported() {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined'
}
