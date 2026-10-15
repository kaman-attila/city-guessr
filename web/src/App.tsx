import { useState } from 'react'
import Daily from './Daily'
import Freeplay from './Freeplay'

type Screen = 'menu' | 'daily' | 'freeplay'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const back = () => setScreen('menu')

  if (screen === 'daily') return <Daily onExit={back} />
  if (screen === 'freeplay') return <Freeplay onExit={back} />

  return (
    <div className="menu">
      <h1>CityGuessr</h1>
      <button onClick={() => setScreen('daily')}>Daily challenge</button>
      <button onClick={() => setScreen('freeplay')}>Freeplay</button>
    </div>
  )
}