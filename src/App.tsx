import { useState } from 'react'
import { SetupScreen, type GameSettings } from './ui/SetupScreen'
import { TableScreen } from './ui/TableScreen'
import { ProfileScreen } from './ui/ProfileScreen'
import { TipLayer } from './ui/TipLayer'
import { TutorialScreen } from './ui/TutorialScreen'

export function App() {
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const exit = () => setSettings(null)

  let screen
  if (showProfile) screen = <ProfileScreen onBack={() => setShowProfile(false)} />
  else if (!settings) screen = <SetupScreen onStart={setSettings} onProfile={() => setShowProfile(true)} />
  else if (settings.difficulty === 'tutorial') screen = <TutorialScreen variant={settings.variant} onExit={exit} />
  else screen = <TableScreen difficulty={settings.difficulty} stake={settings.stake} custom={settings.custom} onExit={exit} />
  return (
    <>
      {screen}
      <TipLayer />
    </>
  )
}
