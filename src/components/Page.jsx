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
              className={currentRoute === 'login' ? 'active' : ''}
              onClick={() => (window.location.hash = 'login')}
              type="button"
            >
              Login
            </button>
            <button
              className={currentRoute === 'register' ? 'active' : ''}
              onClick={() => (window.location.hash = 'register')}
              type="button"
            >
              Register
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

