const PYODIDE_VERSION = 'v0.29.3'
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full`
let pyodide = null

async function initPyodide() {
  if (pyodide) return
  importScripts(`${PYODIDE_BASE}/pyodide.js`)
  pyodide = await loadPyodide({ indexURL: PYODIDE_BASE })
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

function resetNamespace(source) {
  pyodide.globals.get('_ocv_ns').set('_ocv_source', source)
  pyodide.runPython(`
_skip = {"sys", "StringIO", "_ocv_buffer", "_ocv_trace", "_ocv_line_count", "_ocv_step_limit", "_ocv_stopped_at_line", "_ocv_source", "_OCV_StopStepping"}
for k in list(_ocv_ns.keys()):
  if k not in _skip and not k.startswith("_ocv"):
    del _ocv_ns[k]
`)
}

function isStopStepping(err) {
  return err && typeof err.message === 'string' &&
    (err.message.includes('StopStepping') || err.message.includes('_OCV_StopStepping'))
}

function extractVars() {
  const scope = {}
  try {
    const varsList = pyodide.runPython('_ocv_ns.get("_ocv_vars", [])')
    if (varsList == null) return scope
    const arr = typeof varsList.toJs === 'function' ? varsList.toJs() : null
    if (Array.isArray(arr)) {
      for (const pair of arr) {
        const k = pair && (pair[0] ?? pair.get?.(0))
        const v = pair && (pair[1] ?? pair.get?.(1))
        if (k !== undefined) scope[String(k)] = String(v ?? '')
      }
    } else if (varsList.length) {
      const len = Number(varsList.length) || 0
      for (let i = 0; i < len; i++) {
        try {
          const pair = varsList.get(i)
          scope[String(pair.get(0))] = String(pair.get(1))
        } catch (_) {}
      }
    }
  } catch (_) {}
  return scope
}

function runOneStep(stepIndex) {
  let runError = null
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
    if (isStopStepping(pyErr)) {
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
  let output = ''
  try {
    stepDone = !!pyodide.runPython('_ocv_ns.get("_ocv_done", True)')
    const stoppedAtVal = pyodide.runPython('_ocv_ns.get("_ocv_stopped_at_line")')
    stoppedAt = stoppedAtVal != null ? Number(stoppedAtVal) : null
    output = String(pyodide.runPython('_ocv_ns.get("_ocv_output", "")') ?? '')
    if (!runError) {
      try {
        const errVal = pyodide.runPython('_ocv_ns.get("_ocv_run_error")')
        if (errVal != null) runError = typeof errVal === 'string' ? errVal : String(errVal)
      } catch (_) {}
    }
  } catch (_) {}

  const scope = extractVars()
  const line = stoppedAt != null ? Number(stoppedAt) : null
  let done = stepDone === true
  if (line != null && !runError) done = false
  return { done, line, scope, output, error: runError }
}

function runFull(source) {
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

  let vars = []
  try {
    const g = pyodide.runPython(`
_skip = {'sys', 'StringIO', '_ocv_buffer', '_ocv_out', '_skip', '_ocv_g'}
_ocv_g = [(k, repr(globals()[k])) for k in dir() if not k.startswith('_') and k not in _skip]
_ocv_g
`)
    if (g && Array.isArray(g) && g.length) {
      vars = g.map(([name, value]) => ({ name: String(name), value: String(value) }))
    }
  } catch (_) {}

  return { success: !runError, output: fullOutput.trim(), vars, error: runError || undefined }
}

self.onmessage = async (e) => {
  const { id, type } = e.data
  try {
    if (type === 'init') {
      await initPyodide()
      self.postMessage({ id, result: { ok: true } })
    } else if (type === 'createExecutor') {
      resetNamespace(e.data.source)
      self.postMessage({ id, result: { ok: true } })
    } else if (type === 'step') {
      const result = runOneStep(e.data.stepIndex)
      self.postMessage({ id, result })
    } else if (type === 'runFull') {
      const result = runFull(e.data.source)
      self.postMessage({ id, result })
    }
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) })
  }
}
