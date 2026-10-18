import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import TopBar from './TopBar'
import { resetPassword, verifyEmail } from './api'
import { CheckIcon } from './icons'
import './AuthPages.css'

type PageProps = { account: ReactNode; onHome: () => void }

function AuthPage({ account, onHome, children }: PageProps & { children: ReactNode }) {
  return (
    <div className="screen">
      <TopBar onHome={onHome} account={account} />
      <main className="auth-page">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  )
}

function Done({ title, text, onHome }: { title: string; text: string; onHome: () => void }) {
  return (
    <>
      <span className="auth-icon" aria-hidden="true">
        <CheckIcon size={30} strokeWidth={3} />
      </span>
      <h1 className="display">{title}</h1>
      <p>{text}</p>
      <button className="btn-primary" onClick={onHome}>
        Play
      </button>
    </>
  )
}

export function VerifyEmailPage({
  token,
  account,
  onHome,
  onVerified,
}: PageProps & { token: string; onVerified: () => void }) {
  const [status, setStatus] = useState<'checking' | 'done' | string>('checking')
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    verifyEmail(token)
      .then(() => {
        setStatus('done')
        onVerified()
      })
      .catch((err: Error) => setStatus(err.message))
  }, [token, onVerified])

  return (
    <AuthPage account={account} onHome={onHome}>
      {status === 'checking' ? (
        <p>Confirming your email…</p>
      ) : status === 'done' ? (
        <Done title="Email confirmed" text="Thanks! Your account is all set." onHome={onHome} />
      ) : (
        <>
          <h1 className="display">Link not working</h1>
          <p className="error">{status}</p>
          <p>Open the account menu while logged in to get a new confirmation email.</p>
          <button className="btn-primary" onClick={onHome}>
            Back to the game
          </button>
        </>
      )}
    </AuthPage>
  )
}

export function ResetPasswordPage({
  token,
  account,
  onHome,
  onLoggedIn,
}: PageProps & { token: string; onLoggedIn: () => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password !== repeat) {
      setError("The two passwords don't match.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await resetPassword(token, password)
      await onLoggedIn()
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPage account={account} onHome={onHome}>
      {done ? (
        <Done
          title="Password changed"
          text="You're logged in with your new password. Any other devices were signed out."
          onHome={onHome}
        />
      ) : (
        <form className="account-form" onSubmit={handleSubmit}>
          <h1 className="display">Choose a new password</h1>
          <label htmlFor="reset-password" className="account-field-label">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label htmlFor="reset-repeat" className="account-field-label">
            Repeat it
          </label>
          <input
            id="reset-repeat"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}
    </AuthPage>
  )
}
