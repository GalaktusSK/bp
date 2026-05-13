import { useState, useEffect } from 'react'
import Topbar from './components/Topbar'
import Landing from './pages/Landing'
import Debugger from './pages/Debugger'
import Contact from './pages/Contact'
import DataStructures from './pages/DataStructures'
import Algorithms from './pages/Algorithms'
import Login from './pages/Login'
import Register from './pages/Register'

function App() {
  const [route, setRoute] = useState('landing')
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || 'landing'
      setRoute(hash)
    }
    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])
  const navigate = (newRoute) => {
    setRoute(newRoute)
    window.location.hash = newRoute
  }
  const renderPage = () => {
    switch (route) {
      case 'debugger':
        return <Debugger currentRoute={route} />
      case 'data-structures':
        return <DataStructures currentRoute={route} />
      case 'algorithms':
        return <Algorithms currentRoute={route} />
      case 'contact':
        return <Contact currentRoute={route} />
      case 'login':
        return <Login currentRoute={route} />
      case 'register':
        return <Register currentRoute={route} />
      case 'landing':
      default:
        return <Landing currentRoute={route} />
    }
  }

  return (
    <>
      <a className="skip-link" href="#app">Skip to content</a>
      <Topbar currentRoute={route} onNavigate={navigate} />
      <main id="app" className="app" tabIndex={-1} aria-live="polite">
        {renderPage()}
      </main>
    </>
  )
}

export default App
