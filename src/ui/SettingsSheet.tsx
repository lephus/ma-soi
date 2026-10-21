import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type Settings } from '../game/settings'
import { onVoicesChanged, speak, speechSupported, unlockAudio, vietnameseVoices } from '../tts/narrator'
import { Button, NumberField, Sheet } from './kit'

export function useVietnameseVoices() {
  const [voices, setVoices] = useState(vietnameseVoices)
  useEffect(() => onVoicesChanged(() => setVoices(vietnameseVoices())), [])
  return voices
}

export function NoVoiceWarning() {
  const voices = useVietnameseVoices()
  if (voices.length > 0) return null
  return (
    <div className="rounded-2xl border border-day/50 bg-day/10 p-4 text-sm">
      <p className="font-semibold text-day">
        {speechSupported ? 'Chưa tìm thấy giọng đọc tiếng Việt trên máy này' : 'Trình duyệt này không hỗ trợ đọc'}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
        <li>iPhone: Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Việt, tải một giọng.</li>
        <li>Android: cài “Dịch vụ lời nói của Google”, rồi tải dữ liệu giọng Tiếng Việt.</li>
        <li>Máy tính: dùng Chrome hoặc Edge.</li>
      </ul>
      <p className="mt-2 text-muted">Không có giọng đọc thì lời dẫn vẫn hiện trên màn hình.</p>
    </div>
  )
}

export function SettingsSheet({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings
  onChange: (s: Settings) => void
  onClose: () => void
}) {
  const voices = useVietnameseVoices()
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value })

  const testVoice = () => {
    unlockAudio()
    void speak('Màn đêm buông xuống. Cả làng hãy nhắm mắt lại.', new AbortController().signal)
  }

  return (
    <Sheet title="Cài đặt" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <h3 className="mt-1 text-sm font-semibold tracking-wider text-muted uppercase">Giọng đọc</h3>
        <NoVoiceWarning />
        {voices.length > 0 && (
          <label className="flex flex-col gap-2 rounded-2xl bg-panel px-4 py-3">
            <span className="font-semibold">Giọng</span>
            <select
              value={settings.voiceURI ?? ''}
              onChange={(e) => set('voiceURI', e.target.value || null)}
              className="rounded-xl border border-line bg-night px-3 py-2"
            >
              <option value="">Tự chọn</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Slider label="Tốc độ đọc" value={settings.speechRate} min={0.6} max={1.4} step={0.1} onChange={(v) => set('speechRate', v)} />
        <Slider label="Âm lượng" value={settings.volume} min={0.2} max={1} step={0.1} onChange={(v) => set('volume', v)} />
        <Button variant="ghost" onClick={testVoice}>
          🔊 Nghe thử
        </Button>

        <h3 className="mt-3 text-sm font-semibold tracking-wider text-muted uppercase">Thời gian (giây)</h3>
        <NumberField label="Thảo luận ban ngày" value={settings.discussionSeconds} min={10} onChange={(v) => set('discussionSeconds', v)} />
        <NumberField label="Bỏ phiếu" value={settings.voteSeconds} min={5} onChange={(v) => set('voteSeconds', v)} />
        <NumberField
          label="Lời trăng trối"
          hint="Người bị treo cổ được nói lời cuối. 0 để bỏ qua"
          value={settings.lastWordsSeconds}
          onChange={(v) => set('lastWordsSeconds', v)}
        />
        <NumberField label="Nhắm mắt đầu đêm" value={settings.nightIntroSeconds} max={60} onChange={(v) => set('nightIntroSeconds', v)} />
        <NumberField
          label="Chờ sau khi chọn"
          hint="Để kịp đặt điện thoại xuống"
          value={settings.afterActionSeconds}
          max={30}
          onChange={(v) => set('afterActionSeconds', v)}
        />
        <NumberField
          label="Gọi giả: ít nhất"
          hint="Vai đã chết vẫn được gọi để không ai đoán ra"
          value={settings.fakeWakeMinSeconds}
          max={120}
          onChange={(v) => set('fakeWakeMinSeconds', v)}
        />
        <NumberField
          label="Gọi giả: nhiều nhất"
          value={settings.fakeWakeMaxSeconds}
          min={settings.fakeWakeMinSeconds}
          max={120}
          onChange={(v) => set('fakeWakeMaxSeconds', v)}
        />

        <h3 className="mt-3 text-sm font-semibold tracking-wider text-muted uppercase">Luật</h3>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-panel px-4 py-3">
          <span>
            <span className="block font-semibold">Công bố vai của người chết</span>
            <span className="block text-xs text-muted">Đọc tên vai khi có người chết</span>
          </span>
          <input
            type="checkbox"
            checked={settings.revealRoleOnDeath}
            onChange={(e) => set('revealRoleOnDeath', e.target.checked)}
            className="h-6 w-6 accent-violet-500"
          />
        </label>

        <Button variant="ghost" className="mt-3" onClick={() => onChange({ ...DEFAULT_SETTINGS, voiceURI: settings.voiceURI })}>
          Khôi phục mặc định
        </Button>
      </div>
    </Sheet>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex flex-col gap-2 rounded-2xl bg-panel px-4 py-3">
      <span className="flex justify-between font-semibold">
        {label} <span className="text-muted">{value.toFixed(1)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-violet-500"
      />
    </label>
  )
}
