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

export function renderVars(container, debugState) {
  if (!container) return
  if (!debugState.vars || !debugState.vars.length) {
    container.innerHTML = '<div class="vars-empty muted">Run the code to see state.</div>'
    return
  }
  const rows = debugState.vars
    .map((v, idx) => {
      const active = idx === debugState.index ? 'active' : ''
      return `<tr class="${active}"><td class="var-name">${escapeHtml(v.name)}</td><td class="var-value">${escapeHtml(v.value)}</td></tr>`
    })
    .join('')
  container.innerHTML = `
    <table class="vars-table" aria-label="Variables">
      <thead><tr><th>Name</th><th>Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
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

