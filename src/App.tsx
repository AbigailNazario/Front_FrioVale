import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Team from './pages/Team'
import Containers from './pages/Containers'
import Reports from './pages/Reports'
import Profile from './pages/Profile'
import IoTLogs from './pages/IotLogs'
import { Trips, Alerts } from './pages/Lists'
import { api, ApiError, session, SESSION_EXPIRED_EVENT, type UserResponse } from './api'
import { isDriver } from './data'

export default function App() {
  const [auth, setAuth] = useState(() => session.hasToken())
  const [user, setUser] = useState<UserResponse | null>(null)
  const [userLoaded, setUserLoaded] = useState(false)

  // [Seguranca] sessao invalida (401) em qualquer tela: volta para o login
  useEffect(() => {
    const expired = () => { setUser(null); setAuth(false) }
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  }, [])

  useEffect(() => {
    if (!auth) {
      setUserLoaded(true)
      return
    }
    api.currentUser()
      .then(setUser)
      .catch(err => {
        setUser(null)
        // [Seguranca - 2FA] token antigo (emitido antes do 2FA) ou intermediario: exige novo login
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          session.clear()
          setAuth(false)
        }
      })
      .finally(() => setUserLoaded(true))
  }, [auth])

  if (!auth) return <Login onLogin={() => setAuth(true)} />
  if (!userLoaded) return null

  const driver = isDriver(user?.role)

  return (
    <Routes>
      <Route element={<Layout user={user} onLogout={() => { session.clear(); setAuth(false) }} />}>
        <Route index element={<Dashboard />} />
        {driver ? null : (
          <>
            <Route path="viagens" element={<Trips />} />
            <Route path="containers" element={<Containers />} />
            <Route path="logs-iot" element={<IoTLogs />} />
            <Route path="equipe" element={<Team />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="perfil" element={<Profile />} />
          </>
        )}
        <Route path="alertas" element={<Alerts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
