import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { embedUrl, type VideoSource } from '@/lib/postingMedia'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Whether this visitor has clicked or typed on the page yet (browsers allow sound after that). */
const hasInteracted = () =>
  typeof navigator !== 'undefined' && !!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive

/**
 * The job post's video, in a player over the page (Allan, 2026-10-22). It
 * starts on its own with sound when the browser allows it; browsers refuse
 * sound until the visitor has interacted with the site, so then it plays muted
 * with a "Turn on sound" button (one tap). With reduced motion it waits for
 * Play. Closes with ×, Esc or a click outside.
 */
export function JobVideoPopup({
  video,
  open,
  onOpenChange,
  title,
}: {
  video: VideoSource
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
}) {
  const fileRef = useRef<HTMLVideoElement>(null)
  const autoplay = !reducedMotion()
  // Links (YouTube, Vimeo, Loom) can't report a refused start, so they begin
  // muted unless the visitor has already interacted; files try sound first.
  const [sound, setSound] = useState(video.kind === 'file' || hasInteracted())
  const [needsSound, setNeedsSound] = useState(false)

  useEffect(() => {
    if (!open) return
    setNeedsSound(video.kind !== 'file' && !hasInteracted() && autoplay)
    setSound(video.kind === 'file' || hasInteracted())
  }, [open, video.kind, autoplay])

  // A file: try with sound as soon as the player exists; if the browser
  // refuses, play muted and offer sound.
  const attachFile = useCallback(
    (el: HTMLVideoElement | null) => {
      fileRef.current = el
      if (!el || !autoplay) return
      el.muted = false
      el.play().catch(() => {
        el.muted = true
        setNeedsSound(true)
        el.play().catch(() => {
          /* the browser refused even muted: the controls are there */
        })
      })
    },
    [autoplay],
  )

  const turnOnSound = () => {
    setNeedsSound(false)
    if (video.kind === 'file') {
      const el = fileRef.current
      if (el) {
        el.muted = false
        void el.play().catch(() => {})
      }
    } else {
      setSound(true)
    }
  }

  // Stop playback as soon as it closes.
  useEffect(() => {
    if (!open) fileRef.current?.pause()
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(960px,calc(100vw-24px))] max-w-none gap-0 overflow-hidden border-0 bg-black p-0 sm:rounded-2xl"
        closeClassName="z-10 rounded-full bg-black/55 p-1.5 text-white opacity-100 hover:bg-black/75 focus:ring-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="relative aspect-video w-full bg-black">
          {video.kind === 'file' ? (
            <video
              ref={attachFile}
              src={video.src}
              controls
              playsInline
              preload="auto"
              className="h-full w-full bg-black"
            />
          ) : (
            open && (
              <iframe
                key={sound ? 'sound' : 'muted'}
                title={title}
                src={embedUrl(video, { autoplay: autoplay || sound, sound })}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
              />
            )
          )}
          {needsSound && (
            <button
              type="button"
              onClick={turnOnSound}
              className="gio-pressable absolute inset-x-0 bottom-16 mx-auto inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 font-poppins text-[13.5px] font-semibold text-[#0d0d09] shadow-lg"
            >
              <Volume2 className="h-4 w-4" aria-hidden />
              Turn on sound
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
