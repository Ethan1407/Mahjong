import { useState } from 'react'
import { SetupScreen, type GameSettings } from './ui/SetupScreen'
import { TableScreen } from './ui/TableScreen'
import { ProfileScreen } from './ui/ProfileScreen'
import { ShopScreen } from './ui/ShopScreen'
import { TipLayer } from './ui/TipLayer'
import { TutorialScreen } from './ui/TutorialScreen'

export function App() {
  const [settings, setSettings] = useState<GameSettings | null>(null)
  /** 主畫面之外的頁面：個人中心、商店。 */
  const [page, setPage] = useState<'home' | 'profile' | 'shop'>('home')
  const exit = () => setSettings(null)
  const home = () => setPage('home')

  let screen
  if (page === 'profile') screen = <ProfileScreen onBack={home} />
  else if (page === 'shop') screen = <ShopScreen onBack={home} />
  else if (!settings) screen = <SetupScreen onStart={setSettings} onProfile={() => setPage('profile')} onShop={() => setPage('shop')} />
  else if (settings.difficulty === 'tutorial') screen = <TutorialScreen variant={settings.variant} onExit={exit} />
  else screen = <TableScreen difficulty={settings.difficulty} stake={settings.stake} custom={settings.custom} onExit={exit} />
  return (
    <>
      {screen}
      <TipLayer />
    </>
  )
}
