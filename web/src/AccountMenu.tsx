import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import {
  deleteAccount,
  forgotPassword,
  googleSignInUrl,
  login,
  logout,
  register,
  resendVerification,
  type Profile,
  type Theme,
  type Units,
} from './api'
import { type Settings } from './settings'
import { regionShortLabel } from './gameOptions'
import {
  ChevronDownIcon,
  FlameIcon,
  GoogleIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
  UserIcon,
} from './icons'
import './AccountMenu.css'

type Props = {
  profile: Profile | null
  settings: Settings
  onSettingsChange: (change: Partial<Settings>) => void
  onLoggedIn: (isNew: boolean) => Promise<void>
  onLoggedOut: () => void
  notice?: string | null
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
  notice: startNotice = null,
}: Props) {
  const [open, setOpen] = useState(startNotice !== null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(startNotice)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | string>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
    setNotice(null)
    try {
      if (mode === 'forgot') {
        await forgotPassword(email)
        setNotice(
          "If there's an account for that address, we've sent it a link to choose a new password.",
        )
        return
      }
      if (mode === 'register') {
        await register(email, password)
      } else {
        await login(email, password)
      }
      setPassword('')
      setResend('idle')
      await onLoggedIn(mode === 'register')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    await logout().catch(() => {})
    switchMode('login')
    onLoggedOut()
  }

  async function handleDelete(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setDeleteError(null)
    try {
      await deleteAccount(profile?.has_password ? deletePassword : undefined)
      closeDelete()
      switchMode('login')
      onLoggedOut()
    } catch (err) {
      setDeleteError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function closeDelete() {
    setConfirmDelete(false)
    setDeletePassword('')
    setDeleteError(null)
  }

  function switchMode(next: typeof mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function handleResend() {
    setResend('sending')
    try {
      await resendVerification()
      setResend('sent')
    } catch (err) {
      setResend((err as Error).message)
    }
  }

  const titles = { login: 'Log in', register: 'Create account', forgot: 'Reset password' }
  const submitLabels = { login: 'Log in', register: 'Create account', forgot: 'Send reset link' }

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
        <ChevronDownIcon size={18} className="account-chevron" />
      </button>

      {open && (
        <div className="account-panel">
          {profile ? (
            <>
              <div className="account-who">
                <span className="avatar">{profile.email[0].toUpperCase()}</span>
                <div className="account-who-text">
                  <div className="account-email">{profile.email}</div>
                  <div className="account-sub">
                    {profile.providers.includes('google') ? 'Signed in with Google' : 'Signed in'}
                  </div>
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
              <div className="stat-row">
                <div className="stat">
                  <span className="label">Daily best</span>
                  <span className="mono stat-value">
                    {profile.daily_best}
                    <small> / 5000</small>
                  </span>
                </div>
                <div className={profile.streak > 0 ? 'stat stat-streak on' : 'stat stat-streak'}>
                  <span className="label">Streak</span>
                  <span className="stat-value">
                    <FlameIcon size={20} />
                    <span className="mono">{profile.streak}</span>
                    <small>{profile.streak === 1 ? 'day' : 'days'}</small>
                  </span>
                </div>
              </div>
              {profile.region_bests.length > 0 && (
                <div className="region-bests">
                  <span className="label">Continent bests</span>
                  <ul>
                    {profile.region_bests.map((r) => (
                      <li key={r.region}>
                        <span>{regionShortLabel(r.region)}</span>
                        <span className="mono">{r.best}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!profile.email_verified && (
                <div className="verify-note" role="status">
                  <span>
                    <strong>Confirm your email.</strong> We sent a link to {profile.email}. Without
                    it you can't reset your password.
                  </span>
                  {resend === 'sent' ? (
                    <span>Sent! Check your inbox and spam folder.</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-link"
                      disabled={resend === 'sending'}
                      onClick={handleResend}
                    >
                      {resend === 'sending' ? 'Sending…' : 'Send it again'}
                    </button>
                  )}
                  {resend !== 'idle' && resend !== 'sending' && resend !== 'sent' && (
                    <p className="error">{resend}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <form className="account-form" onSubmit={handleSubmit}>
              <h2 className="display">{titles[mode]}</h2>
              <p className="account-sub">
                {mode === 'forgot'
                  ? "Enter your account's email and we'll send you a link."
                  : 'Keep your best score on every device.'}
              </p>
              {mode !== 'forgot' && (
                <>
                  <a className="btn-google" href={googleSignInUrl(window.location.pathname)}>
                    <GoogleIcon />
                    Continue with Google
                  </a>
                  <div className="or-divider">or with email</div>
                </>
              )}
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
              {mode !== 'forgot' && (
                <>
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
                </>
              )}
              {error && <p className="error">{error}</p>}
              {notice && <p className="notice">{notice}</p>}
              <button type="submit" className="btn-primary" disabled={busy}>
                {submitLabels[mode]}
              </button>
              {mode === 'login' && (
                <button type="button" className="btn-link" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              )}
              <button
                type="button"
                className="btn-link"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'No account? Create one' : 'Back to log in'}
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
              {confirmDelete ? (
                <form className="account-form delete-confirm" onSubmit={handleDelete}>
                  <p className="delete-warning">
                    <strong>Delete your account for good?</strong>{' '}
                    {profile.has_password
                      ? 'Your email, password, best score and daily results are removed right away.'
                      : 'Your email, best score and daily results are removed right away. Your Google account itself stays as it is.'}{' '}
                    This can't be undone.
                  </p>
                  {profile.has_password && (
                    <>
                      <label htmlFor="acc-delete-password" className="account-field-label">
                        Enter your password to confirm
                      </label>
                      <input
                        id="acc-delete-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        autoFocus
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                      />
                    </>
                  )}
                  {deleteError && <p className="error">{deleteError}</p>}
                  <button type="submit" className="btn-danger" disabled={busy}>
                    {busy ? 'Deleting…' : 'Delete my account'}
                  </button>
                  <button type="button" className="btn-link" onClick={closeDelete}>
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn-logout btn-delete"
                  onClick={() => setConfirmDelete(true)}
                >
                  <TrashIcon />
                  Delete account
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
