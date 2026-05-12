function Page({ label, title, subtitle, topExtra, children, currentRoute }) {
  return (
    <section className="page">
      <div className="page__top">
        <div className="hero-content">
          {label && <p className="eyebrow page__label">{label}</p>}
          <h1 className="page__title">{title}</h1>
          {subtitle && <p className="page__subtitle">{subtitle}</p>}
          <div className="hero-toggle" role="group" aria-label="View switch">
            <button
              className={currentRoute === 'debugger' ? 'active' : ''}
              onClick={() => (window.location.hash = 'debugger')}
              type="button"
            >
              Debugger
            </button>
            <button
              className={currentRoute === 'data-structures' ? 'active' : ''}
              onClick={() => (window.location.hash = 'data-structures')}
              type="button"
            >
              Data Structures
            </button>
            <button
              className={currentRoute === 'algorithms' ? 'active' : ''}
              onClick={() => (window.location.hash = 'algorithms')}
              type="button"
            >
              Algorithms
            </button>
          </div>
        </div>
        {topExtra}
      </div>
      <div className="page__bottom">{children}</div>
    </section>
  )
}

export default Page

