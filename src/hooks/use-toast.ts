import * as React from "react"
import { toast as sonner, type ExternalToast } from "sonner"

/**
 * Motion & Feel (CLAUDE.md, Allan 2026-10-09): Gio ATS has one toast system, Sonner,
 * mounted once in App.tsx (bottom-left, one at a time, 6s, pauses on hover and while
 * the tab is hidden). This module keeps the old Radix `useToast()` / `toast({...})` API
 * so the 150+ calling files don't change: every call is forwarded to Sonner.
 *
 *   variant "destructive" → toast.error · "success" → toast.success · "warning" → toast.warning
 *   action: an element with onClick (the Undo buttons) → Sonner's action button
 */

type ToastVariant = "default" | "destructive" | "success" | "warning" | string | null | undefined

export interface Toast {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
  /** An element with an onClick, usually an Undo button. Its text becomes the label. */
  action?: React.ReactNode
  duration?: number
  /** Accepted for compatibility; Sonner styles every toast the same way. */
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export interface ToastHandle {
  id: string
  dismiss: () => void
  update: (props: Toast) => void
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children)
  return ""
}

/** Turn a Radix-style action element into Sonner's { label, onClick }. */
function toSonnerAction(action: React.ReactNode): ExternalToast["action"] | undefined {
  if (!React.isValidElement(action)) return undefined
  const props = action.props as {
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    altText?: string
    children?: React.ReactNode
  }
  if (typeof props.onClick !== "function") return undefined
  const label = textOf(props.children).trim() || props.altText || "Undo"
  return { label, onClick: (e) => props.onClick!(e) }
}

function show(props: Toast, id?: string | number): string | number {
  const { title, description, variant, action, duration, onOpenChange } = props
  // A toast with only a description shows it as the message.
  const message = title ?? description ?? ""
  const opts: ExternalToast = {}
  if (title != null && description != null) opts.description = description
  if (duration != null) opts.duration = duration
  if (id != null) opts.id = id
  const sonnerAction = toSonnerAction(action)
  if (sonnerAction) opts.action = sonnerAction
  if (onOpenChange) opts.onDismiss = () => onOpenChange(false)

  switch (variant) {
    case "destructive":
      return sonner.error(message, opts)
    case "success":
      return sonner.success(message, opts)
    case "warning":
      return sonner.warning(message, opts)
    default:
      return sonner(message, opts)
  }
}

function toast(props: Toast): ToastHandle {
  const id = show(props)
  return {
    id: String(id),
    dismiss: () => sonner.dismiss(id),
    update: (next: Toast) => {
      show({ ...props, ...next }, id)
    },
  }
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => sonner.dismiss(toastId),
    /** The Radix toaster's list; always empty now that Sonner renders toasts. */
    toasts: [] as never[],
  }
}

export { useToast, toast }
