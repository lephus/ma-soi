import { useEffect, useState } from 'react'
import { setAlive, type GameState } from '../game/engine'
import { pauseGate } from '../tts/narrator'
import { usePaused, useWakeLock } from './hooks'
import { Button, Screen, Sheet } from './kit'
import { MusicButton } from './music'
import { Dawn, Discussion, Ended, Execution, Hunter, LastWords, NightRoleView, NightStart, Vote, type PhaseProps } from './phases'

const isNight = (g: GameState) => g.phase.t === 'NIGHT_START' || g.phase.t === 'NIGHT_ROLE'

export function Play({
  game,
  epoch,
  settings,
  apply,
  onUndo,
  onExit,
  onOpenSettings,
}: PhaseProps & {
  epoch: number
  onUndo: () => void
  onExit: () => void
  onOpenSettings: () => void
}) {
  const paused = usePaused()
  const [menu, setMenu] = useState(false)
  useWakeLock()

  // Leaving the page mid-game is almost always an accident.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      pauseGate.set(false)
    }
  }, [])

  const ended = game.phase.t === 'ENDED'
  const night = isNight(game)

  return (
    <div className={`min-h-dvh transition-colors duration-700 ${night ? 'bg-night' : 'bg-[#2a2140]'}`}>
      <Screen>
        {!ended && (
          <header className="flex items-center justify-between">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${night ? 'bg-panel text-muted' : 'bg-day/20 text-day'}`}>
              {night ? `🌙 Đêm ${game.day}` : `☀️ Ngày ${game.day}`}
            </span>
            <div className="flex gap-2">
              <MusicButton className="text-lg" />
              <button
                onClick={() => pauseGate.set(true)}
                className="rounded-full bg-panel px-4 py-2 text-lg"
                aria-label="Tạm dừng"
              >
                ⏸
              </button>
              <button
                onClick={() => {
                  pauseGate.set(true)
                  setMenu(true)
                }}
                className="rounded-full bg-panel px-4 py-2 text-lg"
                aria-label="Menu"
              >
                ☰
              </button>
            </div>
          </header>
        )}
        <main className="flex flex-1 flex-col pt-2">
          <PhaseView key={`${epoch}-${game.step}`} game={game} settings={settings} apply={apply} onExit={onExit} />
        </main>
      </Screen>

      {paused && !menu && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/85 p-6">
          <p className="text-2xl font-bold">Đã tạm dừng</p>
          <Button className="w-full max-w-xs" onClick={() => pauseGate.set(false)}>
            ▶ Tiếp tục
          </Button>
        </div>
      )}

      {menu && (
        <GameMenu
          game={game}
          apply={apply}
          onClose={() => {
            setMenu(false)
            pauseGate.set(false)
          }}
          onUndo={() => {
            setMenu(false)
            pauseGate.set(false)
            onUndo()
          }}
          onSettings={() => {
            setMenu(false)
            onOpenSettings()
          }}
          onExit={onExit}
        />
      )}
    </div>
  )
}

function PhaseView({ game, settings, apply, onExit }: PhaseProps & { onExit: () => void }) {
  const props = { game, settings, apply }
  const phase = game.phase
  switch (phase.t) {
    case 'NIGHT_START':
      return <NightStart {...props} />
    case 'NIGHT_ROLE':
      return <NightRoleView {...props} role={phase.role} />
    case 'DAWN':
      return <Dawn {...props} deaths={phase.deaths} />
    case 'HUNTER':
      return <Hunter {...props} hunterId={phase.hunterId} />
    case 'DISCUSSION':
      return <Discussion {...props} />
    case 'VOTE':
      return <Vote {...props} />
    case 'LAST_WORDS':
      return <LastWords {...props} targetId={phase.targetId} />
    case 'EXECUTION':
      return <Execution {...props} targetId={phase.targetId} />
    case 'ENDED':
      return <Ended game={game} winner={phase.winner} onExit={onExit} />
  }
}

function GameMenu({
  game,
  apply,
  onClose,
  onUndo,
  onSettings,
  onExit,
}: {
  game: GameState
  apply: PhaseProps['apply']
  onClose: () => void
  onUndo: () => void
  onSettings: () => void
  onExit: () => void
}) {
  const [confirmExit, setConfirmExit] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <Sheet title="Menu (đang tạm dừng)" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Button variant="ghost" onClick={onUndo}>
          ↩ Quay lại bước trước
        </Button>
        <Button variant="ghost" onClick={onSettings}>
          ⚙️ Cài đặt thời gian & giọng đọc
        </Button>

        <h3 className="mt-2 text-sm font-semibold tracking-wider text-muted uppercase">Người chơi</h3>
        <p className="text-xs text-muted">Chỉ sửa khi máy ghi sai. Vai trò được giấu vì quản trò cũng đang chơi.</p>
        <ul className="grid grid-cols-2 gap-2">
          {game.players.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setEditing(editing === p.id ? null : p.id)}
                className={`w-full rounded-2xl border px-3 py-3 text-left ${p.alive ? 'border-line bg-panel' : 'border-line/40 text-muted line-through'}`}
              >
                {p.alive ? '🙂' : '💀'} {p.name}
              </button>
              {editing === p.id && (
                <button
                  onClick={() => {
                    apply((s) => setAlive(s, p.id, !p.alive))
                    setEditing(null)
                  }}
                  className="mt-1 w-full rounded-xl bg-line px-3 py-2 text-sm"
                >
                  {p.alive ? 'Đánh dấu đã chết' : 'Hồi sinh'}
                </button>
              )}
            </li>
          ))}
        </ul>

        {confirmExit ? (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-wolf/50 p-3">
            <p className="text-center">Kết thúc ván này? Không thể chơi tiếp.</p>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1 py-3" onClick={onExit}>
                Kết thúc
              </Button>
              <Button variant="ghost" className="flex-1 py-3" onClick={() => setConfirmExit(false)}>
                Huỷ
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="mt-3 text-wolf" onClick={() => setConfirmExit(true)}>
            Kết thúc ván
          </Button>
        )}
      </div>
    </Sheet>
  )
}
