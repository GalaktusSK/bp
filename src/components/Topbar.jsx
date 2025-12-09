function Topbar({ currentRoute, onNavigate }) {
  return (
    <header className="topbar" role="banner">
      <div className="brand">
        <span className="brand__dot" aria-hidden="true"></span>
        <span className="brand__name">OCV · Online Code Visualizer</span>
      </div>
      <nav aria-label="Main navigation" className="topbar__nav">
        <button
          className={`ghost ${currentRoute === 'landing' ? 'active' : ''}`}
          onClick={() => onNavigate('landing')}
        >
          Landing
        </button>
        <button
          className={`ghost ${currentRoute === 'debugger' ? 'active' : ''}`}
          onClick={() => onNavigate('debugger')}
        >
          Debugger
        </button>
        <button
          className={`ghost ${currentRoute === 'contact' ? 'active' : ''}`}
          onClick={() => onNavigate('contact')}
        >
          Kontakt
        </button>
      </nav>
    </header>
  )
}

export default Topbar

