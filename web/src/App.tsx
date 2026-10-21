import { useEffect, useState } from 'react'
import Daily from './Daily'
import Freeplay from './Freeplay'
import { getMe, updateSettings, type DailyDay, type Profile } from './api'
import { isDark, loadLocalSettings, saveLocalSettings, type Settings } from './settings'
import AccountMenu from './AccountMenu'
import Menu from './Menu'
import Privacy from './Privacy'
import Archive from './Archive'
import { ResetPasswordPage, VerifyEmailPage } from './AuthPages'

type Screen = 'menu' | 'daily' | 'freeplay' | 'privacy' | 'archive' | 'verify' | 'reset'

const SCREEN_PATHS: Partial<Record<Screen, string>> = {
  privacy: '/privacy',
  archive: '/archive',
}

function emailLink(): { screen: Screen; token: string } | null {
  const token = new URLSearchParams(window.location.search).get('token')
  if (!token) return null
  if (window.location.pathname === '/verify-email') return { screen: 'verify', token }
  if (window.location.pathname === '/reset-password') return { screen: 'reset', token }
  return null
}

function screenFromUrl(link: { screen: Screen } | null): Screen {
  if (link) return link.screen
  const match = Object.entries(SCREEN_PATHS).find(([, path]) => path === window.location.pathname)
  return match ? (match[0] as Screen) : 'menu'
}

export default function App() {
  const [link] = useState(emailLink)
  const [screen, setScreen] = useState<Screen>(() => screenFromUrl(link))
  const [dailyDay, setDailyDay] = useState<DailyDay | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings>(loadLocalSettings)

  function applyProfile(p: Profile | null) {
    setProfile(p)
    if (p) setSettings({ theme: p.theme, units: p.units })
  }

  useEffect(() => {
    getMe()
      .then(applyProfile)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (link) window.history.replaceState(null, '', '/')
  }, [link])

  useEffect(() => {
    if (link && (screen === 'verify' || screen === 'reset')) return
    const path = SCREEN_PATHS[screen] ?? '/'
    if (window.location.pathname !== path) window.history.replaceState(null, '', path)
  }, [screen, link])

  useEffect(() => {
    saveLocalSettings(settings)
  }, [settings])

  const dark = isDark(settings.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  async function refreshProfile() {
    applyProfile(await getMe())
  }

  async function loggedIn(isNew: boolean) {
    if (isNew) await updateSettings(settings).catch(() => null)
    await refreshProfile()
  }

  async function changeSettings(change: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...change }))
    if (profile) {
      try {
        setProfile(await updateSettings(change))
      } catch (err) {
        console.warn('could not save settings to your account', err)
      }
    }
  }

  const back = () => setScreen('menu')

  const accountButton = (
    <AccountMenu
      profile={profile}
      settings={settings}
      onSettingsChange={changeSettings}
      onLoggedIn={loggedIn}
      onLoggedOut={() => setProfile(null)}
    />
  )

  const openArchive = () => setScreen('archive')

  if (screen === 'daily')
    return (
      <Daily
        key={dailyDay?.date ?? 'today'}
        day={dailyDay}
        units={settings.units}
        dark={dark}
        signedIn={profile !== null}
        account={accountButton}
        onExit={back}
        onFinished={refreshProfile}
        onFreeplay={() => setScreen('freeplay')}
        onArchive={openArchive}
      />
    )
  if (screen === 'archive')
    return (
      <Archive
        account={accountButton}
        onHome={back}
        onOpen={(day) => {
          setDailyDay(day)
          setScreen('daily')
        }}
      />
    )
  if (screen === 'freeplay')
    return (
      <Freeplay
        units={settings.units}
        dark={dark}
        account={accountButton}
        onExit={back}
        onFinished={refreshProfile}
      />
    )
  if (screen === 'privacy') return <Privacy account={accountButton} onHome={back} />
  if (screen === 'verify' && link)
    return (
      <VerifyEmailPage
        token={link.token}
        account={accountButton}
        onHome={back}
        onVerified={() => {
          refreshProfile().catch(() => {})
        }}
      />
    )
  if (screen === 'reset' && link)
    return (
      <ResetPasswordPage
        token={link.token}
        account={accountButton}
        onHome={back}
        onLoggedIn={refreshProfile}
      />
    )

  return (
    <Menu
      account={accountButton}
      bestScore={profile?.best_score ?? null}
      onDaily={() => {
        setDailyDay(null)
        setScreen('daily')
      }}
      onFreeplay={() => setScreen('freeplay')}
      onArchive={openArchive}
      onPrivacy={() => setScreen('privacy')}
    />
  )
}
