import { useState } from 'react'
import type { GameState, Player } from '../game/engine'
import { ROLES } from '../game/roles'
import { unlockAudio } from '../tts/narrator'
import { Button, Screen } from './kit'

/** Players pass the phone around; each taps their name and holds to see their card. */
export function Deal({ game, onStart, onCancel }: { game: GameState; onStart: () => void; onCancel: () => void }) {
  const [viewed, setViewed] = useState<Record<string, number>>({})
  const [current, setCurrent] = useState<Player | null>(null)
  const allViewed = game.players.every((p) => viewed[p.id])

  if (current) {
    return (
      <Reveal
        game={game}
        player={current}
        onDone={() => {
          setViewed({ ...viewed, [current.id]: (viewed[current.id] ?? 0) + 1 })
          setCurrent(null)
        }}
      />
    )
  }

  return (
    <Screen className="gap-5">
      <header>
        <h1 className="text-2xl font-extrabold">Chia bài</h1>
        <p className="text-muted">Chuyền máy cho từng người. Bấm vào tên mình để xem vai, đừng để ai nhìn thấy.</p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {game.players.map((p) => (
          <button
            key={p.id}
            onClick={() => setCurrent(p)}
            className={`rounded-2xl border-2 px-3 py-5 text-lg font-semibold ${
              viewed[p.id] ? 'border-line bg-panel/50 text-muted' : 'border-accent/60 bg-panel'
            }`}
          >
            {p.name}
            <span className="block text-xs font-normal">
              {viewed[p.id] ? (viewed[p.id] > 1 ? `Đã xem ×${viewed[p.id]}` : 'Đã xem ✓') : 'Chưa xem'}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <Button
          disabled={!allViewed}
          onClick={() => {
            unlockAudio()
            onStart()
          }}
        >
          {allViewed ? '🌙 Bắt đầu đêm đầu tiên' : `Còn ${game.players.filter((p) => !viewed[p.id]).length} người chưa xem`}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Chia lại từ đầu
        </Button>
      </div>
    </Screen>
  )
}

function Reveal({ game, player, onDone }: { game: GameState; player: Player; onDone: () => void }) {
  const [shown, setShown] = useState(false)
  const role = ROLES[player.role]
  const packmates = game.players.filter((p) => p.role === 'WEREWOLF' && p.id !== player.id)

  return (
    <Screen className="items-center justify-center gap-6 text-center">
      <p className="text-muted">Máy của</p>
      <h1 className="text-3xl font-extrabold">{player.name}</h1>
      <button
        onPointerDown={() => setShown(true)}
        onPointerUp={() => setShown(false)}
        onPointerLeave={() => setShown(false)}
        onPointerCancel={() => setShown(false)}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex aspect-[3/4] w-64 flex-col items-center justify-center gap-3 rounded-3xl border-2 p-5 select-none ${
          shown ? (role.team === 'WOLF' ? 'border-wolf bg-wolf/15' : 'border-accent bg-accent/15') : 'border-line bg-panel'
        }`}
        style={{ WebkitTouchCallout: 'none' }}
      >
        {shown ? (
          <>
            <span className="text-7xl">{role.icon}</span>
            <span className="text-2xl font-extrabold">{role.nameVi}</span>
            <span className="text-sm text-muted">{role.description}</span>
            {player.role === 'WEREWOLF' && (
              <span className="text-sm font-semibold text-wolf">
                {packmates.length ? `Đồng bọn: ${packmates.map((p) => p.name).join(', ')}` : 'Bạn là Sói duy nhất'}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-6xl">🂠</span>
            <span className="font-semibold">Bấm giữ để xem vai</span>
          </>
        )}
      </button>
      <Button variant="ghost" className="w-64" onClick={onDone}>
        Đã xem, chuyền máy
      </Button>
    </Screen>
  )
}
