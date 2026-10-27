import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CATEGORY_LABELS, type IntegrationCategory } from './integrationRegistry'
import { StateLabel, type IntegrationState } from './IntegrationCard'

/**
 * An integration's details (2026-10-27), in the action-dialog frame: its logo,
 * name, category and state; what it does (and a picture when there is one);
 * Disconnect on the left of the footer, Close and the main action on the right.
 */
export function IntegrationDetailDialog({
  open,
  onOpenChange,
  name,
  description,
  detailContent,
  category,
  logo,
  images,
  state,
  primary,
  onDisconnect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  description: string
  detailContent?: React.ReactNode
  category: IntegrationCategory
  logo: React.ReactNode
  images?: string[]
  state: IntegrationState
  primary?: { label: string; onClick: () => void }
  onDisconnect?: () => void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="gio-dialog-overlay fixed inset-0 z-[60]" style={{ background: 'rgba(13,13,9,0.34)' }} />
        <DialogPrimitive.Content
          className="gio-dialog fixed left-1/2 top-1/2 z-[70] flex flex-col overflow-hidden bg-white [translate:-50%_-50%] focus:outline-none"
          style={{
            width: 640,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100dvh - 48px)',
            borderRadius: 18,
            boxShadow: '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
          }}
        >
          <header className="flex shrink-0 items-start gap-[14px]" style={{ padding: '22px 24px 18px', borderBottom: '1px solid #F1F0EC' }}>
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#EFEEEA] bg-[#FAFAF7]">
              {logo}
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="mt-0.5 line-clamp-2 font-poppins text-[17px] font-semibold leading-snug text-text-primary">
                {name}
              </DialogPrimitive.Title>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-inter text-[12px] text-text-tertiary">{CATEGORY_LABELS[category]}</span>
                <StateLabel state={state} />
              </div>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: 24 }}>
            {images && images.length > 0 && (
              <img src={images[0]} alt="" className="mb-5 max-h-[220px] w-full rounded-xl bg-[#FAFAF7] object-contain" />
            )}
            {detailContent ? (
              <div className="space-y-3 font-inter text-[13px] leading-[1.6] text-text-secondary">{detailContent}</div>
            ) : (
              <DialogPrimitive.Description className="font-inter text-[13px] leading-[1.6] text-text-secondary">{description}</DialogPrimitive.Description>
            )}
          </div>
          <footer className="flex shrink-0 items-center gap-3" style={{ padding: '13px 24px', borderTop: '1px solid #F1F0EC', background: '#FAFAF7' }}>
            {onDisconnect && (
              <Button
                type="button"
                variant="danger"
                size="md"
                icon={Unplug}
                onClick={() => {
                  onOpenChange(false)
                  onDisconnect()
                }}
              >
                Disconnect
              </Button>
            )}
            <span className="flex-1" />
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="secondary" size="md">
                Close
              </Button>
            </DialogPrimitive.Close>
            {primary && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => {
                  onOpenChange(false)
                  primary.onClick()
                }}
              >
                {primary.label}
              </Button>
            )}
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
