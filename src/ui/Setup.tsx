import { useState } from 'react'
import { CONFIGURABLE_ROLES, ROLES, suggestRoles, validateSetup, type RoleCounts } from '../game/roles'
import { loadNames, saveNames } from '../game/store'
import type { NarratorVoice } from '../tts/narrator'
import { Button, Screen } from './kit'
import { MusicButton } from './music'
import { NoVoiceWarning } from './SettingsSheet'

export function Setup({
  voice,
  onStart,
  onOpenSettings,
  resume,
}: {
  voice: NarratorVoice
  onStart: (names: string[], counts: RoleCounts) => void
  onOpenSettings: () => void
  resume?: { onResume: () => void; onDiscard: () => void }
}) {
  const [names, setNames] = useState<string[]>(loadNames)
  const [draft, setDraft] = useState('')
  const [counts, setCounts] = useState<RoleCounts>(() => suggestRoles(Math.max(names.length, 4)))

  const updateNames = (next: string[]) => {
    setNames(next)
    saveNames(next)
    setCounts(suggestRoles(Math.max(next.length, 4)))
  }

  const add = () => {
    const name = draft.trim()
    if (!name) return
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) return
    updateNames([...names, name])
    setDraft('')
  }

  const specials = CONFIGURABLE_ROLES.reduce((sum, r) => sum + (counts[r] ?? 0), 0)
  const villagers = names.length - specials
  const error = validateSetup(counts, names.length)

  const change = (role: (typeof CONFIGURABLE_ROLES)[number], delta: number) => {
    const max = ROLES[role].unique ? 1 : names.length
    const value = Math.min(max, Math.max(0, (counts[role] ?? 0) + delta))
    setCounts({ ...counts, [role]: value })
  }

  return (
    <Screen className="gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">🌕 Ma Sói</h1>
          <p className="text-sm text-muted">Quản trò tự động – ai cũng được chơi</p>
        </div>
        <div className="flex gap-2">
          <MusicButton className="text-xl" />
          <button onClick={onOpenSettings} className="rounded-full bg-panel px-4 py-2 text-xl" aria-label="Cài đặt">
            ⚙️
          </button>
        </div>
      </header>

      {resume && (
        <div className="flex flex-col gap-3 rounded-2xl border border-accent/50 bg-accent/10 p-4">
          <p className="font-semibold">Có một ván chưa chơi xong</p>
          <div className="flex gap-3">
            <Button className="flex-1 py-3" onClick={resume.onResume}>
              Chơi tiếp
            </Button>
            <Button variant="ghost" className="flex-1 py-3" onClick={resume.onDiscard}>
              Bỏ ván đó
            </Button>
          </div>
        </div>
      )}

      <NoVoiceWarning voice={voice} />

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Người chơi ({names.length})</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nhập tên rồi bấm Thêm"
            maxLength={20}
            enterKeyHint="done"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-panel px-4 py-3 text-base"
          />
          <Button type="submit" className="py-3" disabled={!draft.trim()}>
            Thêm
          </Button>
        </form>
        {names.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {names.map((n) => (
              <li key={n} className="flex items-center gap-1 rounded-full bg-panel py-1 pr-1 pl-3">
                {n}
                <button
                  onClick={() => updateNames(names.filter((x) => x !== n))}
                  className="rounded-full px-2 text-lg text-muted"
                  aria-label={`Xoá ${n}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Bộ bài</h2>
          <button onClick={() => setCounts(suggestRoles(Math.max(names.length, 4)))} className="text-sm text-accent">
            Dùng gợi ý
          </button>
        </div>
        {CONFIGURABLE_ROLES.map((role) => {
          const info = ROLES[role]
          const value = counts[role] ?? 0
          return (
            <div key={role} className="flex items-center gap-3 rounded-2xl bg-panel px-4 py-3">
              <span className="text-2xl" aria-hidden>
                {info.icon}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{info.nameVi}</span>
                <span className="block text-xs text-muted">{info.description}</span>
              </span>
              <Stepper value={value} onMinus={() => change(role, -1)} onPlus={() => change(role, 1)} label={info.nameVi} />
            </div>
          )
        })}
        <div className="flex items-center gap-3 rounded-2xl bg-panel/50 px-4 py-3">
          <span className="text-2xl" aria-hidden>
            {ROLES.VILLAGER.icon}
          </span>
          <span className="flex-1 font-semibold">{ROLES.VILLAGER.nameVi}</span>
          <span className="w-24 text-center text-lg font-bold">{Math.max(0, villagers)}</span>
        </div>
      </section>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-night pt-2">
        {error && <p className="text-center text-sm text-day">{error}</p>}
        <Button disabled={!!error} onClick={() => onStart(names, counts)}>
          Chia bài
        </Button>
      </div>
    </Screen>
  )
}

function Stepper({ value, onMinus, onPlus, label }: { value: number; onMinus: () => void; onPlus: () => void; label: string }) {
  return (
    <div className="flex w-24 items-center justify-between">
      <button onClick={onMinus} className="h-9 w-9 rounded-full bg-line text-xl" aria-label={`Bớt ${label}`}>
        −
      </button>
      <span className="text-lg font-bold">{value}</span>
      <button onClick={onPlus} className="h-9 w-9 rounded-full bg-line text-xl" aria-label={`Thêm ${label}`}>
        +
      </button>
    </div>
  )
}
