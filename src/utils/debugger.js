// Utility functions for code editor
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

// Variable collection and rendering
export function collectVars(debugState) {
  // Demo extraction: list line number and line content as "value"
  return debugState.lines.map((line, idx) => ({
    name: `line_${idx + 1}`,
    value: line.trim() || '(empty)',
  }))
}

function escapeHtml(s) {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function tryParseJsonString(value) {
  if (typeof value !== 'string') return { ok: false, value }
  const trimmed = value.trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return { ok: false, value }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch (_) {
    return { ok: false, value }
  }
}

function renderVarValue(value) {
  if (value == null) return '<span class="var-inline">null</span>'
  if (value === '') return '<span class="var-inline muted">(empty)</span>'

  const parsed = tryParseJsonString(value)
  const actualValue = parsed.ok ? parsed.value : value

  if (Array.isArray(actualValue) || (typeof actualValue === 'object' && actualValue !== null)) {
    const pretty = escapeHtml(JSON.stringify(actualValue, null, 2).replace(/\n\s*\n/g, '\n'))
    const summary = Array.isArray(actualValue)
      ? `Array(${actualValue.length})`
      : `Object(${Object.keys(actualValue).length})`
    return `
      <details class="var-complex">
        <summary>${escapeHtml(summary)}</summary>
        <pre class="var-pre">${pretty}</pre>
      </details>
    `
  }

  return `<span class="var-inline">${escapeHtml(actualValue)}</span>`
}

export function renderVars(container, debugState) {
  if (!container) return
  const prevScrollTop = container.scrollTop
  const prevRows = Array.from(container.querySelectorAll('tbody tr[data-row-name]'))
  let anchorName = ''
  let anchorOffsetDelta = 0
  for (const row of prevRows) {
    if (row.offsetTop + row.offsetHeight >= prevScrollTop) {
      anchorName = row.getAttribute('data-row-name') || ''
      anchorOffsetDelta = prevScrollTop - row.offsetTop
      break
    }
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
      return `<tr class="${active}" data-row-name="${escapeHtml(v.name)}"><td class="var-name">${escapeHtml(v.name)}</td><td class="var-value">${renderedValue}</td></tr>`
    })
    .join('')
  container.innerHTML = `
    <table class="vars-table" aria-label="Variables">
      <thead><tr><th>Name</th><th>Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
  if (anchorName) {
    const escapedName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(anchorName) : anchorName.replace(/"/g, '\\"')
    const anchorRow = container.querySelector(`tbody tr[data-row-name="${escapedName}"]`)
    if (anchorRow) {
      container.scrollTop = Math.max(0, anchorRow.offsetTop + anchorOffsetDelta)
    } else {
      container.scrollTop = prevScrollTop
    }
  } else {
    container.scrollTop = prevScrollTop
  }

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

