import { useState } from 'react'
import { SetupScreen, type GameSettings } from './ui/SetupScreen'
import { TableScreen } from './ui/TableScreen'
import { TutorialScreen } from './ui/TutorialScreen'

export function App() {
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const exit = () => setSettings(null)

  if (!settings) return <SetupScreen onStart={setSettings} />
  if (settings.difficulty === 'tutorial') return <TutorialScreen variant={settings.variant} onExit={exit} />
  return <TableScreen difficulty={settings.difficulty} onExit={exit} />
}
