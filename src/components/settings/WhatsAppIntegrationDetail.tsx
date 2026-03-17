import { useState, useEffect, useRef, useCallback } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { PLACEHOLDER_OPTIONS } from '@/utils/templateUtils'
import { convertPlaceholdersToHtml, convertHtmlToPlaceholders } from '@/utils/placeholderUtils'
import { cn } from '@/lib/utils'

const WHATSAPP_PLACEHOLDERS = PLACEHOLDER_OPTIONS.filter((p) =>
  ['candidate.first_name', 'candidate.name', 'sender.first_name', 'sender.name', 'organization.name', 'job.title'].includes(p.key)
)

export function WhatsAppIntegrationDetail() {
  const { automation, isLoading, isSaving, toggle, save } = useWorkspaceAutomation('whatsapp_integration')
  const isActive = automation?.is_active ?? false

  const [templateText, setTemplateText] = useState('')
  const [dirty, setDirty] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  useEffect(() => {
    if (automation?.body != null) {
      setTemplateText(automation.body)
      setDirty(false)
    }
  }, [automation?.body])

  // Sync templateText → contentEditable HTML
  useEffect(() => {
    if (editorRef.current) {
      const currentPlain = convertHtmlToPlaceholders(editorRef.current.innerHTML)
      if (currentPlain !== templateText) {
        editorRef.current.innerHTML = convertPlaceholdersToHtml(templateText)
      }
    }
  }, [templateText])

  // Inject placeholder-badge styles if not already present
  useEffect(() => {
    if (!document.getElementById('placeholder-badge-styles')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'placeholder-badge-styles'
      styleEl.textContent = `
        .placeholder-badge {
          background-color: rgb(168 85 247 / 0.15);
          color: rgb(147 51 234);
          border: 1px solid rgb(168 85 247 / 0.4);
          border-radius: 9999px;
          padding: 1px 8px;
          font-size: 0.75rem;
          font-weight: 500;
          display: inline-block;
          line-height: 1.4;
          white-space: nowrap;
          user-select: all;
          vertical-align: baseline;
        }
        .dark .placeholder-badge {
          background-color: rgb(168 85 247 / 0.2);
          color: rgb(192 132 252);
          border-color: rgb(168 85 247 / 0.5);
        }
        .placeholder-badge:hover {
          background-color: rgb(168 85 247 / 0.25);
          border-color: rgb(168 85 247 / 0.6);
        }
      `
      document.head.appendChild(styleEl)
    }
  }, [])

  const saveCursorPosition = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
  }, [])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      // First convert badge spans back to {{placeholder}} tokens
      let plain = convertHtmlToPlaceholders(editorRef.current.innerHTML)
      // Strip any remaining HTML tags the browser injected (font, span style, etc.)
      // but preserve line breaks from <br>, <div>, <p>
      plain = plain
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(div|p)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      setTemplateText(plain)
      setDirty(true)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection()
    if (!selection || !selection.anchorNode) return

    const anchorNode = selection.anchorNode
    const anchorElement = anchorNode.parentElement
    const isBadge = anchorElement?.classList.contains('placeholder-badge')

    // If cursor is inside a badge, only allow Backspace/Delete to remove it entirely
    if (isBadge) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        anchorElement.remove()
        handleInput()
      } else {
        e.preventDefault()
      }
      return
    }

    const offset = selection.anchorOffset
    const nextSibling = anchorNode.nextSibling as HTMLElement
    const prevSibling = anchorNode.previousSibling as HTMLElement

    // Only delete the badge if cursor is at the very edge of the text node next to it
    if (e.key === 'Backspace' && prevSibling?.classList?.contains('placeholder-badge')) {
      const isAtStart = offset === 0
      if (isAtStart) {
        e.preventDefault()
        prevSibling.remove()
        handleInput()
      }
      // Otherwise let the browser handle normal character deletion
    } else if (e.key === 'Delete' && nextSibling?.classList?.contains('placeholder-badge')) {
      const textLen = anchorNode.textContent?.length ?? 0
      const isAtEnd = offset >= textLen
      if (isAtEnd) {
        e.preventDefault()
        nextSibling.remove()
        handleInput()
      }
      // Otherwise let the browser handle normal character deletion
    }
  }, [handleInput])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }, [])

  const insertPlaceholder = useCallback((key: string) => {
    if (!editorRef.current) return

    const badgeHtml = `<span class="placeholder-badge" contenteditable="false" data-placeholder="${key}">{{${key}}}</span>\u00A0`

    editorRef.current.focus()

    // Restore saved cursor position if available
    if (savedRangeRef.current && editorRef.current.contains(savedRangeRef.current.startContainer)) {
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(savedRangeRef.current)
      }
    }

    document.execCommand('insertHTML', false, badgeHtml)
    handleInput()
  }, [handleInput])

  const handleSaveTemplate = async () => {
    try {
      await save({ body: templateText })
      setDirty(false)
      toast.success('WhatsApp message template saved')
    } catch {
      // error toast handled by hook
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold font-poppins text-foreground">WhatsApp Shortcuts</h3>
        <p className="text-sm text-muted-foreground font-poppins mt-1">
          Enable WhatsApp shortcut actions across GoGio. Recruiters will be able to open candidate phone numbers directly in WhatsApp.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <p className="text-sm font-medium font-poppins text-foreground">Enable WhatsApp shortcuts</p>
          <p className="text-xs text-muted-foreground font-poppins mt-0.5">
            Show WhatsApp quick-action buttons next to candidate phone numbers
          </p>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => toggle(checked)}
            disabled={isSaving}
          />
        )}
      </div>

      {isActive && (
        <div className="space-y-3 rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-medium font-poppins text-foreground">Pre-filled message template</p>
            <p className="text-xs text-muted-foreground font-poppins mt-0.5">
              This message will be pre-filled in WhatsApp the first time a recruiter contacts a candidate for a specific job. After the first message, subsequent clicks open WhatsApp without a template.
            </p>
          </div>

          <div
            ref={editorRef}
            contentEditable={!isSaving}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={saveCursorPosition}
            onMouseUp={saveCursorPosition}
            onKeyUp={saveCursorPosition}
            data-placeholder="Hi {{candidate.first_name}}, this is {{sender.first_name}} from {{organization.name}}. I'd like to discuss the {{job.title}} position with you."
            suppressContentEditableWarning
            className={cn(
              "min-h-[100px] w-full rounded-lg border bg-surface-primary px-3 py-2 text-sm ring-offset-background transition-all duration-200 ease-out shadow-[var(--shadow-xs)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-2 focus-visible:border-virgilio-purple hover:shadow-[var(--shadow-button)] hover:-translate-y-0.5",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
              "border-virgilio-border hover:border-virgilio-purple/50",
              "whitespace-pre-wrap break-words",
              "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-text-tertiary [&:empty]:before:pointer-events-none [&:empty]:before:block",
              isSaving && "opacity-50 pointer-events-none"
            )}
          />

          <div className="flex flex-wrap gap-1.5">
            {WHATSAPP_PLACEHOLDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="inline-flex items-center rounded-full border border-purple-500/40 bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-500/25 hover:border-purple-500/60 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertPlaceholder(p.key)}
              >
                {`{{${p.key}}}`}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveTemplate}
              disabled={!dirty || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              Save template
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
