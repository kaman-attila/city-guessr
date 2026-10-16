import { useState, type SyntheticEvent } from 'react'
import { login, logout, register, type Profile, type Theme, type Units } from './api'
import { type Settings } from './settings'

type Props = {
  profile: Profile | null
  settings: Settings
  onSettingsChange: (change: Partial<Settings>) => void
  onLoggedIn: () => Promise<void>
  onLoggedOut: () => void
  onExit: () => void
}

export default function Account({
  profile,
  settings,
  onSettingsChange,
  onLoggedIn,
  onLoggedOut,
  onExit,
}: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'register') {
        await register(email, password)
      } else {
        await login(email, password)
      }
      setPassword('')
      await onLoggedIn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    await logout().catch(() => {})
    onLoggedOut()
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login')
    setError(null)
  }

  return (
    <div className="panel">
      {profile ? (
        <>
          <h2>Your account</h2>
          <p>{profile.email}</p>
          <p>Best score: {profile.best_score} / 5000</p>
          <button onClick={handleLogout}>Log out</button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <h2>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password (at least 8 characters)"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
          <button type="button" onClick={switchMode}>
            {mode === 'login' ? 'No account yet? Register' : 'Already registered? Log in'}
          </button>
        </form>
      )}

      <h3>Settings</h3>
      <label>
        Theme{' '}
        <select
          value={settings.theme}
          onChange={(e) => onSettingsChange({ theme: e.target.value as Theme })}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>
        Distances{' '}
        <select
          value={settings.units}
          onChange={(e) => onSettingsChange({ units: e.target.value as Units })}
        >
          <option value="metric">Kilometres</option>
          <option value="imperial">Miles</option>
        </select>
      </label>

      <button onClick={onExit}>Back to menu</button>
    </div>
  )
}
