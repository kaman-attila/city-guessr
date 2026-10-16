import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { login, logout, register, type Profile, type Theme, type Units } from './api'
import { type Settings } from './settings'
import { ChevronDownIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon, UserIcon } from './icons'
import './AccountMenu.css'

type Props = {
  profile: Profile | null
  settings: Settings
  onSettingsChange: (change: Partial<Settings>) => void
  onLoggedIn: () => Promise<void>
  onLoggedOut: () => void
}

const THEMES: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'system', label: 'Follow my device', Icon: MonitorIcon },
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
]

const UNITS: { value: Units; short: string; label: string }[] = [
  { value: 'metric', short: 'km', label: 'Kilometres' },
  { value: 'imperial', short: 'mi', label: 'Miles' },
]

export default function AccountMenu({
  profile,
  settings,
  onSettingsChange,
  onLoggedIn,
  onLoggedOut,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

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
    <div className="account" ref={rootRef}>
      <button
        ref={buttonRef}
        className="account-btn"
        aria-label="Account and settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {profile ? (
          <span className="avatar">{profile.email[0].toUpperCase()}</span>
        ) : (
          <span className="avatar avatar-guest">
            <UserIcon />
          </span>
        )}
        <ChevronDownIcon size={18} />
      </button>

      {open && (
        <div className="account-panel">
          {profile ? (
            <>
              <div className="account-who">
                <span className="avatar">{profile.email[0].toUpperCase()}</span>
                <div className="account-who-text">
                  <div className="account-email">{profile.email}</div>
                  <div className="account-sub">Signed in</div>
                </div>
              </div>
              <div className="best">
                <div className="best-row">
                  <span className="label">Best score</span>
                  <span className="mono best-score">
                    {profile.best_score}
                    <small> / 5000</small>
                  </span>
                </div>
                <div className="meter">
                  <div style={{ width: `${(profile.best_score / 5000) * 100}%` }} />
                </div>
              </div>
            </>
          ) : (
            <form className="account-form" onSubmit={handleSubmit}>
              <h2 className="display">{mode === 'login' ? 'Log in' : 'Create account'}</h2>
              <p className="account-sub">Keep your best score on every device.</p>
              <label htmlFor="acc-email" className="account-field-label">
                Email
              </label>
              <input
                id="acc-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label htmlFor="acc-password" className="account-field-label">
                Password
              </label>
              <input
                id="acc-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="At least 8 characters"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn-primary" disabled={busy}>
                {mode === 'login' ? 'Log in' : 'Create account'}
              </button>
              <button type="button" className="btn-link" onClick={switchMode}>
                {mode === 'login' ? 'No account? Create one' : 'Already registered? Log in'}
              </button>
            </form>
          )}

          <div className="divider" />

          <div className="account-section">
            <span className="label">Theme</span>
            <div className="segmented segmented-3" role="group" aria-label="Theme">
              {THEMES.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={settings.theme === value}
                  onClick={() => onSettingsChange({ theme: value })}
                >
                  <Icon />
                </button>
              ))}
            </div>
          </div>

          <div className="account-section">
            <span className="label">Distances</span>
            <div className="segmented segmented-2" role="group" aria-label="Distance units">
              {UNITS.map(({ value, short, label }) => (
                <button
                  key={value}
                  type="button"
                  className="mono"
                  aria-label={label}
                  aria-pressed={settings.units === value}
                  onClick={() => onSettingsChange({ units: value })}
                >
                  {short}
                </button>
              ))}
            </div>
          </div>

          {profile && (
            <>
              <div className="divider" />
              <button type="button" className="btn-logout" onClick={handleLogout}>
                <LogOutIcon />
                Log out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
