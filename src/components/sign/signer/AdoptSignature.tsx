import { useLayoutEffect, useRef, useState } from 'react'
import { ImageUp, PenLine, RotateCcw, Type, Upload } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SIGNATURE_FONTS, cleanUpload, initialsOf, typedToPng, type AdoptedSignature } from '@/lib/sign/signer'
import { Seg } from '../templates/parts'

/** A drawing pad: pointer events with capture, smooth quadratic strokes, PNG out. */
function Pad({ hint, small, onInk }: { hint: string; small?: boolean; onInk: (png: string | null) => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const st = useRef<{ down: boolean; pts: [number, number][] }>({ down: false, pts: [] })
  const [ink, setInk] = useState(false)

  useLayoutEffect(() => {
    const c = cv.current!
    const r = c.getBoundingClientRect()
    const d = window.devicePixelRatio || 1
    c.width = r.width * d
    c.height = r.height * d
    const x = c.getContext('2d')!
    x.scale(d, d)
    x.lineCap = 'round'
    x.lineJoin = 'round'
    x.strokeStyle = '#14183A'
    x.lineWidth = small ? 2.2 : 2.6
  }, [small])

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = cv.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const up = () => {
    if (!st.current.down) return
    st.current.down = false
    if (st.current.pts.length > 2 || ink) {
      setInk(true)
      onInk(cv.current!.toDataURL('image/png'))
    }
  }
  return (
    <div className="gio-sig-pad" style={small ? { height: 110 } : undefined}>
      <span aria-hidden className="pointer-events-none absolute bottom-[38px] left-5 right-5 border-t border-dashed border-[#C9C8C1]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 font-inter text-[12.5px] text-[#6B7080] transition-opacity duration-150"
        style={{ opacity: ink ? 0 : 1 }}
      >
        <PenLine className="h-[18px] w-[18px]" strokeWidth={2} />
        {hint}
      </div>
      <canvas
        ref={cv}
        aria-label={hint}
        onPointerDown={(e) => {
          e.preventDefault()
          cv.current!.setPointerCapture(e.pointerId)
          st.current = { down: true, pts: [pos(e)] }
        }}
        onPointerMove={(e) => {
          if (!st.current.down) return
          const pts = st.current.pts
          pts.push(pos(e))
          if (pts.length < 3) return
          const [a, b, c] = pts.slice(-3)
          const x = cv.current!.getContext('2d')!
          x.beginPath()
          x.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
          x.quadraticCurveTo(b[0], b[1], (b[0] + c[0]) / 2, (b[1] + c[1]) / 2)
          x.stroke()
          if (!ink) setInk(true)
        }}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {ink && (
        <Button
          variant="ghost"
          size="xs"
          icon={RotateCcw}
          className="absolute right-2 top-2"
          onClick={() => {
            const c = cv.current!
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
            setInk(false)
            onInk(null)
          }}
        >
          Clear
        </Button>
      )}
    </div>
  )
}

export function AdoptSignature({
  open,
  onOpenChange,
  defaultName,
  initial,
  mobile,
  onAdopt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  initial: AdoptedSignature | null
  mobile: boolean
  onAdopt: (a: AdoptedSignature) => void
}) {
  const [tab, setTab] = useState<'type' | 'draw' | 'upload'>(initial?.kind ?? 'type')
  const [name, setName] = useState(initial?.fullName ?? defaultName)
  const [ini, setIni] = useState(initial?.initials ?? initialsOf(defaultName))
  const [font, setFont] = useState(initial?.font ?? SIGNATURE_FONTS[0][0])
  const [drawn, setDrawn] = useState<string | null>(null)
  const [drawnIni, setDrawnIni] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const ok = name.trim().length > 0 && (tab === 'type' ? ini.trim().length > 0 : tab === 'draw' ? !!drawn : !!uploaded)

  const read = async (f: File | undefined) => {
    setProblem(null)
    if (!f) return
    if (!/^image\/(png|jpe?g|webp|heic)$/i.test(f.type)) return setProblem('Use a PNG or JPG photo of your signature.')
    if (f.size > 10 * 1024 * 1024) return setProblem('That image is over 10 MB.')
    try {
      setUploaded(await cleanUpload(f))
    } catch {
      setProblem('That image couldn’t be read. Try another one.')
    }
  }

  const adopt = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      const fullName = name.trim()
      const initials = (ini.trim() || initialsOf(fullName)).slice(0, 4)
      if (tab === 'type') {
        onAdopt({
          kind: 'type',
          fullName,
          initials,
          font,
          image: await typedToPng(fullName, font),
          initialsImage: await typedToPng(initials, font),
        })
      } else {
        onAdopt({
          kind: tab,
          fullName,
          initials,
          font: null,
          image: (tab === 'draw' ? drawn : uploaded)!,
          initialsImage: tab === 'draw' ? drawnIni ?? (await typedToPng(initials, SIGNATURE_FONTS[0][0])) : await typedToPng(initials, SIGNATURE_FONTS[0][0]),
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-24px)] max-w-[560px] overflow-y-auto rounded-2xl p-0">
        <div className="flex items-start gap-3 px-6 pb-3 pt-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2EBFF] text-virgilio-purple">
            <PenLine className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-poppins text-[17px] font-semibold tracking-[-0.02em] text-text-primary">Adopt your signature</DialogTitle>
            <DialogDescription className="mt-1 font-inter text-[13px] leading-normal text-text-secondary">
              Choose how you sign. It’s used everywhere you sign or initial in this document.
            </DialogDescription>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-6 pb-4">
          <Seg
            label="How you sign"
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            options={[
              { value: 'type', label: 'Type', icon: Type },
              { value: 'draw', label: mobile ? 'Draw with finger' : 'Draw', icon: PenLine },
              { value: 'upload', label: 'Upload', icon: Upload },
            ]}
          />
          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
              Full name
              <Input
                value={name}
                maxLength={120}
                autoComplete="name"
                onChange={(e) => {
                  setName(e.target.value)
                  setIni(initialsOf(e.target.value))
                }}
              />
            </label>
            <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
              Initials
              <Input value={ini} maxLength={4} onChange={(e) => setIni(e.target.value.toUpperCase())} />
            </label>
          </div>
          {tab === 'type' && (
            <div role="radiogroup" aria-label="Signature style" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SIGNATURE_FONTS.map(([f, size]) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={font === f}
                  onClick={() => setFont(f)}
                  className={cn(
                    'gio-pressable flex h-[72px] items-center justify-between gap-3 overflow-hidden rounded-[10px] border bg-white px-3.5 text-[#14183A] transition-colors duration-hover',
                    font === f ? 'border-[#0d0d09] ring-1 ring-[#0d0d09]' : 'border-[#E7E8EE] hover:bg-[#FAFAF7]',
                  )}
                >
                  <span className="truncate" style={{ fontFamily: `'${f}', cursive`, fontSize: mobile ? size * 0.8 : size * 0.85 }}>
                    {name || 'Your name'}
                  </span>
                  <span className="shrink-0 text-[20px] text-[#4A4E66]" style={{ fontFamily: `'${f}', cursive` }}>
                    {ini}
                  </span>
                </button>
              ))}
            </div>
          )}
          {tab === 'draw' && (
            <>
              <Pad hint={mobile ? 'Sign here with your finger' : 'Draw your signature'} onInk={setDrawn} />
              <Pad small hint="Initials (optional)" onInk={setDrawnIni} />
            </>
          )}
          {tab === 'upload' && (
            <div
              role="button"
              tabIndex={0}
              data-drag-over={over || undefined}
              onClick={() => file.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), file.current?.click())}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(false)
                void read(e.dataTransfer.files[0])
              }}
              className={cn(
                'gio-dropzone flex min-h-[170px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed p-4 text-center font-inter text-[12.5px] text-text-secondary',
                over ? 'border-[#0d0d09] bg-[#FAFAF7]' : 'border-[#CFCDC4] bg-white',
              )}
            >
              {uploaded ? (
                <>
                  <img src={uploaded} alt="Your uploaded signature" className="max-h-[120px] max-w-[90%]" />
                  <span className="text-[11.5px] text-text-tertiary">Click to replace</span>
                </>
              ) : (
                <>
                  <ImageUp className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
                  <span className="font-medium text-text-primary">{mobile ? 'Take a photo or choose an image' : 'Drop an image of your signature'}</span>
                  <span className="text-[11.5px] text-text-tertiary">PNG or JPG. Sign on white paper; the background is cleared.</span>
                </>
              )}
              <input
                ref={file}
                type="file"
                accept="image/*"
                capture={mobile ? 'environment' : undefined}
                hidden
                onChange={(e) => void read(e.target.files?.[0])}
              />
            </div>
          )}
          <p className="min-h-[18px] font-inter text-[12px] text-virgilio-error" role={problem ? 'alert' : undefined}>
            {problem}
          </p>
          <p className="font-inter text-[11.5px] leading-relaxed text-text-tertiary">
            By selecting Adopt and sign, I agree that this signature and initials are the electronic representation of my signature
            for all purposes when I use them on documents, just the same as a pen-and-paper signature.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F1F0EC] px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void adopt()} disabled={!ok} loading={busy}>
            Adopt and sign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
