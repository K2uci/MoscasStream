import { useEffect, useState } from 'react'
import { api } from './api'
import { Dashboard } from './components/Dashboard'
import { Login } from './components/Login'

export default function App() {
  const [user, setUser] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.username))
      .catch(() => setUser(null))
  }, [])

  if (user === undefined) return <div className="center muted">Cargando…</div>
  if (!user) return <Login onLogin={setUser} />
  return (
    <Dashboard
      user={user}
      onLogout={async () => {
        await api.logout().catch(() => {})
        setUser(null)
      }}
      onUnauthorized={() => setUser(null)}
    />
  )
}
