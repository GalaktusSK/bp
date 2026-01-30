/**
 * Runs Python code in the browser via Pyodide (loaded from CDN).
 * Supports full run and step-by-step execution via sys.settrace.
 */

const PYODIDE_VERSION = 'v0.29.3'
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full`
let pyodideInstance = null

async function getPyodide() {
  if (pyodideInstance) return pyodideInstance
  const script = document.createElement('script')
  script.src = `${PYODIDE_BASE}/pyodide.js`
  script.async = true
  document.head.appendChild(script)
  await new Promise((resolve, reject) => {
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load Pyodide'))
  })
  if (typeof globalThis.loadPyodide !== 'function') {
    throw new Error('loadPyodide not found')
  }
  pyodideInstance = await globalThis.loadPyodide({ indexURL: PYODIDE_BASE })
  return pyodideInstance
}

/**
 * One-time setup of stepping globals and trace. Call after getPyodide().
 */
function setupSteppingGlobals(pyodide) {
  pyodide.runPython(`
import sys
from io import StringIO
class _OCV_StopStepping(Exception): pass
_ocv_ns = {"sys": sys, "StringIO": StringIO}
_ocv_ns["_ocv_buffer"] = StringIO()
_ocv_ns["_ocv_line_count"] = 0
_ocv_ns["_ocv_step_limit"] = 0
_ocv_ns["_ocv_stopped_at_line"] = None
def _ocv_trace(frame, event, arg):
  if event == "line":
    _ocv_ns["_ocv_line_count"] = _ocv_ns["_ocv_line_count"] + 1
    if _ocv_ns["_ocv_line_count"] > _ocv_ns["_ocv_step_limit"]:
      _ocv_ns["_ocv_stopped_at_line"] = frame.f_lineno
      raise _OCV_StopStepping()
  return _ocv_trace
_ocv_ns["_ocv_trace"] = _ocv_trace
_ocv_ns["_OCV_StopStepping"] = _OCV_StopStepping
`)
}

/**
 * Create a Python executor for step-by-step execution.
 * Returns { ok: true, start, executeStep, getScope, getCurrentLine, getError } or { ok: false, error }.
 * start() and executeStep() are async.
 */
export async function createPythonExecutor(source, opts = {}) {
  try {
    const pyodide = await getPyodide()
    if (!pyodide.globals.get('_ocv_ns')) {
      setupSteppingGlobals(pyodide)
    }
    const ns = pyodide.globals.get('_ocv_ns')
    ns.set('_ocv_source', pyodide.toPy(source))
    pyodide.runPython(`
_skip = {"sys", "StringIO", "_ocv_buffer", "_ocv_trace", "_ocv_line_count", "_ocv_step_limit", "_ocv_stopped_at_line", "_ocv_source", "_OCV_StopStepping"}
for k in list(_ocv_ns.keys()):
  if k not in _skip and not k.startswith("_ocv"):
    del _ocv_ns[k]
`)

    let stepIndex = 0
    let currentLine = null
    let lastScope = {}
    let lastOutput = ''
    let runError = null
    let done = false

    const isOurStopStepping = (err) =>
      err && typeof err.message === 'string' && (err.message.includes('StopStepping') || err.message.includes('_OCV_StopStepping'))

    const runOneStep = async () => {
      runError = null
      try {
        pyodide.runPython(`
_ocv_ns["_ocv_step_limit"] = ${stepIndex}
_ocv_ns["_ocv_line_count"] = 0
_ocv_ns["_ocv_stopped_at_line"] = None
_ocv_ns["_ocv_buffer"].truncate(0)
_ocv_ns["_ocv_buffer"].seek(0)
_ocv_ns["sys"].stdout = _ocv_ns["_ocv_buffer"]
_ocv_ns["sys"].stderr = _ocv_ns["_ocv_buffer"]
_ocv_ns["sys"].settrace(_ocv_ns["_ocv_trace"])
_ocv_ns["_ocv_run_error"] = None
try:
  exec(_ocv_ns["_ocv_source"], _ocv_ns)
  _ocv_ns["_ocv_done"] = True
except _OCV_StopStepping:
  _ocv_ns["_ocv_done"] = False
except Exception as e:
  _ocv_ns["_ocv_done"] = True
  _ocv_ns["_ocv_run_error"] = str(e)
_ocv_ns["sys"].settrace(None)
_ocv_ns["_ocv_output"] = _ocv_ns["_ocv_buffer"].getvalue()
_skip = {"sys", "StringIO", "_ocv_buffer", "_ocv_trace", "_ocv_line_count", "_ocv_step_limit", "_ocv_stopped_at_line", "_ocv_source", "_OCV_StopStepping", "_ocv_done", "_ocv_output", "_ocv_run_error"}
_ocv_ns["_ocv_vars"] = [(k, repr(v)) for k, v in _ocv_ns.items() if k not in _skip and not k.startswith("_ocv") and not k.startswith("_")]
`)
      } catch (pyErr) {
        if (isOurStopStepping(pyErr)) {
          runError = null
          pyodide.runPython(`
_ocv_ns["sys"].settrace(None)
_ocv_ns["_ocv_done"] = False
_ocv_ns["_ocv_stopped_at_line"] = _ocv_ns.get("_ocv_stopped_at_line")
_ocv_ns["_ocv_output"] = _ocv_ns["_ocv_buffer"].getvalue()
_skip = {"sys", "StringIO", "_ocv_buffer", "_ocv_trace", "_ocv_line_count", "_ocv_step_limit", "_ocv_stopped_at_line", "_ocv_source", "_OCV_StopStepping", "_ocv_done", "_ocv_output", "_ocv_run_error"}
_ocv_ns["_ocv_vars"] = [(k, repr(v)) for k, v in _ocv_ns.items() if k not in _skip and not k.startswith("_ocv") and not k.startswith("_")]
`)
        } else {
          runError = pyErr.message || String(pyErr)
        }
      }
      let stepDone = true
      let stoppedAt = null
      let varsList = null
      try {
        stepDone = !!pyodide.runPython('_ocv_ns.get("_ocv_done", True)')
        const stoppedAtVal = pyodide.runPython('_ocv_ns.get("_ocv_stopped_at_line")')
        stoppedAt = stoppedAtVal !== undefined && stoppedAtVal !== null ? Number(stoppedAtVal) : null
        lastOutput = String(pyodide.runPython('_ocv_ns.get("_ocv_output", "")') ?? '')
        if (!runError) {
          try {
            const errVal = pyodide.runPython('_ocv_ns.get("_ocv_run_error")')
            if (errVal !== undefined && errVal !== null) {
              runError = typeof errVal === 'string' ? errVal : String(errVal)
            }
          } catch (_) {}
        }
        varsList = pyodide.runPython('_ocv_ns.get("_ocv_vars", [])')
      } catch (_) {
        lastOutput = ''
      }
      lastScope = {}
      if (varsList != null) {
        try {
          const arr = typeof varsList.toJs === 'function' ? varsList.toJs() : null
          if (Array.isArray(arr)) {
            for (const pair of arr) {
              const k = pair && (pair[0] ?? pair.get?.(0))
              const v = pair && (pair[1] ?? pair.get?.(1))
              if (k !== undefined) lastScope[String(k)] = String(v ?? '')
            }
          } else {
            const len = Number(varsList.length) || 0
            for (let i = 0; i < len; i++) {
              try {
                const pair = varsList.get(i)
                const k = pair.get(0)
                const v = pair.get(1)
                lastScope[String(k)] = String(v)
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
      currentLine = stoppedAt !== undefined && stoppedAt !== null ? Number(stoppedAt) : null
      lastOutput = lastOutput != null ? String(lastOutput) : ''
      done = stepDone === true
      if (currentLine != null && !runError) done = false
      return { done, line: currentLine, scope: lastScope, output: lastOutput, error: runError }
    }

    const start = async () => {
      stepIndex = 0
      const result = await runOneStep()
      return result
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

/**
 * Run Python source. Returns { success, output, vars, error }.
 * @param {string} source
 * @returns {Promise<{ success: boolean, output?: string, vars?: Array<{ name: string, value: string }>, error?: string }>}
 */
export async function runPython(source) {
  try {
    const pyodide = await getPyodide()

    pyodide.runPython(`
import sys
from io import StringIO
_ocv_buffer = StringIO()
sys.stdout = _ocv_buffer
sys.stderr = _ocv_buffer
`)
    let runError = null
    try {
      pyodide.runPython(source)
    } catch (err) {
      runError = err.message || String(err)
    }
    pyodide.runPython(`
_ocv_out = _ocv_buffer.getvalue()
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`)
    const output = pyodide.runPython('_ocv_out') || ''
    const fullOutput = (runError ? runError + '\n' : '') + output

    let varsList = []
    try {
      const g = pyodide.runPython(`
_skip = {'sys', 'StringIO', '_ocv_buffer', '_ocv_out', '_skip', '_ocv_g'}
_ocv_g = [(k, repr(globals()[k])) for k in dir() if not k.startswith('_') and k not in _skip]
_ocv_g
`)
      if (g && Array.isArray(g) && g.length) {
        varsList = g.map(([name, value]) => ({ name: String(name), value: String(value) }))
      }
    } catch (_) {}

    return {
      success: !runError,
      output: fullOutput.trim(),
      vars: varsList,
      error: runError || undefined,
    }
  } catch (err) {
    return {
      success: false,
      error: err.message || String(err),
    }
  }
}

export function isPythonSupported() {
  return typeof window !== 'undefined'
}
