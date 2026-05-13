export function initGutter(textarea, gutter) {
  updateGutter(textarea, gutter)
  textarea.addEventListener('input', () => updateGutter(textarea, gutter))
  textarea.addEventListener('scroll', () => {
    gutter.scrollTop = textarea.scrollTop
  })
}

export function updateGutter(textarea, gutter) {
  const lines = textarea.value.split('\n').length || 1
  const numbers = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join('')
  gutter.innerHTML = numbers
}

export function collectVars(debugState) {
  return debugState.lines.map((line, idx) => ({
    name: `line_${idx + 1}`,
    value: line.trim() || '(empty)',
  }))
}

function escapeHtml(s) {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function parsePythonListRepr(input) {
  const s = String(input).trim()
  if (!s.startsWith('[')) return null
  let i = 0
  const n = s.length
  const isIdentChar = (c) => /[a-zA-Z0-9_]/.test(c || '')

  function skipWs() {
    while (i < n && /\s/.test(s[i])) i += 1
  }
  function peek() {
    return i < n ? s[i] : ''
  }

  function parseString(quote) {
    let out = ''
    while (i < n) {
      const ch = s[i++]
      if (ch === '\\' && i < n) {
        out += s[i++]
        continue
      }
      if (ch === quote) return out
      out += ch
    }
    throw new Error('unterminated string')
  }

  function parseAtom() {
    skipWs()
    const ch = peek()
    if (ch === "'" || ch === '"') {
      i += 1
      return parseString(ch)
    }
    if (s.startsWith('None', i) && !isIdentChar(s[i + 4])) {
      i += 4
      return null
    }
    if (s.startsWith('null', i) && !isIdentChar(s[i + 4])) {
      i += 4
      return null
    }
    if (s.startsWith('True', i) && !isIdentChar(s[i + 4])) {
      i += 4
      return true
    }
    if (s.startsWith('False', i) && !isIdentChar(s[i + 5])) {
      i += 5
      return false
    }
    const rest = s.slice(i)
    const num = rest.match(/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/)
    if (num) {
      i += num[0].length
      const v = num[0]
      if (/[.eE]/.test(v)) return parseFloat(v)
      return parseInt(v, 10)
    }
    throw new Error('bad atom')
  }

  function parseItem() {
    skipWs()
    if (peek() === '[') return parseList()
    return parseAtom()
  }

  function parseList() {
    skipWs()
    if (peek() !== '[') throw new Error('expected [')
    i += 1
    skipWs()
    const items = []
    if (peek() === ']') {
      i += 1
      return items
    }
    while (i < n) {
      items.push(parseItem())
      skipWs()
      if (peek() === ']') {
        i += 1
        return items
      }
      if (peek() === ',') {
        i += 1
        skipWs()
        if (peek() === ']') {
          i += 1
          return items
        }
        continue
      }
      throw new Error('expected , or ]')
    }
    throw new Error('eof in list')
  }

  try {
    const out = parseList()
    skipWs()
    if (i !== n) return null
    return out
  } catch {
    return null
  }
}

function escapeCell(v) {
  if (v === null || v === undefined) return '<span class="var-cell-null">null</span>'
  if (typeof v === 'boolean') return `<span class="var-cell-bool">${escapeHtml(String(v))}</span>`
  if (typeof v === 'bigint') return escapeHtml(String(v))
  if (Array.isArray(v)) return `<span class="var-cell-nested">${escapeHtml(JSON.stringify(v))}</span>`
  if (typeof v === 'object' && v !== null) return escapeHtml(JSON.stringify(v))
  return escapeHtml(String(v))
}

function isBinaryArrayBufferView(v) {
  return v != null && typeof v === 'object' && ArrayBuffer.isView(v) && !(v instanceof DataView)
}

function unwrapVector(value) {
  if (Array.isArray(value)) return value
  if (isBinaryArrayBufferView(value)) return Array.from(value)
  return null
}

function unwrapMatrixRow(row) {
  if (Array.isArray(row)) return row
  if (isBinaryArrayBufferView(row)) return Array.from(row)
  return null
}

function isUniform2D(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false
  for (let i = 0; i < arr.length; i++) {
    if (unwrapMatrixRow(arr[i]) == null) return false
  }
  return true
}

function tryParseJsonArrayString(input) {
  const s = String(input).trim()
  if (!s.startsWith('[')) return null
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

function tryParseJsonObjectString(input) {
  const s = String(input).trim()
  if (!s.startsWith('{')) return null
  try {
    const v = JSON.parse(s)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

function isScalarish(x) {
  if (x === null || x === undefined) return true
  const t = typeof x
  return t === 'number' || t === 'string' || t === 'boolean' || t === 'bigint' || t === 'symbol'
}

function renderDataMatrixTable(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '<div class="var-table-wrap"><span class="var-inline muted">[]</span></div>'
  }
  if (isUniform2D(data)) {
    const rowsNorm = Array.from({ length: data.length }, (_, i) => unwrapMatrixRow(data[i]) || [])
    const cols = Math.max(...rowsNorm.map((r) => r.length), 1)
    const rowsHtml = rowsNorm
      .map((r) => {
        const padded = r.slice()
        while (padded.length < cols) padded.push('')
        const cells = padded.map((cell) => `<div class="var-matrix-cell">${escapeCell(cell)}</div>`).join('')
        return `<div class="var-matrix-row" role="row">${cells}</div>`
      })
      .join('')
    return `<div class="var-table-wrap"><div class="var-matrix var-matrix--2d" role="grid" style="--var-matrix-cols:${cols}">${rowsHtml}</div></div>`
  }
  const dense = Array.from({ length: data.length }, (_, i) => data[i])
  if (dense.every((x) => !Array.isArray(x) && !isBinaryArrayBufferView(x) && isScalarish(x))) {
    const cols = data.length || 1
    const cells = dense.map((cell) => `<div class="var-matrix-cell">${escapeCell(cell)}</div>`).join('')
    return `<div class="var-table-wrap"><div class="var-matrix var-matrix--1d" role="grid" style="--var-matrix-cols:${cols}"><div class="var-matrix-row" role="row">${cells}</div></div></div>`
  }
  return null
}

const MAX_STRUCT_ARRAY_ROWS = 200

function isPlainStructRow(o) {
  if (o === null || typeof o !== 'object' || Array.isArray(o) || isBinaryArrayBufferView(o)) return false
  if (o instanceof Date || o instanceof RegExp) return false
  return true
}

function collectStructArrayKeys(rows) {
  const ordered = []
  const seen = new Set()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!isPlainStructRow(row)) return null
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k)
        ordered.push(k)
      }
    }
  }
  return ordered
}

function isDenseArrayOfPlainObjects(data) {
  for (let i = 0; i < data.length; i++) {
    if (!isPlainStructRow(data[i])) return false
  }
  return true
}

function renderStructArrayCell(v) {
  if (v === null || v === undefined) return '<span class="var-cell-null">null</span>'
  if (typeof v === 'boolean') return `<span class="var-cell-bool">${escapeHtml(String(v))}</span>`
  if (typeof v === 'bigint') return escapeHtml(String(v))
  if (typeof v === 'object') {
    return `<span class="var-struct-cell-json">${escapeHtml(JSON.stringify(v))}</span>`
  }
  const s = String(v)
  if (s.length > 80) return `<span class="var-struct-cell-trunc" title="${escapeHtml(s)}">${escapeHtml(s.slice(0, 77))}…</span>`
  return escapeHtml(s)
}

function renderStructArrayTable(data) {
  if (!Array.isArray(data) || data.length === 0) return null
  if (!isDenseArrayOfPlainObjects(data)) return null
  const keys = collectStructArrayKeys(data)
  if (keys == null || !keys.length) return null

  const headCells = [
    `<div class="var-struct-hcell var-struct-idx">#</div>`,
    ...keys.map((k) => `<div class="var-struct-hcell">${escapeHtml(k)}</div>`),
  ].join('')
  const headRow = `<div class="var-struct-row var-struct-row--head" role="row">${headCells}</div>`
  const n = Math.min(data.length, MAX_STRUCT_ARRAY_ROWS)
  const bodyRows = Array.from({ length: n }, (_, idx) => {
    const row = data[idx]
    const cells = [
      `<div class="var-struct-cell var-struct-idx">${idx}</div>`,
      ...keys.map((k) => `<div class="var-struct-cell">${renderStructArrayCell(row[k])}</div>`),
    ].join('')
    return `<div class="var-struct-row" role="row">${cells}</div>`
  }).join('')
  const more =
    data.length > n
      ? `<div class="var-struct-more muted" role="note">… ${data.length - n} more rows (showing first ${n})</div>`
      : ''
  return `<div class="var-struct-wrap">${more}<div class="var-struct-grid" role="grid" style="--var-struct-dcols:${keys.length}" aria-label="Array of objects">${headRow}${bodyRows}</div></div>`
}

function isInspectablePlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  if (isBinaryArrayBufferView(value)) return false
  if (value instanceof Date || value instanceof RegExp) return false
  return Object.keys(value).some((k) => k !== '__class__')
}

function renderPlainObjectTable(obj) {
  if (!isInspectablePlainObject(obj)) return null
  const className = typeof obj.__class__ === 'string' ? obj.__class__ : null
  const keys = Object.keys(obj).filter((k) => k !== '__class__')
  if (!keys.length) {
    if (className) return `<span class="var-inline var-object-ref">${escapeHtml(className)}</span>`
    return null
  }

  const headRow =
    '<div class="var-struct-row var-struct-row--head var-struct-row--object" role="row"><div class="var-struct-hcell">field</div><div class="var-struct-hcell">value</div></div>'
  const bodyRows = keys
    .map((k) => {
      const cell = renderStructArrayCell(obj[k])
      return `<div class="var-struct-row var-struct-row--object" role="row"><div class="var-struct-hcell var-object-field">${escapeHtml(k)}</div><div class="var-struct-cell">${cell}</div></div>`
    })
    .join('')
  const label = className ? `<div class="var-object-label muted">${escapeHtml(className)}</div>` : ''
  return `<div class="var-struct-wrap">${label}<div class="var-struct-grid var-object-grid" role="grid" aria-label="Object fields">${headRow}${bodyRows}</div></div>`
}

function renderVarValue(value) {
  if (value == null) return '<span class="var-inline">null</span>'
  if (value === '') return '<span class="var-inline muted">(empty)</span>'
  if (typeof value === 'bigint') {
    return `<span class="var-inline">${escapeHtml(String(value))}</span>`
  }

  if (typeof value === 'string') {
    let parsed = parsePythonListRepr(value)
    if (parsed === null) parsed = tryParseJsonArrayString(value)
    if (parsed !== null) {
      const table = renderDataMatrixTable(parsed)
      if (table) return table
      const structTable = renderStructArrayTable(parsed)
      if (structTable) return structTable
      const pretty = escapeHtml(JSON.stringify(parsed, null, 2))
      return `<details class="var-complex"><summary>list (${parsed.length})</summary><pre class="var-pre">${pretty}</pre></details>`
    }
    const parsedObj = tryParseJsonObjectString(value)
    if (parsedObj) {
      const objTable = renderPlainObjectTable(parsedObj)
      if (objTable) return objTable
    }
    const long = value.length > 180
    if (long) {
      return `<pre class="var-repr-pre">${escapeHtml(value)}</pre>`
    }
    return `<span class="var-inline">${escapeHtml(value)}</span>`
  }

  const vector = unwrapVector(value)
  if (vector !== null && vector !== value) {
    const table = renderDataMatrixTable(vector)
    if (table) return table
    const pretty = escapeHtml(JSON.stringify(vector, null, 2).replace(/\n\s*\n/g, '\n'))
    return `
      <details class="var-complex">
        <summary>${escapeHtml(`Array(${vector.length})`)}</summary>
        <pre class="var-pre">${pretty}</pre>
      </details>
    `
  }

  if (Array.isArray(value)) {
    const table = renderDataMatrixTable(value)
    if (table) return table
    const structTable = renderStructArrayTable(value)
    if (structTable) return structTable
    const pretty = escapeHtml(JSON.stringify(value, null, 2).replace(/\n\s*\n/g, '\n'))
    return `
      <details class="var-complex">
        <summary>${escapeHtml(`Array(${value.length})`)}</summary>
        <pre class="var-pre">${pretty}</pre>
      </details>
    `
  }

  if (typeof value === 'object' && value !== null) {
    if (typeof value.get === 'function' && typeof value.set === 'function') {
      try {
        const deref = value.get()
        let s = ''
        if (typeof deref === 'string') s = deref
        else if (Array.isArray(deref)) s = deref.map((ch) => (typeof ch === 'number' ? String.fromCharCode(ch) : String(ch ?? ''))).join('').replace(/\0+$/, '')
        else if (deref != null) s = String(deref)
        return `<span class="var-inline">${escapeHtml(s)}</span> <span class="muted var-char-cap">(ptr)</span>`
      } catch {
        return '<span class="var-inline muted">(invalid pointer)</span>'
      }
    }
    if (value.__c_char_buf === true) {
      const s = value.s != null ? String(value.s) : ''
      const cap = Number(value.cap) || 0
      return `<span class="var-inline">${escapeHtml(s)}</span> <span class="muted var-char-cap">[${cap} B]</span>`
    }
    const objTable = renderPlainObjectTable(value)
    if (objTable) return objTable
    const pretty = escapeHtml(JSON.stringify(value, null, 2).replace(/\n\s*\n/g, '\n'))
    const summary = `Object(${Object.keys(value).length})`
    return `
      <details class="var-complex">
        <summary>${escapeHtml(summary)}</summary>
        <pre class="var-pre">${pretty}</pre>
      </details>
    `
  }

  return `<span class="var-inline">${escapeHtml(String(value))}</span>`
}

function varsRowContentTop(scroller, row) {
  return scroller.scrollTop + row.getBoundingClientRect().top - scroller.getBoundingClientRect().top
}

export function renderVars(container, debugState) {
  if (!container) return
  const prevScrollTop = container.scrollTop
  const prevScrollLeft = container.scrollLeft
  const prevRows = Array.from(container.querySelectorAll('tbody tr[data-row-name]'))
  let anchorName = ''
  let anchorOffsetDelta = 0
  for (const row of prevRows) {
    const top = varsRowContentTop(container, row)
    const rowBottom = top + row.offsetHeight
    if (rowBottom >= prevScrollTop) {
      anchorName = row.getAttribute('data-row-name') || ''
      anchorOffsetDelta = prevScrollTop - top
      break
    }
  }
  if (!anchorName && prevRows.length) {
    const row = prevRows[prevRows.length - 1]
    anchorName = row.getAttribute('data-row-name') || ''
    anchorOffsetDelta = prevScrollTop - varsRowContentTop(container, row)
  }

  if (!debugState.vars || !debugState.vars.length) {
    container.innerHTML = '<div class="vars-empty muted">Run the code to see state.</div>'
    container.scrollTop = 0
    return
  }

  const openVarNames = new Set(
    Array.from(container.querySelectorAll('details.var-complex[data-var-name]'))
      .filter((el) => el.open)
      .map((el) => el.getAttribute('data-var-name') || '')
      .filter(Boolean)
  )
  const innerScrollByVar = {}
  Array.from(container.querySelectorAll('details.var-complex[data-var-name]')).forEach((el) => {
    const name = el.getAttribute('data-var-name') || ''
    if (!name) return
    const pre = el.querySelector('.var-pre')
    if (pre) innerScrollByVar[name] = pre.scrollTop
  })
  const valueInnerScrollLeftByVar = {}
  Array.from(container.querySelectorAll('.var-value-inner[data-var-name]')).forEach((el) => {
    const name = el.getAttribute('data-var-name') || ''
    if (!name) return
    valueInnerScrollLeftByVar[name] = el.scrollLeft
  })

  const rows = debugState.vars
    .map((v, idx) => {
      const active = idx === debugState.index ? 'active' : ''
      let renderedValue = renderVarValue(v.value)
      if (renderedValue.includes('class="var-complex"')) {
        const openAttr = openVarNames.has(v.name) ? ' open' : ''
        renderedValue = renderedValue.replace(
          '<details class="var-complex">',
          `<details class="var-complex" data-var-name="${escapeHtml(v.name)}"${openAttr}>`
        )
      }
      return `<tr class="${active}" data-row-name="${escapeHtml(v.name)}"><td class="var-name">${escapeHtml(v.name)}</td><td class="var-value"><div class="var-value-inner" data-var-name="${escapeHtml(v.name)}">${renderedValue}</div></td></tr>`
    })
    .join('')
  container.innerHTML = `
    <table class="vars-table" aria-label="Variables">
      <thead><tr><th>Name</th><th>Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
  const applyVarsScrollRestore = () => {
    if (anchorName) {
      const escapedName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(anchorName) : anchorName.replace(/"/g, '\\"')
      const anchorRow = container.querySelector(`tbody tr[data-row-name="${escapedName}"]`)
      if (anchorRow) {
        const top = varsRowContentTop(container, anchorRow)
        container.scrollTop = Math.max(0, top + anchorOffsetDelta)
      } else {
        container.scrollTop = prevScrollTop
      }
    } else {
      container.scrollTop = prevScrollTop
    }
    container.scrollLeft = prevScrollLeft
  }
  const restoreValueInnerHScroll = () => {
    Array.from(container.querySelectorAll('.var-value-inner[data-var-name]')).forEach((el) => {
      const name = el.getAttribute('data-var-name') || ''
      if (!name) return
      if (valueInnerScrollLeftByVar[name] != null) {
        el.scrollLeft = valueInnerScrollLeftByVar[name]
      }
    })
  }
  applyVarsScrollRestore()
  restoreValueInnerHScroll()
  requestAnimationFrame(() => {
    applyVarsScrollRestore()
    restoreValueInnerHScroll()
  })

  Array.from(container.querySelectorAll('details.var-complex[data-var-name]')).forEach((el) => {
    const name = el.getAttribute('data-var-name') || ''
    if (!name) return
    const pre = el.querySelector('.var-pre')
    if (!pre) return
    if (innerScrollByVar[name] != null) {
      pre.scrollTop = innerScrollByVar[name]
    }
  })
}

export function renderHighlighted(output, debugState) {
  if (!output) return
  const lines = debugState.lines.length ? debugState.lines : ['Waiting for input…']
  const html = lines
    .map((line, idx) => {
      const safe = line.replace(/</g, '&lt;')
      const active = idx === debugState.index ? 'active' : ''
      return `<span class="code-line ${active}">${safe || '&nbsp;'}</span>`
    })
    .join('\n')
  output.innerHTML = `<pre>${html}</pre>`
}
