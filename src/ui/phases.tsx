import { useEffect, useRef, useState } from 'react'
import {
  act,
  advance,
  chooseSheriff,
  hasScapegoatCard,
  hunterShoot,
  hunterTargets,
  isRealWake,
  loverOf,
  nameOf,
  nightTargets,
  playerById,
  scapegoatChoose,
  thiefMustTake,
  todaysVoters,
  vote,
  voteTargets,
  voteTie,
  alivePlayers,
  type Death,
  type GameState,
} from '../game/engine'
import { ROLES, type NightStep, type Winner } from '../game/roles'
import * as script from '../game/script'
import type { Settings } from '../game/settings'
import { beep, speak } from '../tts/narrator'
import { formatClock, useCountdown, useScript, type Countdown } from './hooks'
import { BigTitle, Button, Caption, MultiPlayerPicker, PlayerPicker } from './kit'

export interface PhaseProps {
  game: GameState
  settings: Settings
  apply: (fn: (s: GameState) => GameState) => void
}

/** A promise the script can await until the players tap something. */
function useUserStep() {
  const resolver = useRef<(() => void) | null>(null)
  return {
    wait: () => new Promise<void>((r) => (resolver.current = r)),
    done: () => {
      resolver.current?.()
      resolver.current = null
    },
  }
}

function useUnmountSignal() {
  const controller = useRef(new AbortController())
  useEffect(() => () => controller.current.abort(), [])
  return controller.current.signal
}

const randomBetween = (min: number, max: number) => min + Math.random() * Math.max(0, max - min)

export function NightStart({ game, settings, apply }: PhaseProps) {
  const caption = useScript(async ({ say, wait }) => {
    await say(script.nightStartLines(game.day))
    await wait(settings.nightIntroSeconds)
    apply(advance)
  })
  return (
    <>
      <BigTitle icon="🌙" title={`Đêm thứ ${game.day}`} subtitle="Cả làng nhắm mắt" />
      <Caption text={caption} />
    </>
  )
}

const ROLE_ACTION: Record<'SEER' | 'GUARD' | 'WEREWOLF', { title: string; confirm: string; skip: string }> = {
  SEER: { title: 'Chọn một người để soi', confirm: 'Soi người này', skip: 'Không soi ai' },
  GUARD: { title: 'Chọn một người để bảo vệ', confirm: 'Bảo vệ người này', skip: 'Không bảo vệ ai' },
  WEREWOLF: { title: 'Chọn một người để cắn', confirm: 'Cắn người này', skip: 'Không cắn ai' },
}

/** Title and icon of a night step; LOVERS and CHARMED are not cards. */
function stepInfo(step: NightStep): { icon: string; title: string } {
  if (step === 'LOVERS') return { icon: '💞', title: 'Cặp đôi' }
  if (step === 'CHARMED') return { icon: '🎶', title: 'Người bị thôi miên' }
  return { icon: ROLES[step].icon, title: ROLES[step].nameVi }
}

export function NightRoleView({ game, settings, apply, role }: PhaseProps & { role: NightStep }) {
  // Decided once when the role is called: does someone actually hold the phone now?
  const [real] = useState(() => isRealWake(game, role))
  const [stage, setStage] = useState<'wake' | 'act' | 'result' | 'sleep'>('wake')
  const [seerTarget, setSeerTarget] = useState<string | null>(null)
  const step = useUserStep()

  const caption = useScript(async ({ say, wait }) => {
    await say(script.wakeLines(role))
    setStage('act')
    if (real) {
      await step.wait()
      setStage('sleep')
      await wait(settings.afterActionSeconds)
    } else {
      await wait(randomBetween(settings.fakeWakeMinSeconds, settings.fakeWakeMaxSeconds))
      setStage('sleep')
    }
    await say(script.sleepLines(role))
    apply(advance)
  })

  const info = stepInfo(role)
  const title = info.title

  if (stage === 'act' && real && role !== 'LOVERS' && role !== 'CHARMED') {
    if (role === 'WITCH') {
      return (
        <WitchPanel
          game={game}
          onConfirm={(heal, poison) => {
            apply((s) => act(s, { role: 'WITCH', heal, poison }))
            step.done()
          }}
        />
      )
    }
    if (role === 'THIEF') {
      return (
        <ThiefPanel
          game={game}
          onConfirm={(take) => {
            apply((s) => act(s, { role: 'THIEF', take }))
            step.done()
          }}
        />
      )
    }
    if (role === 'CUPID' || role === 'PIPER') {
      const targets = nightTargets(game, role)
      const count = role === 'CUPID' ? 2 : Math.min(2, targets.length)
      return (
        <>
          <BigTitle
            icon={info.icon}
            title={title}
            subtitle={role === 'CUPID' ? 'Chọn hai người làm cặp đôi (được chọn cả mình)' : 'Chọn hai người để thôi miên'}
          />
          <MultiPlayerPicker
            players={targets}
            min={count}
            max={count}
            confirmLabel={role === 'CUPID' ? 'Ghép đôi' : 'Thôi miên'}
            onConfirm={(ids) => {
              apply((s) =>
                act(s, role === 'CUPID' ? { role, lovers: [ids[0], ids[1]] } : { role, targets: ids }),
              )
              step.done()
            }}
          />
        </>
      )
    }
    const text = ROLE_ACTION[role]
    const wolves = game.players.filter((p) => p.role === 'WEREWOLF' && p.alive)
    return (
      <>
        <BigTitle
          icon={info.icon}
          title={title}
          subtitle={role === 'WEREWOLF' ? `Đồng bọn: ${wolves.map((w) => w.name).join(', ')}` : text.title}
        />
        {role === 'WEREWOLF' && <p className="mb-3 text-center text-muted">{text.title}</p>}
        {role === 'GUARD' && game.lastGuarded && (
          <p className="mb-3 text-center text-sm text-muted">Đêm qua đã bảo vệ {nameOf(game, game.lastGuarded)}</p>
        )}
        <PlayerPicker
          players={nightTargets(game, role)}
          confirmLabel={text.confirm}
          skipLabel={text.skip}
          tone={role === 'WEREWOLF' ? 'danger' : 'primary'}
          onConfirm={(target) => {
            apply((s) => act(s, { role, target }))
            if (role === 'SEER' && target) {
              setSeerTarget(target)
              setStage('result')
            } else {
              step.done()
            }
          }}
        />
      </>
    )
  }

  if (stage === 'result' && seerTarget) {
    const target = playerById(game, seerTarget)
    const isWolf = target?.role === 'WEREWOLF'
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-muted">Kết quả soi</p>
        <h1 className="text-3xl font-extrabold">{target?.name}</h1>
        <div
          className={`rounded-3xl border-2 px-8 py-6 text-2xl font-extrabold ${
            isWolf ? 'border-wolf bg-wolf/15 text-wolf' : 'border-accent bg-accent/15'
          }`}
        >
          {isWolf ? '🐺 LÀ MA SÓI' : '🙂 KHÔNG PHẢI SÓI'}
        </div>
        <Button className="w-full" onClick={step.done}>
          Đã xem, đặt máy xuống
        </Button>
      </div>
    )
  }

  return (
    <>
      <BigTitle icon={info.icon} title={`${title} thức dậy`} subtitle={stage === 'sleep' ? 'Đi ngủ…' : 'Những người khác nhắm mắt'} />
      <Caption text={caption} />
    </>
  )
}

function WitchPanel({ game, onConfirm }: { game: GameState; onConfirm: (heal: boolean, poison: string | null) => void }) {
  const victim = playerById(game, game.night.wolfTarget)
  const canHeal = !game.witchHealUsed && !!victim
  const canPoison = !game.witchPoisonUsed
  const [heal, setHeal] = useState<boolean | null>(canHeal ? null : false)

  if (heal === null) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <BigTitle icon="🧪" title="Phù thủy" subtitle="Bình cứu" />
        <p className="rounded-2xl bg-panel p-4 text-center text-lg">
          Đêm nay Ma Sói đã cắn <b className="text-wolf">{victim?.name}</b>
        </p>
        <div className="mt-auto flex flex-col gap-3">
          <Button onClick={() => (canPoison ? setHeal(true) : onConfirm(true, null))}>Dùng bình cứu</Button>
          <Button variant="ghost" onClick={() => (canPoison ? setHeal(false) : onConfirm(false, null))}>
            Không cứu
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <BigTitle icon="🧪" title="Phù thủy" subtitle="Bình độc" />
      {!canHeal && (
        <p className="text-center text-sm text-muted">
          {game.witchHealUsed ? 'Bạn đã dùng hết bình cứu' : 'Đêm nay Ma Sói không cắn ai'}
        </p>
      )}
      {canPoison ? (
        <PlayerPicker
          players={nightTargets(game, 'WITCH')}
          confirmLabel="Đầu độc người này"
          skipLabel="Không dùng bình độc"
          tone="danger"
          onConfirm={(target) => onConfirm(heal, target)}
        />
      ) : (
        <Button className="mt-auto" onClick={() => onConfirm(heal, null)}>
          Xong
        </Button>
      )}
    </div>
  )
}

function ThiefPanel({ game, onConfirm }: { game: GameState; onConfirm: (take: number | null) => void }) {
  const mustTake = thiefMustTake(game)
  const options = game.leftover.map((role, i) => ({ id: String(i), label: `${ROLES[role].icon} Lấy vai ${ROLES[role].nameVi}` }))
  return (
    <>
      <BigTitle
        icon="🦝"
        title="Ăn trộm"
        subtitle={mustTake ? 'Cả hai lá đều là Ma Sói, bạn phải đổi lấy một lá' : 'Đổi lấy một trong hai lá thừa, hoặc giữ nguyên'}
      />
      <PlayerPicker
        players={[]}
        skipLabel={mustTake ? undefined : `${ROLES.THIEF.icon} Giữ nguyên, làm Dân làng`}
        extraOptions={options}
        confirmLabel="Xác nhận"
        onConfirm={(id) => onConfirm(id === null ? null : Number(id))}
      />
    </>
  )
}

function DeathList({ game, deaths }: { game: GameState; deaths: string[] }) {
  if (deaths.length === 0) return <p className="text-center text-lg">Không ai chết 🕊️</p>
  return (
    <ul className="flex flex-col gap-2">
      {deaths.map((id) => (
        <li key={id} className="rounded-2xl border border-wolf/40 bg-wolf/10 px-4 py-3 text-center text-lg font-semibold">
          💀 {nameOf(game, id)}
        </li>
      ))}
    </ul>
  )
}

export function Dawn({ game, settings, apply, deaths }: PhaseProps & { deaths: Death[] }) {
  const caption = useScript(async ({ say, wait }) => {
    await say(script.dawnLines(game, deaths, settings.revealRoleOnDeath))
    await wait(1)
    apply(advance)
  })
  return (
    <>
      <BigTitle icon="☀️" title={`Sáng ngày ${game.day}`} subtitle="Cả làng mở mắt" />
      <DeathList game={game} deaths={deaths.map((d) => d.playerId)} />
      <div className="mt-4">
        <Caption text={caption} />
      </div>
    </>
  )
}

export function Hunter({ game, settings, apply, hunterId }: PhaseProps & { hunterId: string }) {
  const [picking, setPicking] = useState(false)
  const step = useUserStep()
  const shot = useRef<string | null>(null)

  const caption = useScript(async ({ say, wait }) => {
    await say(script.hunterWakeLines(game, hunterId))
    setPicking(true)
    await step.wait()
    setPicking(false)
    await wait(1)
    // `game` here is from before the shot, which is fine: only names and roles are read.
    const partner = loverOf(game, shot.current)
    const grief = partner && playerById(game, partner)?.alive ? [partner] : []
    await say(script.hunterResultLines(game, shot.current, grief, settings.revealRoleOnDeath))
    apply(advance)
  })

  if (picking) {
    return (
      <>
        <BigTitle icon="🏹" title={`${nameOf(game, hunterId)} – Thợ săn`} subtitle="Chọn một người để bắn theo" />
        <PlayerPicker
          players={hunterTargets(game)}
          confirmLabel="Bắn người này"
          skipLabel="Không bắn ai"
          tone="danger"
          onConfirm={(target) => {
            shot.current = target
            apply((s) => hunterShoot(s, target))
            step.done()
          }}
        />
      </>
    )
  }
  return (
    <>
      <BigTitle icon="🏹" title="Thợ săn" subtitle={nameOf(game, hunterId)} />
      <Caption text={caption} />
    </>
  )
}

function Timer({ label, countdown }: { label: string; countdown: Countdown }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-muted">{label}</p>
      <div className={`font-mono text-7xl font-extrabold tabular-nums ${countdown.remaining <= 10 ? 'text-day' : ''}`}>
        {formatClock(countdown.remaining)}
      </div>
      {countdown.running && (
        <div className="flex w-full gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => countdown.addSeconds(30)}>
            +30 giây
          </Button>
          <Button variant="day" className="flex-1" onClick={countdown.finish}>
            Xong sớm
          </Button>
        </div>
      )}
    </div>
  )
}

/** Runs intro lines, a countdown with spoken reminders, then the outro; resolves when all is said. */
function useTimedStep(seconds: number, intro: script.Line[], outro: script.Line[], then: () => void) {
  const signal = useUnmountSignal()
  const step = useUserStep()
  const countdown = useCountdown(seconds, step.done, (warning) => void speak(warning, signal).catch(() => {}))
  const caption = useScript(async ({ say }) => {
    await say(intro)
    countdown.start()
    await step.wait()
    beep(2)
    await say(outro)
    then()
  })
  return { countdown, caption }
}

export function Discussion({ game, settings, apply }: PhaseProps) {
  const { countdown, caption } = useTimedStep(
    settings.discussionSeconds,
    script.discussionLines(settings.discussionSeconds),
    script.discussionEndLines,
    () => apply(advance),
  )
  return (
    <>
      <BigTitle icon="🗣️" title={`Ngày ${game.day} – Thảo luận`} subtitle={`Còn ${alivePlayers(game).length} người sống`} />
      <Timer label="Thời gian thảo luận" countdown={countdown} />
      <div className="mt-6">
        <Caption text={caption} />
      </div>
    </>
  )
}

const TIE = '__tie__'

export function Vote({ game, settings, apply }: PhaseProps) {
  const [picking, setPicking] = useState(false)
  const voters = todaysVoters(game)
  const { countdown, caption } = useTimedStep(
    settings.voteSeconds,
    script.voteLines(settings.voteSeconds, voters?.map((p) => p.name) ?? null),
    script.voteEndLines,
    () => setPicking(true),
  )
  if (picking) {
    const scapegoat = hasScapegoatCard(game)
    return (
      <>
        <BigTitle icon="⚖️" title="Kết quả bỏ phiếu" subtitle="Ai bị cả làng treo cổ?" />
        <PlayerPicker
          players={voteTargets(game)}
          confirmLabel="Xác nhận"
          skipLabel={scapegoat ? 'Không treo ai' : 'Không treo ai (hoà phiếu hoặc bỏ qua)'}
          extraOptions={scapegoat ? [{ id: TIE, label: `${ROLES.SCAPEGOAT.icon} Hoà phiếu` }] : []}
          tone="day"
          onConfirm={(target) => apply((s) => (target === TIE ? voteTie(s) : vote(s, target)))}
        />
      </>
    )
  }
  return (
    <>
      <BigTitle
        icon="✋"
        title="Bỏ phiếu"
        subtitle={voters ? `Chỉ ${voters.map((p) => p.name).join(', ')} được bỏ phiếu` : 'Giơ tay chỉ vào người bạn nghi là Sói'}
      />
      <Timer label="Thời gian bỏ phiếu" countdown={countdown} />
      <div className="mt-6">
        <Caption text={caption} />
      </div>
    </>
  )
}

export function LastWords({ game, settings, apply, targetId, tie }: PhaseProps & { targetId: string; tie: boolean }) {
  if (settings.lastWordsSeconds === 0) return <SkipPhase apply={apply} />
  return <LastWordsTimer game={game} settings={settings} apply={apply} targetId={targetId} tie={tie} />
}

function SkipPhase({ apply }: Pick<PhaseProps, 'apply'>) {
  useEffect(() => apply(advance), [apply])
  return null
}

function LastWordsTimer({ game, settings, apply, targetId, tie }: PhaseProps & { targetId: string; tie: boolean }) {
  const { countdown, caption } = useTimedStep(
    settings.lastWordsSeconds,
    script.lastWordsLines(game, targetId, settings.lastWordsSeconds, tie),
    [],
    () => apply(advance),
  )
  return (
    <>
      <BigTitle icon="🪢" title={nameOf(game, targetId)} subtitle="Lời trăng trối" />
      <Timer label="Thời gian nói lời cuối" countdown={countdown} />
      <div className="mt-6">
        <Caption text={caption} />
      </div>
    </>
  )
}

export function Execution({
  game,
  settings,
  apply,
  targetId,
  spared,
  grief,
}: PhaseProps & { targetId: string | null; spared: boolean; grief: string[] }) {
  const caption = useScript(async ({ say, wait }) => {
    await say(script.executionLines(game, targetId, settings.revealRoleOnDeath, { spared, grief }))
    await wait(1)
    apply(advance)
  })
  return (
    <>
      <BigTitle icon="⚖️" title="Phán quyết" />
      {spared ? (
        <p className="rounded-2xl border border-day/40 bg-day/10 px-4 py-3 text-center text-lg font-semibold">
          {ROLES.IDIOT.icon} {nameOf(game, targetId)} là Thằng ngốc, được tha
        </p>
      ) : (
        <DeathList game={game} deaths={targetId ? [targetId, ...grief] : []} />
      )}
      <div className="mt-4">
        <Caption text={caption} />
      </div>
    </>
  )
}

/** Speaks a result once, then moves on; mounted after a choice so the narration runs exactly once. */
function Announce({ lines, onDone }: { lines: script.Line[]; onDone: () => void }) {
  const caption = useScript(async ({ say, wait }) => {
    await say(lines)
    await wait(1)
    onDone()
  })
  return <Caption text={caption} />
}

export function SheriffElection({ game, settings, apply, chosen }: PhaseProps & { chosen: string | null | undefined }) {
  const [picking, setPicking] = useState(false)
  const { countdown, caption } = useTimedStep(
    settings.voteSeconds,
    script.sheriffElectionLines(settings.voteSeconds),
    script.sheriffElectionEndLines,
    () => setPicking(true),
  )
  if (chosen !== undefined) {
    return (
      <>
        <BigTitle icon="👑" title={chosen ? nameOf(game, chosen) : 'Không có Trưởng làng'} subtitle="Trưởng làng" />
        <Announce lines={script.sheriffResultLines(game, chosen)} onDone={() => apply(advance)} />
      </>
    )
  }
  if (picking) {
    return (
      <>
        <BigTitle icon="👑" title="Bầu Trưởng làng" subtitle="Ai được nhiều phiếu nhất?" />
        <PlayerPicker
          players={alivePlayers(game)}
          confirmLabel="Chọn làm Trưởng làng"
          skipLabel="Không bầu ai"
          tone="day"
          onConfirm={(id) => apply((s) => chooseSheriff(s, id))}
        />
      </>
    )
  }
  return (
    <>
      <BigTitle icon="👑" title="Bầu Trưởng làng" subtitle="Phiếu của Trưởng làng được tính gấp đôi" />
      <Timer label="Thời gian bầu" countdown={countdown} />
      <div className="mt-6">
        <Caption text={caption} />
      </div>
    </>
  )
}

export function SheriffSuccessor({
  game,
  apply,
  formerId,
  chosen,
}: PhaseProps & { formerId: string; chosen: string | null | undefined }) {
  const [picking, setPicking] = useState(false)
  const caption = useScript(async ({ say }) => {
    await say(script.sheriffSuccessorLines(game, formerId))
    setPicking(true)
  })
  if (chosen !== undefined) {
    return (
      <>
        <BigTitle icon="👑" title={chosen ? nameOf(game, chosen) : 'Không có Trưởng làng'} subtitle="Trưởng làng mới" />
        <Announce lines={script.sheriffResultLines(game, chosen)} onDone={() => apply(advance)} />
      </>
    )
  }
  if (picking) {
    return (
      <>
        <BigTitle icon="👑" title={nameOf(game, formerId)} subtitle="Chọn người kế nhiệm Trưởng làng" />
        <PlayerPicker
          players={alivePlayers(game)}
          confirmLabel="Trao chức Trưởng làng"
          skipLabel="Không trao cho ai"
          tone="day"
          onConfirm={(id) => apply((s) => chooseSheriff(s, id))}
        />
      </>
    )
  }
  return (
    <>
      <BigTitle icon="👑" title="Trưởng làng đã chết" subtitle={nameOf(game, formerId)} />
      <Caption text={caption} />
    </>
  )
}

export function Scapegoat({
  game,
  apply,
  scapegoatId,
  chosen,
}: PhaseProps & { scapegoatId: string; chosen: string[] | undefined }) {
  const [picking, setPicking] = useState(false)
  const caption = useScript(async ({ say }) => {
    await say(script.scapegoatLines(game, scapegoatId))
    setPicking(true)
  })
  const alive = alivePlayers(game)
  if (chosen !== undefined) {
    return (
      <>
        <BigTitle icon={ROLES.SCAPEGOAT.icon} title="Ngày mai được bỏ phiếu" subtitle={chosen.map((id) => nameOf(game, id)).join(', ')} />
        <Announce lines={script.scapegoatResultLines(game, chosen)} onDone={() => apply(advance)} />
      </>
    )
  }
  if (picking) {
    return (
      <>
        <BigTitle icon={ROLES.SCAPEGOAT.icon} title={nameOf(game, scapegoatId)} subtitle="Chọn những người được bỏ phiếu ngày mai" />
        <MultiPlayerPicker
          players={alive}
          min={Math.min(1, alive.length)}
          max={alive.length}
          confirmLabel="Xác nhận"
          onConfirm={(ids) => apply((s) => scapegoatChoose(s, ids))}
        />
      </>
    )
  }
  return (
    <>
      <BigTitle icon={ROLES.SCAPEGOAT.icon} title="Kẻ thế mạng" subtitle={nameOf(game, scapegoatId)} />
      <Caption text={caption} />
    </>
  )
}

const WINNER_TITLE: Record<Winner, { icon: string; title: string }> = {
  WOLF: { icon: '🐺', title: 'Phe Ma Sói thắng!' },
  VILLAGE: { icon: '🏡', title: 'Phe Dân Làng thắng!' },
  PIPER: { icon: '🪈', title: 'Thổi sáo thắng!' },
  LOVERS: { icon: '💞', title: 'Cặp đôi thắng!' },
}

/** Small markers on the final reveal: who was in love, who was charmed. */
function badges(game: GameState, id: string): string {
  return `${game.lovers?.includes(id) ? ' 💘' : ''}${game.charmed.includes(id) ? ' 🎶' : ''}${game.sheriff === id ? ' 👑' : ''}`
}

export function Ended({ game, winner, onExit }: Pick<PhaseProps, 'game'> & { winner: Winner; onExit: () => void }) {
  const caption = useScript(async ({ say }) => {
    beep(3)
    await say(script.endLines(winner))
  })
  return (
    <div className="flex flex-col gap-4">
      <BigTitle
        icon={WINNER_TITLE[winner].icon}
        title={WINNER_TITLE[winner].title}
        subtitle="Trò chơi kết thúc"
      />
      <Caption text={caption} />
      <ul className="grid grid-cols-2 gap-2">
        {game.players.map((p) => (
          <li
            key={p.id}
            className={`rounded-2xl border px-3 py-2 ${p.alive ? 'border-line bg-panel' : 'border-line/40 bg-panel/40 text-muted'}`}
          >
            <span className="block font-semibold">
              {p.alive ? '' : '💀 '}
              {p.name}
              {badges(game, p.id)}
            </span>
            <span className="text-sm">
              {ROLES[p.role].icon} {ROLES[p.role].nameVi}
            </span>
          </li>
        ))}
      </ul>
      <details className="rounded-2xl bg-panel p-4">
        <summary className="font-semibold">Diễn biến ván</summary>
        <ol className="mt-3 flex flex-col gap-1 text-sm text-muted">
          {game.log.map((l, i) => (
            <li key={i}>{l.text}</li>
          ))}
        </ol>
      </details>
      <Button onClick={onExit}>Chơi ván mới</Button>
    </div>
  )
}
