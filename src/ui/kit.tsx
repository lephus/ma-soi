import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Player } from '../game/engine'

type Variant = 'primary' | 'ghost' | 'danger' | 'day'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white active:bg-violet-700 disabled:bg-line disabled:text-muted',
  ghost: 'bg-panel text-white border border-line active:bg-line',
  danger: 'bg-wolf/90 text-white active:bg-wolf',
  day: 'bg-day text-night active:bg-amber-600',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-2xl px-5 py-4 text-base font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  )
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-4 pb-6 ${className}`}>{children}</div>
}

/** The line the narrator is speaking, so the table can read along if the voice is unclear. */
export function Caption({ text }: { text: string }) {
  if (!text) return null
  return (
    <p className="rounded-2xl border border-line bg-panel/70 px-4 py-3 text-center text-sm text-muted" aria-live="polite">
      🔊 {text}
    </p>
  )
}

export function BigTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <div className="text-6xl" aria-hidden>
        {icon}
      </div>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {subtitle && <p className="text-muted">{subtitle}</p>}
    </div>
  )
}

export interface PickerProps {
  players: Player[]
  confirmLabel: string
  /** Offered as an extra choice, e.g. "Không cắn ai". */
  skipLabel?: string
  onConfirm: (id: string | null) => void
  tone?: Variant
}

const SKIP = '__skip__'

/** Tap a player, then confirm, so a stray tap in the dark doesn't count. */
export function PlayerPicker({ players, confirmLabel, skipLabel, onConfirm, tone = 'primary' }: PickerProps) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`rounded-2xl border-2 px-3 py-4 text-lg font-semibold break-words ${
              selected === p.id ? 'border-accent bg-accent/25' : 'border-line bg-panel'
            }`}
          >
            {p.name}
          </button>
        ))}
        {skipLabel && (
          <button
            onClick={() => setSelected(SKIP)}
            className={`col-span-2 rounded-2xl border-2 border-dashed px-3 py-3 font-semibold ${
              selected === SKIP ? 'border-accent bg-accent/25' : 'border-line text-muted'
            }`}
          >
            {skipLabel}
          </button>
        )}
      </div>
      <Button
        variant={tone}
        className="mt-auto"
        disabled={!selected}
        onClick={() => selected && onConfirm(selected === SKIP ? null : selected)}
      >
        {confirmLabel}
      </Button>
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-night p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-2xl text-muted" aria-label="Đóng">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function NumberField({
  label,
  hint,
  value,
  min = 0,
  max = 3600,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min?: number
  max?: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-panel px-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))))
        }}
        className="w-20 rounded-xl border border-line bg-night px-2 py-2 text-right text-lg"
      />
    </label>
  )
}
