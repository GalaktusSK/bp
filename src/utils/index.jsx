export function dots(count = 3) {
  return (
    <div className="dot-nav">
      {Array.from({ length: count }, (_, i) => (
        <span key={i}></span>
      ))}
    </div>
  )
}

export function pillRow(items) {
  return (
    <div className="pill-row">
      {items.map((text, i) => (
        <span key={i} className="pill">
          {text}
        </span>
      ))}
    </div>
  )
}

export function simpleFooter() {
  return (
    <div className="nav-links">
      <span>⏻</span>
      <span>⚑</span>
      <span>⚙</span>
    </div>
  )
}
