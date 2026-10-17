import { useEffect, useState } from 'react'
import Daily from './Daily'
import Freeplay from './Freeplay'
import { getMe, updateSettings, type Profile } from './api'
import { isDark, loadLocalSettings, saveLocalSettings, type Settings } from './settings'
import AccountMenu from './AccountMenu'
import Menu from './Menu'
import Privacy from './Privacy'

type Screen = 'menu' | 'daily' | 'freeplay' | 'privacy'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
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
      } catch {
        // the change is still applied and saved locally
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

  if (screen === 'daily')
    return (
      <Daily
        units={settings.units}
        dark={dark}
        signedIn={profile !== null}
        account={accountButton}
        onExit={back}
        onFinished={refreshProfile}
        onFreeplay={() => setScreen('freeplay')}
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

  return (
    <Menu
      account={accountButton}
      bestScore={profile?.best_score ?? null}
      onDaily={() => setScreen('daily')}
      onFreeplay={() => setScreen('freeplay')}
      onPrivacy={() => setScreen('privacy')}
    />
  )
}
