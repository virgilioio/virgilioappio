
import React, { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table,
  Link
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveTextCursorPosition, restoreTextCursorPosition, type TextCursorPosition } from '@/lib/cursorUtils'
import { sanitizeHtml, sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { convertPlaceholdersToHtml, convertHtmlToPlaceholders } from '@/utils/placeholderUtils'

// Placeholder badge styles - injected into document head
const PLACEHOLDER_BADGE_STYLES = `
  .placeholder-badge {
    background-color: rgb(168 85 247 / 0.15);
    color: rgb(147 51 234);
    padding: 3px 10px;
    border-radius: 12px;
    font-weight: 500;
    font-size: 0.9em;
    display: inline-block;
    margin: 0 2px;
    user-select: none;
    cursor: default;
    border: 1px solid rgb(168 85 247 / 0.4);
    white-space: nowrap;
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
`;

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  isExternalUpdate?: boolean
  onExternalUpdateComplete?: () => void
}

export interface RichTextEditorHandle {
  insertPlaceholder: (placeholder: string) => void
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>((props, ref) => {
  const {
    value, 
    onChange, 
    placeholder = "Start typing...", 
    className,
    minHeight = "200px",
    isExternalUpdate = false,
    onExternalUpdateComplete
  } = props
  
  const [isFocused, setIsFocused] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const cursorPositionRef = useRef<TextCursorPosition | null>(null)
  const lastContentRef = useRef<string>(value)
  const isUpdatingRef = useRef(false)
  const isExternalUpdateRef = useRef(false)

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
  }, [])

  const updateContent = useCallback((newContent: string) => {
    if (!editorRef.current || isUpdatingRef.current) return
    
    // Only update if content actually changed
    if (newContent !== lastContentRef.current) {
      lastContentRef.current = newContent
      onChange(newContent)
    }
  }, [onChange])

  const handleCommand = useCallback((command: string, value?: string) => {
    if (!editorRef.current) return
    
    // Save cursor position before command
    cursorPositionRef.current = saveTextCursorPosition(editorRef.current)
    
    execCommand(command, value)
    
    // Get the updated content and trigger onChange
    const newContent = editorRef.current.innerHTML
    updateContent(newContent)
    
    // Restore cursor position after DOM update using rAF
    requestAnimationFrame(() => {
      try {
        if (editorRef.current && cursorPositionRef.current) {
          restoreTextCursorPosition(editorRef.current, cursorPositionRef.current)
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('Failed to restore cursor position:', error)
        }
      }
    })
  }, [execCommand, updateContent])

  const insertTable = useCallback(() => {
    if (!editorRef.current) return
    
    editorRef.current.focus()
    
    // Save cursor position
    cursorPositionRef.current = saveTextCursorPosition(editorRef.current)
    
    // Create a basic 3x3 table
    const tableHTML = `
      <table style="border-collapse: collapse; width: 100%; margin: 10px 0;">
        <tbody>
          <tr>
            <td style="border: 1px solid #ccc; padding: 8px;">Cell 1</td>
            <td style="border: 1px solid #ccc; padding: 8px;">Cell 2</td>
            <td style="border: 1px solid #ccc; padding: 8px;">Cell 3</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ccc; padding: 8px;">Cell 4</td>
            <td style="border: 1px solid #ccc; padding: 8px;">Cell 5</td>
            <td style="border: 1px solid #ccc; padding: 8px;">Cell 6</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ccc; padding: 8px;">Cell 7</td>
            <td style="border: 1px solid #ccc; padding: 8px;">Cell 8</td>
            <td style="border: 1px solid #ccc; padding: 8px;">Cell 9</td>
          </tr>
        </tbody>
      </table>
    `
    
    // Insert the table at cursor position
    try {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        
        const tableContainer = document.createElement('div')
        tableContainer.innerHTML = tableHTML
        const table = tableContainer.firstElementChild
        
        if (table) {
          range.insertNode(table)
          range.setStartAfter(table)
          range.setEndAfter(table)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      } else {
        // Fallback: append to end
        editorRef.current.innerHTML += tableHTML
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug('Failed to insert table at cursor:', error)
      }
      // Fallback: append to end
      editorRef.current.innerHTML += tableHTML
    }
    
    updateContent(editorRef.current.innerHTML)
  }, [updateContent])

  const insertLink = useCallback(() => {
    if (!editorRef.current || !linkUrl) return
    
    editorRef.current.focus()
    
    // Save cursor position
    cursorPositionRef.current = saveTextCursorPosition(editorRef.current)
    
    const displayText = linkText || linkUrl
    const linkHTML = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${displayText}</a>`
    
    // Insert the link at cursor position
    try {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        
        const linkContainer = document.createElement('div')
        linkContainer.innerHTML = linkHTML
        const link = linkContainer.firstElementChild
        
        if (link) {
          range.insertNode(link)
          range.setStartAfter(link)
          range.setEndAfter(link)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      } else {
        // Fallback: append to end
        editorRef.current.innerHTML += linkHTML
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug('Failed to insert link at cursor:', error)
      }
      // Fallback: append to end
      editorRef.current.innerHTML += linkHTML
    }
    
    updateContent(editorRef.current.innerHTML)
    setLinkUrl('')
    setLinkText('')
    setIsLinkPopoverOpen(false)
  }, [linkUrl, linkText, updateContent])

  const processPlaceholders = useCallback((html: string): string => {
    return convertPlaceholdersToHtml(html)
  }, [])

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isUpdatingRef.current) return
    
    const target = e.target as HTMLDivElement
    let newContent = target.innerHTML
    
    // STEP 1: First normalize - convert any existing badge HTML back to plain {{placeholder}}
    const normalized = convertHtmlToPlaceholders(newContent)
    
    // STEP 2: Then re-process - convert plain {{placeholder}} to badge HTML
    const processed = convertPlaceholdersToHtml(normalized)
    
    if (processed !== newContent) {
      // Save cursor position
      cursorPositionRef.current = saveTextCursorPosition(target)
      target.innerHTML = processed
      newContent = processed
      
      // Restore cursor position
      requestAnimationFrame(() => {
        try {
          if (cursorPositionRef.current) {
            restoreTextCursorPosition(target, cursorPositionRef.current)
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug('Failed to restore cursor after processing:', error)
          }
        }
      })
    }
    
    // Save cursor position before triggering onChange
    cursorPositionRef.current = saveTextCursorPosition(target)
    
    updateContent(newContent)
  }, [updateContent])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()

    const clipboardData = e.clipboardData
    const htmlData = clipboardData.getData('text/html')
    const textData = clipboardData.getData('text/plain')

    let contentToInsert = ''

    if (htmlData) {
      // Sanitize HTML content through editor sanitizer (removes scripts, iframes)
      contentToInsert = sanitizeHtmlForEditor(htmlData)
    } else if (textData) {
      // Convert plain text to HTML paragraphs
      const lines = textData.split(/\n+/).filter(line => line.trim())
      contentToInsert = lines.map(line => `<p>${line.trim()}</p>`).join('')
    }

    if (contentToInsert && editorRef.current) {
      // Save cursor position
      cursorPositionRef.current = saveTextCursorPosition(editorRef.current)

      // Insert the normalized content at cursor position
      try {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()

          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = contentToInsert

          // Insert each node from the temp div
          const nodes = Array.from(tempDiv.childNodes)
          nodes.forEach(node => {
            const toInsert = node.nodeType === Node.TEXT_NODE
              ? document.createTextNode(node.textContent || '')
              : (node.cloneNode(true) as Node)
            range.insertNode(toInsert)
            // Move caret after inserted node
            range.setStartAfter(toInsert)
            range.collapse(true)
          })

          selection.removeAllRanges()
          selection.addRange(range)
        } else {
          // Fallback: append to end
          editorRef.current.innerHTML += contentToInsert
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('Failed to paste at cursor position:', error)
        }
        // Fallback: append to end
        editorRef.current.innerHTML += contentToInsert
      }

      // Process placeholders and update content
      const processed = processPlaceholders(editorRef.current.innerHTML)
      editorRef.current.innerHTML = processed
      updateContent(processed)
    }
  }, [updateContent, processPlaceholders])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])

  // Handle keyboard events to prevent editing placeholders
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection()
    if (!selection || !selection.anchorNode) return
    
    // Check if cursor is next to a placeholder badge
    const anchorElement = selection.anchorNode.parentElement
    const isBadge = anchorElement?.classList.contains('placeholder-badge')
    const nextSibling = selection.anchorNode.nextSibling as HTMLElement
    const prevSibling = selection.anchorNode.previousSibling as HTMLElement
    
    // Prevent backspace/delete from partially deleting badges
    if (e.key === 'Backspace' && prevSibling?.classList?.contains('placeholder-badge')) {
      e.preventDefault()
      prevSibling.remove()
      if (editorRef.current) updateContent(editorRef.current.innerHTML)
    } else if (e.key === 'Delete' && nextSibling?.classList?.contains('placeholder-badge')) {
      e.preventDefault()
      nextSibling.remove()
      if (editorRef.current) updateContent(editorRef.current.innerHTML)
    } else if (isBadge) {
      // Prevent typing inside badges
      e.preventDefault()
    }
  }, [updateContent])

  const insertPlaceholder = useCallback((placeholder: string) => {
    if (!editorRef.current) return
    
    editorRef.current.focus()
    const badgeHtml = convertPlaceholdersToHtml(placeholder)
    
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = badgeHtml
      const badge = tempDiv.firstElementChild
      
      if (badge) {
        range.insertNode(badge)
        // Add space after badge
        const space = document.createTextNode(' ')
        range.insertNode(space)
        range.setStartAfter(space)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    } else {
      editorRef.current.innerHTML += badgeHtml + ' '
    }
    
    updateContent(editorRef.current.innerHTML)
  }, [updateContent])

  useImperativeHandle(ref, () => ({
    insertPlaceholder
  }))

  // Inject placeholder badge styles on mount
  useEffect(() => {
    if (!document.getElementById('placeholder-badge-styles')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'placeholder-badge-styles'
      styleEl.textContent = PLACEHOLDER_BADGE_STYLES
      document.head.appendChild(styleEl)
    }
  }, [])

  // Update editor content when value prop changes from parent
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('RichTextEditor: value changed', { 
        hasValue: !!value, 
        length: value?.length || 0,
        isExternalUpdate 
      })
    }
    
    // Set external update flag when prop indicates external update
    if (isExternalUpdate && !isExternalUpdateRef.current) {
      isExternalUpdateRef.current = true
    }
    
    // Determine if content update is needed
    const editorEmpty = !!editorRef.current && (editorRef.current.innerHTML.trim() === '')
    const shouldUpdateContent = editorRef.current && 
                               value && 
                               value.trim() !== '' &&
                               (isExternalUpdate || value !== lastContentRef.current || editorEmpty) && 
                               !isUpdatingRef.current
    
    if (!shouldUpdateContent) {
      return
    }
    
    // Defensive: Skip DOM update if content hasn't actually changed
    const sanitizedValue = sanitizeHtmlForEditor(value)
    if (editorRef.current.innerHTML === sanitizedValue) {
      if (import.meta.env.DEV) {
        console.debug('RichTextEditor: Skipping DOM update - content unchanged')
      }
      return
    }
    
    // Use requestAnimationFrame to debounce external updates
    isUpdatingRef.current = true
    const savedPosition = isExternalUpdateRef.current ? saveTextCursorPosition(editorRef.current) : null
    
    requestAnimationFrame(() => {
      if (!editorRef.current) {
        isUpdatingRef.current = false
        return
      }
      
      // Update DOM with processed placeholders
      const processedValue = processPlaceholders(sanitizedValue)
      editorRef.current.innerHTML = processedValue
      lastContentRef.current = value
      
      // Restore cursor position after DOM update
      requestAnimationFrame(() => {
        try {
          if (editorRef.current && savedPosition && isExternalUpdateRef.current) {
            restoreTextCursorPosition(editorRef.current, savedPosition)
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug('Failed to restore cursor after external update:', error)
          }
        }
        
        isUpdatingRef.current = false
        
        // Reset external update flag and call callback
        if (isExternalUpdateRef.current) {
          isExternalUpdateRef.current = false
          onExternalUpdateComplete?.()
        }
      })
    })
  }, [value, isExternalUpdate, onExternalUpdateComplete, processPlaceholders])

  return (
    <div className={cn(
      "border rounded-md bg-background transition-all duration-default",
      isFocused && "ring-2 ring-accent ring-offset-1",
      className
    )}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
        <Toggle
          size="sm"
          onPressedChange={() => handleCommand('bold')}
          className="h-8 w-8"
        >
          <Bold className="h-3.5 w-3.5" />
        </Toggle>
        
        <Toggle
          size="sm"
          onPressedChange={() => handleCommand('italic')}
          className="h-8 w-8"
        >
          <Italic className="h-3.5 w-3.5" />
        </Toggle>
        
        <Toggle
          size="sm"
          onPressedChange={() => handleCommand('underline')}
          className="h-8 w-8"
        >
          <Underline className="h-3.5 w-3.5" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Toggle
          size="sm"
          onPressedChange={() => handleCommand('insertUnorderedList')}
          className="h-8 w-8"
        >
          <List className="h-3.5 w-3.5" />
        </Toggle>
        
        <Toggle
          size="sm"
          onPressedChange={() => handleCommand('insertOrderedList')}
          className="h-8 w-8"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Toggle
          size="sm"
          onPressedChange={() => handleCommand('justifyLeft')}
          className="h-8 w-8"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </Toggle>
        
        <Toggle
          size="sm"
          onPressedChange={() => handleCommand('justifyCenter')}
          className="h-8 w-8"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </Toggle>
        
        <Toggle
          size="sm"
          onPressedChange={() => handleCommand('justifyRight')}
          className="h-8 w-8"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          variant="ghost"
          size="sm"
          onClick={insertTable}
          className="h-8 w-8 p-0"
        >
          <Table className="h-3.5 w-3.5" />
        </Button>

        <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Link className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Text (optional)</label>
                <Input
                  placeholder="Link text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={insertLink} disabled={!linkUrl}>
                  Insert Link
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsLinkPopoverOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Editor Content */}
      <div className="relative">
        {!value && (
          <div 
            className="absolute top-3 left-3 text-muted-foreground text-sm pointer-events-none z-10"
            style={{ minHeight }}
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          suppressContentEditableWarning={true}
          className={cn(
            "p-3 text-sm ring-offset-background relative z-20",
            "focus-visible:outline-none",
            "prose prose-sm max-w-none",
            "[&_ul]:list-disc [&_ul]:pl-6",
            "[&_ol]:list-decimal [&_ol]:pl-6",
            "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
            "[&_table]:border-collapse [&_table]:w-full [&_table]:my-4",
            "[&_td]:border [&_td]:border-gray-300 [&_td]:p-2",
            "[&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-50",
            "[&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800"
          )}
          style={{ minHeight }}
        />
      </div>
    </div>
  )
})

RichTextEditor.displayName = 'RichTextEditor'
