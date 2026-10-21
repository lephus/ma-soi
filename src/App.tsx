import { useCallback, useEffect, useState } from 'react'
import { createGame, type GameState } from './game/engine'
import { loadSettings, saveSettings, type Settings } from './game/settings'
import { useGameStore } from './game/store'
import { configureVoice, stopSpeaking } from './tts/narrator'
import { Deal } from './ui/Deal'
import { Play } from './ui/Play'
import { SettingsSheet } from './ui/SettingsSheet'
import { Setup } from './ui/Setup'

export function App() {
  const [store, dispatch] = useGameStore()
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  // A saved game is offered on the setup screen rather than jumping straight back into narration.
  const [resumed, setResumed] = useState(false)

  useEffect(() => {
    saveSettings(settings)
    configureVoice({ voiceURI: settings.voiceURI, rate: settings.speechRate, volume: settings.volume })
  }, [settings])

  const apply = useCallback((fn: (s: GameState) => GameState) => dispatch({ type: 'apply', fn }), [dispatch])
  const exit = useCallback(() => {
    stopSpeaking()
    dispatch({ type: 'clear' })
    setResumed(false)
  }, [dispatch])

  const settingsSheet = showSettings && (
    <SettingsSheet settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />
  )

  const { game } = store
  const unfinished = game && game.phase.t !== 'ENDED'

  if (!game || (!resumed && store.stage === 'play' && unfinished)) {
    return (
      <>
        <Setup
          onOpenSettings={() => setShowSettings(true)}
          onStart={(names, counts) => {
            dispatch({ type: 'new', game: createGame(names, counts) })
            setResumed(true)
          }}
          resume={game && unfinished ? { onResume: () => setResumed(true), onDiscard: exit } : undefined}
        />
        {settingsSheet}
      </>
    )
  }

  if (store.stage === 'deal') {
    return <Deal game={game} onStart={() => dispatch({ type: 'play' })} onCancel={exit} />
  }

  return (
    <>
      <Play
        game={game}
        epoch={store.epoch}
        settings={settings}
        apply={apply}
        onUndo={() => dispatch({ type: 'undo' })}
        onExit={exit}
        onOpenSettings={() => setShowSettings(true)}
      />
      {settingsSheet}
    </>
  )
}
