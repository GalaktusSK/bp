const LANG = {
  JavaScript: 'JavaScript',
  Python: 'Python',
  C: 'C',
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripForAnalysis(source, language) {
  let s = String(source ?? '')
  if (language === LANG.Python) {
    s = s.replace(/'''[\s\S]*?'''/g, ' ').replace(/"""[\s\S]*?"""/g, ' ')
    s = s.replace(/(#.*)$/gm, ' ')
  } else {
    s = s.replace(/\/\*[\s\S]*?\*\//g, ' ')
    s = s.replace(/\/\/.*$/gm, ' ')
  }
  s = s
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
  return s
}

const LOOP_PATTERNS = {
  JavaScript: [
    { re: /\bwhile\s*\(\s*true\s*\)/i, label: 'while (true)' },
    { re: /\bwhile\s*\(\s*1\s*\)/, label: 'while (1)' },
    { re: /\bwhile\s*\(\s*!0\s*\)/, label: 'while (!0)' },
    { re: /\bfor\s*\(\s*;\s*;\s*\)/, label: 'for (;;)' },
    { re: /\bdo\s*\{[\s\S]*?\}\s*while\s*\(\s*true\s*\)/i, label: 'do { ... } while (true)' },
    { re: /\bdo\s*\{[\s\S]*?\}\s*while\s*\(\s*1\s*\)/, label: 'do { ... } while (1)' },
  ],
  Python: [
    { re: /\bwhile\s+True\s*:/i, label: 'while True:' },
    { re: /\bwhile\s+1\s*:/, label: 'while 1:' },
    { re: /\bwhile\s*\(\s*True\s*\)\s*:/i, label: 'while(True):' },
    { re: /\bwhile\s*\(\s*1\s*\)\s*:/, label: 'while(1):' },
  ],
  C: [
    { re: /\bwhile\s*\(\s*1\s*\)/, label: 'while (1)' },
    { re: /\bwhile\s*\(\s*true\s*\)/i, label: 'while (true)' },
    { re: /\bfor\s*\(\s*;\s*;\s*\)/, label: 'for (;;)' },
    { re: /\bdo\s*\{[\s\S]*?\}\s*while\s*\(\s*1\s*\)/, label: 'do { ... } while (1)' },
  ],
}

function detectInfiniteLoop(source, language) {
  const stripped = stripForAnalysis(source, language)
  const patterns = LOOP_PATTERNS[language] || []
  for (const { re, label } of patterns) {
    if (re.test(stripped)) {
      return { hit: true, label }
    }
  }
  return { hit: false }
}

function sliceBraceBody(source, openBraceIndex) {
  let depth = 0
  for (let i = openBraceIndex; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(openBraceIndex + 1, i)
    }
  }
  return ''
}

function extractBraceFunctions(source, headerRe) {
  const fns = []
  const re = new RegExp(headerRe, 'g')
  let m
  while ((m = re.exec(source))) {
    const name = m[1]
    const braceIdx = source.indexOf('{', m.index + m[0].length - 1)
    if (braceIdx < 0) continue
    fns.push({ name, body: sliceBraceBody(source, braceIdx) })
  }
  return fns
}

function extractPythonFunctions(source) {
  const fns = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)def\s+(\w+)\s*\([^)]*\)\s*:/)
    if (!m) continue
    const name = m[2]
    const baseIndent = m[1].length
    const bodyLines = []
    let j = i + 1
    while (j < lines.length) {
      const line = lines[j]
      if (line.trim() === '') {
        j++
        continue
      }
      const indent = (line.match(/^(\s*)/) || ['', ''])[1].length
      if (indent <= baseIndent) break
      bodyLines.push(line.trim())
      j++
    }
    fns.push({ name, body: bodyLines.join('\n') })
  }
  return fns
}

function bodyHasGuard(body) {
  return /\b(if|elif|else|while|for|switch|case|return\s+(?:0|1|-?\d+|false|true|null|None)\b)/i.test(body)
}

function isUnguardedRecursion(body, name) {
  const callRe = new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`)
  if (!callRe.test(body)) return false
  if (bodyHasGuard(body)) return false
  const trimmed = body.trim()
  if (new RegExp(`^${escapeRegExp(name)}\\s*\\(`).test(trimmed)) return true
  if (new RegExp(`^return\\s+${escapeRegExp(name)}\\s*\\(`).test(trimmed)) return true
  if (new RegExp(`;\\s*${escapeRegExp(name)}\\s*\\(`).test(trimmed)) return true
  return true
}

function detectInfiniteRecursion(source, language) {
  const stripped = stripForAnalysis(source, language)
  let functions = []

  if (language === LANG.JavaScript) {
    functions = [
      ...extractBraceFunctions(stripped, 'function\\s+(\\w+)\\s*\\([^)]*\\)\\s*'),
      ...extractBraceFunctions(stripped, '(?:const|let|var)\\s+(\\w+)\\s*=\\s*function\\s*\\([^)]*\\)\\s*'),
      ...extractBraceFunctions(stripped, '(?:const|let|var)\\s+(\\w+)\\s*=\\s*\\([^)]*\\)\\s*=>\\s*'),
    ]
  } else if (language === LANG.Python) {
    functions = extractPythonFunctions(stripped)
  } else if (language === LANG.C) {
    functions = extractBraceFunctions(
      stripped,
      '(?:void|int|char|long|short|float|double|bool|size_t|unsigned\\s+int)\\s+(\\w+)\\s*\\([^)]*\\)\\s*'
    )
  }

  for (const { name, body } of functions) {
    if (isUnguardedRecursion(body, name)) {
      return { hit: true, name }
    }
  }
  return { hit: false }
}

export function validateUserCode(source, language) {
  const lang = language === LANG.Python || language === LANG.C ? language : LANG.JavaScript
  const trimmed = String(source ?? '').trim()
  if (!trimmed) return { ok: true }

  const loop = detectInfiniteLoop(trimmed, lang)
  if (loop.hit) {
    return {
      ok: false,
      error: `Infinite loop detected (${loop.label}). Fix the loop condition before running.`,
    }
  }

  const rec = detectInfiniteRecursion(trimmed, lang)
  if (rec.hit) {
    return {
      ok: false,
      error: `Possible infinite recursion in function '${rec.name}' (no exit condition). Add a base case before running.`,
    }
  }

  return { ok: true }
}
