import { createJavaScriptExecutor } from './executor'
import { validateUserCode } from './safetyCheck'

const JUDGE0_API = 'https://ce.judge0.com'
const JUDGE0_C_LANGUAGE_ID = 50

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''))
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function decodeBase64Utf8(text) {
  if (!text) return ''
  try {
    const binary = atob(text)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new TextDecoder().decode(bytes)
  } catch (_) {
    return String(text)
  }
}

export async function runCCode(source) {
  const code = (source || '').trim()
  if (!code) {
    return { ok: false, error: 'Empty code.' }
  }

  const safety = validateUserCode(code, 'C')
  if (!safety.ok) {
    return { ok: false, error: safety.error }
  }

  try {
    const createRes = await fetch(
      `${JUDGE0_API}/submissions?base64_encoded=true`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: encodeBase64Utf8(code),
          language_id: JUDGE0_C_LANGUAGE_ID,
          compiler_options: '-lm',
        }),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!createRes.ok) {
      const t = await createRes.text()
      return {
        ok: false,
        error: `Judge0 API error (${createRes.status}).`,
        output: t || undefined,
      }
    }

    const createData = await createRes.json()
    const token = createData.token
    if (!token) {
      return { ok: false, error: 'Judge0 did not return a submission token.' }
    }

    let data = null
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const getRes = await fetch(
        `${JUDGE0_API}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,status,message`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (!getRes.ok) continue
      data = await getRes.json()
      const sid = data.status?.id
      if (sid !== 1 && sid !== 2) break
    }

    if (!data || data.status?.id === 1 || data.status?.id === 2) {
      return { ok: false, error: 'Execution timed out. The program took too long to finish.' }
    }

    const statusId = data.status?.id
    const description = data.status?.description ?? ''

    if (statusId === 3) {
      const out = decodeBase64Utf8(data.stdout ?? '')
      const err = decodeBase64Utf8(data.stderr ?? '')
      const combined = [out, err].filter(Boolean).join('\n').trim()
      return { ok: true, output: combined || '(no output)' }
    }

    if (statusId === 6) {
      const compileOut = decodeBase64Utf8(data.compile_output ?? '')
      const stderr = decodeBase64Utf8(data.stderr ?? '')
      return {
        ok: false,
        error: 'Compilation error',
        output: [compileOut, stderr].filter(Boolean).join('\n').trim(),
      }
    }

    const outStd = decodeBase64Utf8(data.stdout ?? '')
    const outErr = decodeBase64Utf8(data.stderr ?? '')
    const out = outStd + (outErr ? '\n' + outErr : '')
    const runtimeMsg = decodeBase64Utf8(data.message) || description
    return {
      ok: false,
      error: `Runtime Error: ${runtimeMsg}`,
      output: out.trim() || undefined,
    }
  } catch (e) {
    const msg = e.name === 'TimeoutError'
      ? 'Request timed out. Judge0 server may be overloaded, try again later.'
      : (e.message || 'Network error. Check your internet connection or try again later.')
    return { ok: false, error: msg }
  }
}

export async function runCWebAssembly(wasmBytes, opts = {}) {
  const onOutput = opts.onOutput || (() => {})

  try {
    const buffer = wasmBytes instanceof ArrayBuffer
      ? wasmBytes
      : wasmBytes.buffer

    const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 })
    const encoder = new TextEncoder()
    let output = ''

    const importObject = {
      env: {
        memory,
        putchar(code) {
          const ch = String.fromCharCode(code)
          output += ch
          onOutput(ch)
        },
        __linear_memory: memory,
        __indirect_function_table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' }),
      },
    }

    const { instance } = await WebAssembly.instantiate(buffer, importObject)
    const main = instance.exports.main

    if (typeof main !== 'function') {
      return { ok: false, error: 'WASM module does not export main().' }
    }

    main()
    return { ok: true, output }
  } catch (e) {
    return {
      ok: false,
      error: e.message || 'Error running WebAssembly.',
    }
  }
}

function convertPrintfToConsoleLog(line) {
  const printfMatch = line.match(/printf\s*\(\s*"([^"]*)"\s*(?:,\s*(.+?))?\s*\)\s*;/)
  if (!printfMatch) return line
  const formatRaw = printfMatch[1]
  const argRaw = (printfMatch[2] || '').trim()
  const format = formatRaw.replace(/\\n/g, '').replace(/"/g, '\\"')
  if (!argRaw) {
    return line.replace(printfMatch[0], `console.log("${format}")`)
  }
  if (format.includes('%d') || format.includes('%f') || format.includes('%s')) {
    const args = argRaw.split(',').map((a) => a.trim()).filter(Boolean)
    let idx = 0
    const template = format.replace(/%[dfs]/g, () => `\${${args[idx++] ?? '""'}}`)
    return line.replace(printfMatch[0], `console.log(\`${template}\`)`)
  }
  return line.replace(printfMatch[0], `console.log("${format}", ${argRaw})`)
}

function splitByCommasTopLevel(text) {
  const parts = []
  let buf = ''
  let depthParen = 0
  let depthBracket = 0
  let depthBrace = 0
  let inString = false
  let quote = ''

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const prev = i > 0 ? text[i - 1] : ''
    if ((ch === '"' || ch === "'") && prev !== '\\') {
      if (!inString) {
        inString = true
        quote = ch
      } else if (quote === ch) {
        inString = false
        quote = ''
      }
      buf += ch
      continue
    }
    if (inString) {
      buf += ch
      continue
    }
    if (ch === '(') depthParen++
    else if (ch === ')') depthParen--
    else if (ch === '[') depthBracket++
    else if (ch === ']') depthBracket--
    else if (ch === '{') depthBrace++
    else if (ch === '}') depthBrace--

    if (ch === ',' && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      parts.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

function normalizeCExpression(expr) {
  let out = String(expr || '').trim()
  out = out.replace(/\bNULL\b/g, 'null')
  out = out.replace(/\btrue\b/g, 'true')
  out = out.replace(/\bfalse\b/g, 'false')
  out = out.replace(/\bsizeof\s*\(\s*([A-Za-z_]\w*)\s*\)\s*\/\s*sizeof\s*\(\s*\1\s*\[\s*0\s*\]\s*\)/g, '$1.length')
  out = out.replace(/\bsizeof\s*\(\s*char\s*\)/g, '1')
  out = out.replace(/\bsizeof\s*\(\s*(?:int|float)\s*\)/g, '4')
  out = out.replace(/\bsizeof\s*\(\s*(?:double|long|size_t|ssize_t)\s*\)/g, '8')
  out = out.replace(/\bsizeof\s*\(\s*([A-Za-z_]\w*)\s*\)/g, '__c_sizeof($1)')
  out = out.replace(/\((?:unsigned\s+|signed\s+)?(?:long\s+long(?:\s+int)?|int|float|double|long|short|char|size_t|ssize_t|time_t|bool)\)\s*/g, '')
  out = out.replace(/\((?:unsigned|signed)\)\s*/g, '')
  out = out.replace(/\bstrlen\s*\(\s*([^)]+)\)/g, 'String($1).length')
  out = out.replace(
    /\bstrcmp\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g,
    '((String($1) === String($2)) ? 0 : (String($1) < String($2) ? -1 : 1))'
  )
  out = out.replace(/\btime\s*\(\s*[^)]*\s*\)/g, '__c_time()')
  out = out.replace(/\brand\s*\(\s*\)/g, '__c_rand()')
  out = out.replace(/\bdifftime\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g, '__c_difftime($1, $2)')
  out = out.replace(/\blocaltime\s*\(\s*&\s*([^)]+)\)/g, '__c_localtime($1)')
  out = out.replace(/\btolower\s*\(/g, '__c_tolower(')
  out = out.replace(/\btoupper\s*\(/g, '__c_toupper(')
  out = out.replace(/\bsqrt\s*\(/g, 'Math.sqrt(')
  out = out.replace(/\bpow\s*\(/g, 'Math.pow(')
  out = out.replace(/([A-Za-z_][\w\]\)\.]*)\s*-\s*'([A-Za-z])'/g, '(__c_ord($1) - __c_ch(\'$2\'))')
  out = out.replace(/([A-Za-z_][\w\]\)\.]*)\s*\+\s*'([A-Za-z])'/g, '($1 + __c_ch(\'$2\'))')
  out = out.replace(/\-\s*'([A-Za-z])'/g, '- __c_ch(\'$1\')')
  out = out.replace(/\+\s*'([A-Za-z])'/g, '+ __c_ch(\'$1\')')
  return out
}

function convertDeclarationLine(line) {
  const declMatch = line.match(
    /^(\s*)(?:const\s+)?(?:unsigned\s+|signed\s+)?(long\s+long(?:\s+int)?|int|float|double|long|short|char|bool|size_t|ssize_t|time_t)\s+(.+);\s*$/
  )
  if (!declMatch) return null

  const indent = declMatch[1] || ''
  const baseType = declMatch[2]
  const body = declMatch[3]
  const parts = splitByCommasTopLevel(body)
  const outParts = []

  for (const p of parts) {
    const part = p.trim().replace(/^\*+/, '')
    const arr2dMatch = part.match(/^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*(?:=\s*(.+))?$/)
    if (arr2dMatch) {
      const name = arr2dMatch[1]
      const d1 = normalizeCExpression(arr2dMatch[2])
      const initRaw = arr2dMatch[4] != null ? String(arr2dMatch[4]).trim() : ''
      if (baseType === 'char') {
        if (initRaw && /^\{[\s\S]*\}$/.test(initRaw)) {
          const literals = initRaw.match(/"([^"\\]|\\.)*"/g) || []
          outParts.push(`let ${name} = [${literals.join(', ')}].map((s) => __c_strcpy("", s));`)
        } else {
          outParts.push(`let ${name} = Array(${d1}).fill(null).map(() => "");`)
        }
      } else {
        const nested = parseC2DNumericInitializerToJsLiteral(initRaw, arr2dMatch[2], arr2dMatch[3])
        if (nested != null) {
          outParts.push(`let ${name} = ${nested};`)
        } else {
          outParts.push(`let ${name} = __c_array(${d1}, Array(${d1}).fill(null).map(() => __c_array(${d2})));`)
        }
      }
      continue
    }

    const arrMatch = part.match(/^([A-Za-z_]\w*)\s*\[\s*([^\]]*)\s*\]\s*(?:=\s*(.+))?$/)
    if (arrMatch) {
      const name = arrMatch[1]
      const sizeRaw = (arrMatch[2] || '').trim()
      const initRaw = arrMatch[3] != null ? String(arrMatch[3]).trim() : ''
      if (initRaw) {
        if (/^\{[\s\S]*\}$/.test(initRaw)) {
          const inner = initRaw.slice(1, -1).trim()
          const values = inner ? splitByCommasTopLevel(inner).map((v) => normalizeCExpression(v)) : []
          const parsedSize = Number(sizeRaw)
          if (Number.isFinite(parsedSize) && parsedSize > 0) {
            const zeroFill = Math.max(0, parsedSize - values.length)
            const head = values.length ? values.join(', ') : ''
            const pad = zeroFill > 0 ? `${head ? ', ' : ''}${Array.from({ length: zeroFill }, () => '0').join(', ')}` : ''
            outParts.push(`let ${name} = __c_array(${parsedSize}, [${head}${pad}]);`)
          } else {
            outParts.push(`let ${name} = __c_array(${values.length}, [${values.join(', ')}]);`)
          }
        } else if (baseType === 'char' && /^".*"$/.test(initRaw)) {
          if (sizeRaw) {
            outParts.push(`let ${name} = __c_char_buf_init(${normalizeCExpression(sizeRaw)}, ${initRaw});`)
          } else {
            outParts.push(`let ${name} = ${initRaw};`)
          }
        } else {
          outParts.push(`let ${name} = ${normalizeCExpression(initRaw)};`)
        }
      } else if (baseType === 'char') {
        if (sizeRaw) {
          outParts.push(`let ${name} = __c_char_buf(${normalizeCExpression(sizeRaw)});`)
        } else {
          outParts.push(`let ${name} = "";`)
        }
      } else if (sizeRaw) {
        outParts.push(`let ${name} = __c_array(${normalizeCExpression(sizeRaw)});`)
      } else {
        outParts.push(`let ${name} = [];`)
      }
      continue
    }

    const scalarMatch = part.match(/^([A-Za-z_]\w*)\s*(?:=\s*(.+))?$/)
    if (!scalarMatch) {
      outParts.push(part + ';')
      continue
    }
    const name = scalarMatch[1]
    const rhs = scalarMatch[2] != null ? String(scalarMatch[2]).trim() : ''
    if (!rhs) {
      outParts.push(`let ${name};`)
    } else {
      let value = normalizeCExpression(rhs)
      if (baseType === 'char' && /^'.'$/.test(value)) {
        value = `"${value.slice(1, -1)}"`
      }
      outParts.push(`let ${name} = ${value};`)
    }
  }

  return indent + outParts.join(' ')
}

function parseC2DNumericInitializerToJsLiteral(initRaw, dim1Expr, dim2Expr) {
  const s = String(initRaw || '').trim()
  if (!/^\{[\s\S]*\}$/.test(s)) return null
  const inner = s.slice(1, -1).trim()
  const d1s = dim1Expr != null ? String(dim1Expr).trim() : ''
  const d2s = dim2Expr != null ? String(dim2Expr).trim() : ''
  const constD1 = /^[0-9]+$/.test(d1s) ? Number(d1s) : NaN
  const constD2 = /^[0-9]+$/.test(d2s) ? Number(d2s) : NaN
  const hasDims = d1s && d2s

  const zeroMatrixJs = () => {
    if (Number.isFinite(constD1) && Number.isFinite(constD2)) {
      return `__c_array(${constD1}, Array(${constD1}).fill(null).map(() => __c_array(${constD2})))`
    }
    if (hasDims) return `__c_array(${d1s}, Array(${d1s}).fill(null).map(() => __c_array(${d2s})))`
    return null
  }

  if (!inner) {
    const z = zeroMatrixJs()
    return z != null ? z : '[]'
  }

  const topParts = splitByCommasTopLevel(inner)
  const everyRowIsBrace = topParts.length > 0 && topParts.every((p) => /^\{[\s\S]*\}$/.test(p.trim()))

  if (hasDims && !everyRowIsBrace) {
    const flatScalars = topParts.every((p) => {
      const t = p.trim()
      return t && !t.includes('{') && !t.includes('}')
    })
    if (flatScalars && topParts.length >= 1) {
      const vals = topParts.map((p) => normalizeCExpression(p.trim()))
      if (Number.isFinite(constD1) && Number.isFinite(constD2)) {
        const need = constD1 * constD2
        const cells = vals.slice(0, need)
        while (cells.length < need) cells.push('0')
        const rows = []
        for (let r = 0; r < constD1; r++) {
          rows.push(`[${cells.slice(r * constD2, (r + 1) * constD2).join(', ')}]`)
        }
        return Number.isFinite(constD1)
          ? `__c_array(${constD1}, [${rows.join(', ')}])`
          : `[${rows.join(', ')}]`
      }
    }
  }

  const rowStrs = splitByCommasTopLevel(inner)
  const rows = rowStrs.map((row) => {
    const r = row.trim()
    if (/^\{[\s\S]*\}$/.test(r)) {
      const innerRow = r.slice(1, -1).trim()
      const cells = innerRow ? splitByCommasTopLevel(innerRow).map((c) => normalizeCExpression(c.trim())) : []
      return Number.isFinite(constD2) ? `__c_array(${constD2}, [${cells.join(', ')}])` : `[${cells.join(', ')}]`
    }
    return normalizeCExpression(r)
  })

  let literal = Number.isFinite(constD1) ? `__c_array(${constD1}, [${rows.join(', ')}])` : `[${rows.join(', ')}]`

  if (Number.isFinite(constD1) && Number.isFinite(constD2)) {
    const rowArrays = rowStrs.map((row) => {
      const r = row.trim()
      if (/^\{[\s\S]*\}$/.test(r)) {
        const innerRow = r.slice(1, -1).trim()
        return innerRow ? splitByCommasTopLevel(innerRow).map((c) => normalizeCExpression(c.trim())) : []
      }
      return [normalizeCExpression(r)]
    })
    while (rowArrays.length < constD1) {
      rowArrays.push([])
    }
    rowArrays.splice(constD1)
    for (let ri = 0; ri < rowArrays.length; ri++) {
      const row = rowArrays[ri]
      while (row.length < constD2) row.push('0')
      row.splice(constD2)
    }
    literal = `__c_array(${constD1}, [${rowArrays.map((cells) => `__c_array(${constD2}, [${cells.join(', ')}])`).join(', ')}])`
  }

  return literal
}

function defaultValueForCType(typeName) {
  if (typeName === 'char') return '0'
  if (typeName === 'bool') return 'false'
  if (typeName === 'float' || typeName === 'double') return '0'
  return '0'
}

function buildStructDefaultObjectExpr(structDef) {
  const parts = (structDef?.fields || []).map((f) => `${f.name}: ${defaultValueForCType(f.type)}`)
  return `{ ${parts.join(', ')} }`
}

function convertStructDeclarationLine(line, structTypes) {
  const m = line.match(/^(\s*)([A-Za-z_]\w*)\s+(.+);\s*$/)
  if (!m) return null
  const indent = m[1] || ''
  const typeName = m[2]
  const rest = m[3]
  const def = structTypes[typeName]
  if (!def) return null

  const parts = splitByCommasTopLevel(rest)
  const out = []
  for (const p of parts) {
    const part = p.trim()
    const arrMatch = part.match(/^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]$/)
    if (arrMatch) {
      const arrName = arrMatch[1]
      const sizeExpr = normalizeCExpression(arrMatch[2])
      out.push(`let ${arrName} = __c_array(${sizeExpr}, Array(${sizeExpr}).fill(null).map(() => (${buildStructDefaultObjectExpr(def)})));`)
      continue
    }
    const scalarMatch = part.match(/^([A-Za-z_]\w*)$/)
    if (scalarMatch) {
      out.push(`let ${scalarMatch[1]} = ${buildStructDefaultObjectExpr(def)};`)
      continue
    }
    out.push(`${part};`)
  }
  return indent + out.join(' ')
}

function convertLineToJs(line) {
  let out = line

  out = out.replace(/\/\/.*$/g, '')

  if (/^\s*#/.test(out)) return ''
  if (/^\s*int\s+main\s*\(\s*(void)?\s*\)\s*\{?\s*$/.test(out)) return ''
  if (/^\s*return\s+0\s*;\s*$/.test(out)) return 'void 0;'
  if (/^\s*struct\s+tm\s*\*\s*([A-Za-z_]\w*)\s*;\s*$/.test(out)) {
    return out.replace(/^\s*struct\s+tm\s*\*\s*([A-Za-z_]\w*)\s*;\s*$/, 'let $1 = null;')
  }

  const convertedDeclaration = convertDeclarationLine(out)
  if (convertedDeclaration != null) return convertedDeclaration

  out = out.replace(/\btime\s*\(\s*&\s*([A-Za-z_]\w*)\s*\)\s*;/g, '$1 = __c_time();')
  out = out.replace(/\blocaltime\s*\(\s*&\s*([A-Za-z_]\w*)\s*\)/g, '__c_localtime($1)')
  out = out.replace(
    /\bstrftime\s*\(\s*([A-Za-z_]\w*)\s*,\s*([^,]+)\s*,\s*("[^"]*")\s*,\s*([^)]+)\s*\)\s*;/g,
    '$1 = __c_strftime($2, $3, $4);'
  )
  out = out.replace(/\bsleep\s*\(\s*([^)]+)\s*\)\s*;/g, '__c_sleep($1);')

  out = out.replace(/\bprintf\s*\(/g, '__c_printf(')
  out = out.replace(/\bsrand\s*\(/g, '__c_srand(')
  out = out.replace(/\bputs\s*\(\s*([^)]+)\s*\)\s*;/g, 'console.log($1);')
  out = out.replace(/\bfprintf\s*\(\s*stderr\s*,\s*"([^"]*)"\s*(?:,\s*(.+?))?\s*\)\s*;/g, 'console.error("$1", $2);')
  out = out.replace(/\bscanf\s*\(.*\)\s*;/g, '')
  const cLvalue = '([A-Za-z_]\\w*(?:\\[[^\\]]*\\])*)'
  out = out.replace(new RegExp(`\\bstrcpy\\s*\\(\\s*${cLvalue}\\s*,\\s*([^)]+)\\)\\s*;`, 'g'), '$1 = __c_strcpy($1, $2);')
  out = out.replace(
    new RegExp(`\\bstrncpy\\s*\\(\\s*${cLvalue}\\s*,\\s*([^,]+)\\s*,\\s*([^)]+)\\)\\s*;`, 'g'),
    '$1 = __c_strncpy($1, $2, $3);'
  )
  out = out.replace(new RegExp(`\\bstrcat\\s*\\(\\s*${cLvalue}\\s*,\\s*([^)]+)\\)\\s*;`, 'g'), '$1 = __c_strcat($1, $2);')
  out = out.replace(
    /\bchar\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*=\s*\{([^}]*)\}\s*;/g,
    'let $1 = [$4].map((s) => __c_strcpy("", s));'
  )
  out = out.replace(/\bchar\s+([A-Za-z_]\w*)\s*\[\s*\]\s*=\s*"([^"]*)"\s*;/g, 'let $1 = "$2";')
  out = out.replace(/\bchar\s+([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]\s*=\s*"([^"]*)"\s*;/g, 'let $1 = __c_char_buf_init($2, "$3");')
  out = out.replace(/\bchar\s+([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]\s*;/g, 'let $1 = __c_char_buf($2);')
  out = out.replace(/\bint\s+([A-Za-z_]\w*)\s*\[\s*\]\s*=\s*\{([^}]*)\}\s*;/g, (_, name, vals) => {
    const items = vals.split(',').map((s) => s.trim()).filter(Boolean)
    return `let ${name} = __c_array(${items.length}, [${vals}]);`
  })
  out = out.replace(/\bint\s+([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]\s*=\s*\{([^}]*)\}\s*;/g, (_, name, size, vals) => {
    return `let ${name} = __c_array(${size}, [${vals}]);`
  })
  out = out.replace(/\bint\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;')
  out = out.replace(/\bint\s+([A-Za-z_]\w*)\s*;/g, 'let $1;')
  out = out.replace(/\bint\s+([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1; let $2 = $3;')
  out = out.replace(/\bint\s+([A-Za-z_]\w*)\s*=\s*([^,;]+)\s*,\s*([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2; let $3 = $4;')
  out = out.replace(/\bfor\s*\(\s*int\s+/g, 'for (let ')
  out = out.replace(/\belse\s+if\b/g, 'else if')
  out = out.replace(/\-\>/g, '.')
  out = out.replace(/\breturn\s+\*\s*([A-Za-z_]\w*)/g, 'return __c_deref($1)')
  out = out.replace(/([(,=!:?&|+\-~<>])\s*\*\s*([A-Za-z_]\w*)/g, '$1 __c_deref($2)')
  out = normalizeCExpression(out)
  out = out.replace(/\bmemset\s*\(\s*([A-Za-z_]\w*)\s*,\s*([^,]+)\s*,\s*([^)]+)\)\s*;/g, '$1.fill($2, 0, $3);')
  out = out.replace(/\bmemcpy\s*\(\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*,\s*([^)]+)\)\s*;/g, '$1 = Array.from($2).slice(0, $3);')

  return out
}

function isMainHeader(line) {
  return /\bint\s+main\s*\(\s*(?:void)?\s*\)\s*\{/.test(line)
}

function isCFunctionHeader(line) {
  return /^\s*(?:static\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:void|int|float|double|long\s+long(?:\s+int)?|long|short|char|bool|size_t|ssize_t|time_t)\s+[A-Za-z_]\w*\s*\([^;]*\)\s*\{/.test(
    line
  )
}

function convertFunctionHeaderToJs(line) {
  const m = line.match(
    /^(\s*)(?:static\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:void|int|float|double|long\s+long(?:\s+int)?|long|short|char|bool|size_t|ssize_t|time_t)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/
  )
  if (!m) return null
  const indent = m[1] || ''
  const fnName = m[2]
  const paramsRaw = (m[3] || '').trim()
  if (!paramsRaw || paramsRaw === 'void') return `${indent}function ${fnName}() {`
  const params = splitByCommasTopLevel(paramsRaw)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      p
        .replace(/\bconst\b/g, '')
        .replace(/\b(?:unsigned|signed)\b/g, '')
        .replace(/\b(?:void|int|float|double|long|short|char|bool|size_t|ssize_t|time_t)\b/g, '')
        .replace(/\*/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .trim()
    )
    .filter(Boolean)
  return `${indent}function ${fnName}(${params.join(', ')}) {`
}

function convertPointerArrayParams(line) {
  return line.replace(
    /^(\s*)(?:static\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:void|int|float|double|long\s+long(?:\s+int)?|long|short|char|bool|size_t|ssize_t)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/,
    (_, indent, fnName, paramsRaw) => {
      const params = splitByCommasTopLevel(paramsRaw)
      const converted = params.map((p) => {
        const trimmed = p.trim()
        if (!/\[[^\]]*\]/.test(trimmed)) return trimmed
        return trimmed.replace(
          /\b(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:int|float|double|long\s+long(?:\s+int)?|long|short|char|bool|size_t|ssize_t|time_t)\s+([A-Za-z_]\w*)\s*\[[^\]]*\]/,
          '$1'
        )
      })
      return `${indent}${fnName}(${converted.join(', ')}) {`
    }
  )
}

function parseFunctionMetadata(lines) {
  const meta = {}
  lines.forEach((line) => {
    const m = line.match(
      /^\s*(?:static\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:void|int|float|double|long\s+long(?:\s+int)?|long|short|char|bool|size_t|ssize_t|time_t)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/
    )
    if (!m) return
    const name = m[1]
    const paramsRaw = (m[2] || '').trim()
    if (!paramsRaw || paramsRaw === 'void') {
      meta[name] = { pointerParamIndices: new Set(), pointerParamNames: new Set() }
      return
    }
    const params = splitByCommasTopLevel(paramsRaw).map((p) => p.trim()).filter(Boolean)
    const pointerParamIndices = new Set()
    const pointerParamNames = new Set()
    params.forEach((p, idx) => {
      if (p.includes('*')) {
        pointerParamIndices.add(idx)
        const nameMatch = p.match(/([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*$/)
        if (nameMatch) pointerParamNames.add(nameMatch[1])
      }
    })
    meta[name] = { pointerParamIndices, pointerParamNames }
  })
  return meta
}

function extractDefines(lines) {
  const defs = {}
  lines.forEach((line) => {
    const m = line.match(/^\s*#define\s+([A-Za-z_]\w*)\s+(.+?)\s*$/)
    if (!m) return
    defs[m[1]] = m[2]
  })
  return defs
}

function extractStructTypedefs(lines) {
  const structTypes = {}
  const sanitized = [...lines]
  let i = 0

  while (i < sanitized.length) {
    const line = sanitized[i]
    if (!/^\s*typedef\s+struct\b/.test(line)) {
      i += 1
      continue
    }

    const start = i
    let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
    const block = [line]
    i += 1

    while (i < sanitized.length && depth > 0) {
      const inner = sanitized[i]
      block.push(inner)
      depth += (inner.match(/\{/g) || []).length - (inner.match(/\}/g) || []).length
      i += 1
    }

    const end = i - 1
    const closeLine = block[block.length - 1] || ''
    const nameMatch = closeLine.match(/\}\s*([A-Za-z_]\w*)\s*;/)
    const structName = nameMatch ? nameMatch[1] : null

    if (structName) {
      const fields = []
      for (let j = 1; j < block.length - 1; j++) {
        const fieldLine = block[j].trim()
        const fm = fieldLine.match(/^(?:unsigned\s+|signed\s+)?(int|float|double|long|short|char|bool|size_t|ssize_t)\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*;/)
        if (fm) {
          fields.push({ type: fm[1], name: fm[2] })
        }
      }
      structTypes[structName] = { fields }
    }

    for (let k = start; k <= end; k++) {
      sanitized[k] = ''
    }
  }

  return { lines: sanitized, structTypes }
}

function applyDefines(line, defines) {
  let out = line
  Object.entries(defines).forEach(([name, value]) => {
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), value)
  })
  return out
}

function applyPointerOps(line, pointerParamNames) {
  if (!pointerParamNames || !pointerParamNames.size) return line
  let out = line
  pointerParamNames.forEach((p) => {
    out = out.replace(new RegExp(`${p}\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*=\\s*([^;]+);`, 'g'), `__c_ptr_setChar(${p}, $1, $2);`)
    out = out.replace(new RegExp(`${p}\\s*\\[\\s*([^\\]]+)\\s*\\]`, 'g'), `__c_ptr_charAt(${p}, $1)`)
    out = out.replace(new RegExp(`\\*\\s*${p}\\s*=\\s*([^;]+);`), `${p}.set($1);`)
    out = out.replace(new RegExp(`\\*\\s*${p}\\b`, 'g'), `${p}.get()`)
  })
  return out
}

function splitCallArgs(argText) {
  return splitByCommasTopLevel(argText)
}

function transformPointerCall(line, functionMeta) {
  const m = line.match(/^(\s*)([A-Za-z_]\w*)\s*\((.*)\)\s*;\s*$/)
  if (!m) return line
  const indent = m[1] || ''
  const fn = m[2]
  const argsRaw = m[3] || ''
  const meta = functionMeta[fn]
  if (!meta || !meta.pointerParamIndices || meta.pointerParamIndices.size === 0) return line
  const args = splitCallArgs(argsRaw)
  const outArgs = args.map((arg, idx) => {
    const trimmed = arg.trim()
    if (!meta.pointerParamIndices.has(idx)) return trimmed
    const refMatch = trimmed.match(/^&\s*(.+)$/)
    const target = (refMatch ? refMatch[1] : trimmed).trim()
    return `__c_ref(() => ${target}, (__v) => { ${target} = __v; })`
  })
  return `${indent}${fn}(${outArgs.join(', ')});`
}

function collapseNumeric2DMatrixInitializers(lines) {
  const out = [...lines]
  const typeRe =
    '(?:unsigned\\s+|signed\\s+)?(?:long\\s+long(?:\\s+int)?|int|float|double|long|short)'
  for (let i = 0; i < out.length; i++) {
    const line = out[i]
    const m = line.match(new RegExp(`^(\\s*)(${typeRe})\\s+([A-Za-z_]\\w*)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*=\\s*\\{\\s*$`))
    if (!m) continue
    const indent = m[1] || ''
    const baseType = m[2].replace(/\s+/g, ' ').trim()
    const varName = m[3]
    const d1 = m[4]
    const d2 = m[5]
    const chunks = []
    let j = i + 1
    while (j < out.length && !/^\s*};\s*$/.test(out[j])) {
      chunks.push(out[j].trim())
      out[j] = ''
      j += 1
    }
    if (j >= out.length) continue
    out[j] = ''
    const innerJoined = chunks.join(' ').trim().replace(/,\s*$/, '')
    out[i] = `${indent}${baseType} ${varName}[${d1}][${d2}] = { ${innerJoined} };`
    i = j
  }
  return out
}

function collapseCharMatrixInitializers(lines) {
  const out = [...lines]
  for (let i = 0; i < out.length; i++) {
    const line = out[i]
    const m = line.match(/^\s*char\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*=\s*\{\s*$/)
    if (!m) continue
    const varName = m[1]
    const d1 = m[2]
    const d2 = m[3]
    const literals = []
    let j = i + 1
    while (j < out.length && !/^\s*};\s*$/.test(out[j])) {
      const matches = out[j].match(/"([^"\\]|\\.)*"/g)
      if (matches) literals.push(...matches)
      out[j] = ''
      j += 1
    }
    if (j < out.length) out[j] = ''
    out[i] = `char ${varName}[${d1}][${d2}] = { ${literals.join(', ')} };`
    i = j
  }
  return out
}

function cToJavaScript(source) {
  const rawLines = collapseNumeric2DMatrixInitializers(
    collapseCharMatrixInitializers(String(source || '').split('\n'))
  )
  const { lines, structTypes } = extractStructTypedefs(rawLines)
  const defines = extractDefines(lines)
  const functionMeta = parseFunctionMetadata(lines)
  const jsLines = []
  const lineMap = []

  const appendConvertedLine = (line, lineNo, pointerParams = new Set()) => {
    const withDefines = applyDefines(line, defines)
    const withPointers = applyPointerOps(withDefines, pointerParams)
    const withPointerCall = transformPointerCall(withPointers, functionMeta)
    const structConverted = convertStructDeclarationLine(withPointerCall, structTypes)
    const converted = structConverted != null ? structConverted : convertLineToJs(withPointerCall)
    if (!converted.trim()) return
    const forMatch = converted.match(/^(\s*)for\s*\(\s*([^;]*?)\s*;\s*([^;]*?)\s*;\s*([^)]+?)\s*\)\s*(.*)$/)
    if (forMatch) {
      const indent = forMatch[1] || ''
      const init = (forMatch[2] || '').trim()
      const cond = (forMatch[3] || '').trim()
      const update = (forMatch[4] || '').trim()
      const body = forMatch[5] || ''
      if (init) {
        const initStmt = init.replace(/^let\s+/, 'var ')
        jsLines.push(`${indent}${initStmt};`)
        lineMap.push(lineNo)
      }
      jsLines.push(`${indent}for (; ${cond}; ${update}) ${body}`)
      lineMap.push(lineNo)
      return
    }
    jsLines.push(converted)
    lineMap.push(lineNo)
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (isMainHeader(line)) break
    if (!isCFunctionHeader(line) || isMainHeader(line)) {
      i += 1
      continue
    }
    const lineNo = i + 1
    const fnNameMatch = line.match(
      /^\s*(?:static\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:void|int|float|double|long\s+long(?:\s+int)?|long|short|char|bool|size_t|ssize_t|time_t)\s+([A-Za-z_]\w*)\s*\(/
    )
    const fnName = fnNameMatch ? fnNameMatch[1] : ''
    const pointerParams = functionMeta[fnName]?.pointerParamNames || new Set()
    const headerJs = convertFunctionHeaderToJs(line)
    if (headerJs) {
      jsLines.push(headerJs)
      lineMap.push(lineNo)
    }
    let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
    i += 1
    while (i < lines.length && depth > 0) {
      const inner = lines[i]
      const innerNo = i + 1
      const openCount = (inner.match(/\{/g) || []).length
      const closeCount = (inner.match(/\}/g) || []).length
      if (/^\s*}\s*$/.test(inner)) {
        jsLines.push(inner)
        lineMap.push(innerNo)
      } else {
        appendConvertedLine(inner, innerNo, pointerParams)
      }
      depth += openCount - closeCount
      i += 1
    }
  }

  let inMain = false
  let braceDepth = 0

  lines.forEach((line, index) => {
    const lineNo = index + 1
    const openCount = (line.match(/\{/g) || []).length
    const closeCount = (line.match(/\}/g) || []).length

    if (!inMain) {
      if (isMainHeader(line)) {
        inMain = true
        braceDepth += openCount - closeCount
      }
      return
    }

    if (braceDepth <= 0) return
    if (/^\s*}\s*$/.test(line) && braceDepth === 1) {
      braceDepth += openCount - closeCount
      return
    }
    appendConvertedLine(line, lineNo)
    braceDepth += openCount - closeCount
  })

  const prelude = [
    'function __c_deref(ptr) { if (ptr === null || ptr === undefined) throw new Error("Segmentation fault (SIGSEGV): dereferencing a NULL pointer"); return ptr; }',
    'let __c_rng_seed = 1;',
    'function __c_srand(seed) { __c_rng_seed = (Number(seed) || 1) >>> 0; }',
    'function __c_rand() { __c_rng_seed = (__c_rng_seed * 1664525 + 1013904223) >>> 0; return __c_rng_seed & 0x7fffffff; }',
    'function __c_time() { return Math.floor(Date.now() / 1000); }',
    'function __c_difftime(a, b) { return Number(a ?? 0) - Number(b ?? 0); }',
    'function __c_ch(ch) { const s = String(ch ?? ""); return s ? s.charCodeAt(0) : 0; }',
    'function __c_ord(v) { const s = String(v ?? ""); return s ? s.charCodeAt(0) : 0; }',
    'function __c_sizeof(v) {',
    '  if (v && typeof v === "object" && v.__c_char_buf === true) return v.cap;',
    '  if (v && typeof v === "object" && v.__c_cap != null) return v.__c_cap;',
    '  if (Array.isArray(v)) return v.length;',
    '  if (typeof v === "string") return v.length || 1;',
    '  if (v && typeof v === "object") return Object.keys(v).length || 1;',
    '  return 8;',
    '}',
    'function __c_array(size, init) {',
    '  const cap = Math.max(0, Number(size) | 0);',
    '  let data = [];',
    '  if (init !== undefined && init !== null) {',
    '    data = Array.isArray(init) ? init.slice() : [init];',
    '  }',
    '  while (data.length < cap) data.push(0);',
    '  if (data.length > cap) data.length = cap;',
    '  data.__c_array = true;',
    '  data.__c_cap = cap;',
    '  return new Proxy(data, {',
    '    get(target, prop, receiver) {',
    '      if (prop === "__c_array" || prop === "__c_cap") return target[prop];',
    '      const idx = typeof prop === "string" && /^\\d+$/.test(prop) ? Number(prop) : NaN;',
    '      if (Number.isInteger(idx) && (idx < 0 || idx >= cap)) {',
    '        throw new Error("Out of bounds: index " + idx + " (array size " + cap + ")");',
    '      }',
    '      const val = Reflect.get(target, prop, receiver);',
    '      return typeof val === "function" ? val.bind(target) : val;',
    '    },',
    '    set(target, prop, value, receiver) {',
    '      const idx = typeof prop === "string" && /^\\d+$/.test(prop) ? Number(prop) : NaN;',
    '      if (Number.isInteger(idx) && (idx < 0 || idx >= cap)) {',
    '        throw new Error("Out of bounds: index " + idx + " (array size " + cap + ")");',
    '      }',
    '      return Reflect.set(target, prop, value, receiver);',
    '    },',
    '  });',
    '}',
    'function __c_localtime(epochSec) {',
    '  const d = new Date(Number(epochSec ?? 0) * 1000);',
    '  const start = new Date(d.getFullYear(), 0, 1);',
    '  const dayMs = 24 * 60 * 60 * 1000;',
    '  const yday = Math.floor((d - start) / dayMs);',
    '  return {',
    '    tm_sec: d.getSeconds(),',
    '    tm_min: d.getMinutes(),',
    '    tm_hour: d.getHours(),',
    '    tm_mday: d.getDate(),',
    '    tm_mon: d.getMonth(),',
    '    tm_year: d.getFullYear() - 1900,',
    '    tm_wday: d.getDay(),',
    '    tm_yday: yday,',
    '    tm_isdst: 0,',
    '  };',
    '}',
    'function __c_pad(n, len = 2) { return String(n).padStart(len, "0"); }',
    'function __c_strftime(_size, fmt, info) {',
    '  const t = info || __c_localtime(__c_time());',
    '  return String(fmt ?? "")',
    '    .replace(/%d/g, __c_pad((t.tm_mday ?? 1)))',
    '    .replace(/%m/g, __c_pad((t.tm_mon ?? 0) + 1))',
    '    .replace(/%Y/g, String((t.tm_year ?? 0) + 1900))',
    '    .replace(/%H/g, __c_pad((t.tm_hour ?? 0)))',
    '    .replace(/%M/g, __c_pad((t.tm_min ?? 0)))',
    '    .replace(/%S/g, __c_pad((t.tm_sec ?? 0)));',
    '}',
    'function __c_sleep(_seconds) { return 0; }',
    'function __c_tolower(ch) { const s = String(ch ?? ""); return s ? s[0].toLowerCase() : "\\0"; }',
    'function __c_toupper(ch) { const s = String(ch ?? ""); return s ? s[0].toUpperCase() : "\\0"; }',
    'function __c_ref(getter, setter) { return { get: getter, set: setter }; }',
    'function __c_isRef(v) { return v && typeof v.get === "function" && typeof v.set === "function"; }',
    'function __c_ptr_charAt(ref, i) {',
    '  const s = String(__c_isRef(ref) ? ref.get() : ref);',
    '  const idx = Number(i) || 0;',
    '  return idx >= 0 && idx < s.length ? s[idx] : "\\0";',
    '}',
    'function __c_ptr_setChar(ref, i, ch) {',
    '  const s = String(__c_isRef(ref) ? ref.get() : ref);',
    '  const idx = Number(i) || 0;',
    '  const c = (typeof ch === "number" && Number.isFinite(ch)) ? String.fromCharCode(ch) : String(ch ?? "");',
    '  if (idx < 0) return;',
    '  const next = (idx >= s.length)',
    '    ? (s + "\\0".repeat(idx - s.length) + (c[0] ?? "\\0"))',
    '    : (s.slice(0, idx) + (c[0] ?? "\\0") + s.slice(idx + 1));',
    '  if (__c_isRef(ref)) ref.set(next);',
    '  return next;',
    '}',
    'function __c_is_char_buf(v) { return v && typeof v === "object" && v.__c_char_buf === true; }',
    'function __c_char_buf(cap) { return { __c_char_buf: true, cap: Math.max(0, Number(cap) | 0), s: "" }; }',
    'function __c_buf_str(v) {',
    '  if (__c_is_char_buf(v)) return v.s;',
    '  if (__c_isRef(v)) return String(v.get() ?? "");',
    '  return String(v ?? "");',
    '}',
    'function __c_char_buf_init(cap, init) {',
    '  const b = __c_char_buf(cap);',
    '  __c_strcpy(b, init);',
    '  return b;',
    '}',
    'function __c_strcpy(dst, src) {',
    '  const text = String(src ?? "");',
    '  const need = text.length + 1;',
    '  if (__c_is_char_buf(dst)) {',
    '    if (need > dst.cap) throw new Error("buffer overflow: strcpy needs " + need + " bytes (incl. \\\'\\\\0\\\') but destination capacity is " + dst.cap);',
    '    dst.s = text;',
    '    return dst;',
    '  }',
    '  return text;',
    '}',
    'function __c_strncpy(dst, src, n) {',
    '  const lim = Math.max(0, Number(n) | 0);',
    '  const text = String(src ?? "").slice(0, lim);',
    '  const need = text.length + 1;',
    '  if (__c_is_char_buf(dst)) {',
    '    if (need > dst.cap) throw new Error("buffer overflow: strncpy needs " + need + " bytes (incl. \\\'\\\\0\\\') but destination capacity is " + dst.cap);',
    '    dst.s = text;',
    '    return dst;',
    '  }',
    '  return text;',
    '}',
    'function __c_strcat(dst, src) {',
    '  const add = String(src ?? "");',
    '  if (__c_is_char_buf(dst)) {',
    '    const combined = dst.s + add;',
    '    const need = combined.length + 1;',
    '    if (need > dst.cap) throw new Error("buffer overflow: strcat needs " + need + " bytes (incl. \\\'\\\\0\\\') but destination capacity is " + dst.cap);',
    '    dst.s = combined;',
    '    return dst;',
    '  }',
    '  return String(dst ?? "") + add;',
    '}',
    'function __c_printf(fmt, ...args) {',
    "  const format = String(fmt ?? '');",
    '  let ai = 0;',
    "  const out = format.replace(/%[-+ #0]*\\d*(?:\\.\\d+)?(?:hh|h|ll|l|L)?[cdfsulxXo]/g, (token) => {",
    '    const val = args[ai++];',
    "    const t = token[token.length - 1];",
    "    if (t === 's') return __c_buf_str(val);",
    "    if (t === 'c') {",
    '      const v = val;',
    '      if (typeof v === "number" && Number.isFinite(v)) return String.fromCharCode(v);',
    '      const s = String(v ?? "");',
    '      return s ? s[0] : "\\0";',
    '    }',
    "    if (t === 'd' || t === 'u') return String(Number(val ?? 0) | 0);",
    "    if (t === 'f') {",
    "      const m = token.match(/\\.(\\d+)f$/);",
    '      const p = m ? Number(m[1]) : 6;',
    '      const n = Number(val ?? 0);',
    '      return Number.isFinite(n) ? n.toFixed(p) : String(val ?? 0);',
    '    }',
    "    return String(val ?? '');",
    '  });',
    '  console.log(out.replace(/\\n$/g, ""));',
    '}',
  ]
  return { code: [...prelude, ...jsLines].join('\n'), lineMap: [...Array(prelude.length).fill(null), ...lineMap] }
}

export function createCExecutor(source, opts = {}) {
  const raw = String(source || '').trim()
  if (!raw) return { ok: false, error: 'Empty code.', runRemote: false }

  const safety = validateUserCode(raw, 'C')
  if (!safety.ok) {
    return { ok: false, error: safety.error, runRemote: false }
  }

  if (
    /\b(open|read|write|close|fopen|fread|fwrite|fclose|fork|exec|pipe|dup2|lseek|mmap)\s*\(/.test(raw)
  ) {
    return {
      ok: false,
      error: 'This C code uses system/IO APIs that are not supported by the browser stepper.',
      runRemote: true,
    }
  }

  const { code: jsSource, lineMap } = cToJavaScript(raw)
  const sourceLines = String(source || '').split('\n')
  const isDisplayableCLine = (lineNo) => {
    const line = sourceLines[lineNo - 1] ?? ''
    const t = String(line).trim()
    if (!t) return false
    if (t.startsWith('//')) return false
    if (t.startsWith('#')) return false
    if (t === '{' || t === '}') return false
    if (t.startsWith('typedef struct')) return false
    if (/^(int|float|double|char|bool|size_t|ssize_t)\s+[A-Za-z_]\w*\s*;\s*$/.test(t)) return false
    return true
  }
  const exec = createJavaScriptExecutor(jsSource, opts)
  if (!exec.ok) {
    const m = String(exec.error || '').match(/\((\d+):(\d+)\)/)
    let detail = ''
    if (m) {
      const lineNo = Number(m[1])
      const colNo = Number(m[2])
      const lines = jsSource.split('\n')
      const badLine = lines[lineNo - 1] ?? ''
      const mapped = lineMap[lineNo - 1]
      detail = `\n[JS ${lineNo}:${colNo}] ${badLine}${mapped ? `\n[Mapped C line] ${mapped}` : ''}`
    }
    return {
      ok: false,
      error: `C parsing error: ${exec.error}${detail}`,
      runRemote: true,
    }
  }

  const mapLineToOriginal = (line) => {
    if (line == null) return null
    const mapped = lineMap[line - 1] ?? null
    if (mapped == null) return null
    if (isDisplayableCLine(mapped)) return mapped

    for (let next = mapped + 1; next <= Math.min(mapped + 3, sourceLines.length); next++) {
      if (isDisplayableCLine(next)) return next
    }
    return null
  }

  const toMappedResult = (result) => ({
    ...result,
    line: mapLineToOriginal(result.line),
  })

  const advanceUntilVisibleLine = async (maxSteps = 2000) => {
    let steps = 0
    while (steps < maxSteps) {
      const current = mapLineToOriginal(exec.getCurrentLine())
      if (current != null || exec.isDone() || exec.getError()) break
      const res = await exec.executeStep()
      if (res.done) break
      steps += 1
    }
  }

  return {
    ok: true,
    start: async () => {
      const started = await exec.start()
      await advanceUntilVisibleLine()
      return started
    },
    executeStep: async () => {
      let result = await exec.executeStep()
      let guard = 0
      while (!result.done && mapLineToOriginal(result.line) == null && guard < 2000) {
        result = await exec.executeStep()
        guard += 1
      }
      return toMappedResult(result)
    },
    getScope: exec.getScope,
    getCurrentLine: () => mapLineToOriginal(exec.getCurrentLine()),
    getError: exec.getError,
    isDone: exec.isDone,
  }
}
