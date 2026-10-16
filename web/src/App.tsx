import { useEffect, useState } from 'react'
import Account from './Account'
import Daily from './Daily'
import Freeplay from './Freeplay'
import { getMe, submitFreeplayScore, updateSettings, type Profile } from './api'
import { isDark, loadLocalSettings, saveLocalSettings, type Settings } from './settings'

type Screen = 'menu' | 'daily' | 'freeplay' | 'account'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings>(loadLocalSettings)

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

  function applyProfile(p: Profile | null) {
    setProfile(p)
    if (p) setSettings({ theme: p.theme, units: p.units })
  }

  async function refreshProfile() {
    applyProfile(await getMe())
  }

  async function changeSettings(change: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...change }))
    if (profile) {
      try {
        setProfile(await updateSettings(change))
      } catch {}
    }
  }

  async function freeplayFinished(total: number) {
    if (profile) setProfile(await submitFreeplayScore(total))
  }

  const back = () => setScreen('menu')

  if (screen === 'daily')
    return <Daily units={settings.units} dark={dark} onExit={back} onFinished={refreshProfile} />
  if (screen === 'freeplay')
    return (
      <Freeplay units={settings.units} dark={dark} onExit={back} onFinished={freeplayFinished} />
    )
  if (screen === 'account')
    return (
      <Account
        profile={profile}
        settings={settings}
        onSettingsChange={changeSettings}
        onLoggedIn={refreshProfile}
        onLoggedOut={() => setProfile(null)}
        onExit={back}
      />
    )

  return (
    <div className="menu">
      <h1>CityGuessr</h1>
      <button onClick={() => setScreen('daily')}>Daily challenge</button>
      <button onClick={() => setScreen('freeplay')}>Freeplay</button>
      <button onClick={() => setScreen('account')}>{profile ? profile.email : 'Log in'}</button>
      {profile && <p>Best score: {profile.best_score} / 5000</p>}
    </div>
  )
}
