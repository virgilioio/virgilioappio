
import React, { useState, useCallback, useRef, useEffect } from 'react'
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

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  isExternalUpdate?: boolean
  onExternalUpdateComplete?: () => void
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Start typing...", 
  className,
  minHeight = "200px",
  isExternalUpdate = false,
  onExternalUpdateComplete
}: RichTextEditorProps) {
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
    
    // Restore cursor position after a brief delay
    setTimeout(() => {
      if (editorRef.current && cursorPositionRef.current) {
        restoreTextCursorPosition(editorRef.current, cursorPositionRef.current)
      }
    }, 0)
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
    
    updateContent(editorRef.current.innerHTML)
    setLinkUrl('')
    setLinkText('')
    setIsLinkPopoverOpen(false)
  }, [linkUrl, linkText, updateContent])

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isUpdatingRef.current) return
    
    const target = e.target as HTMLDivElement
    const newContent = target.innerHTML
    
    // Save cursor position before triggering onChange
    cursorPositionRef.current = saveTextCursorPosition(target)
    
    updateContent(newContent)
  }, [updateContent])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])

  // Update editor content when value prop changes from parent
  useEffect(() => {
    console.log('🔄 RichTextEditor useEffect triggered')
    console.log('📝 Value length:', value?.length || 0)
    console.log('🎯 lastContentRef equals value:', lastContentRef.current === value)
    console.log('🔀 isExternalUpdate prop:', isExternalUpdate)
    console.log('📍 isExternalUpdateRef.current:', isExternalUpdateRef.current)
    console.log('🔧 isUpdatingRef.current:', isUpdatingRef.current)
    
    // Set external update flag when prop indicates external update
    if (isExternalUpdate) {
      console.log('🎯 Setting isExternalUpdateRef to true')
      isExternalUpdateRef.current = true
    }
    
    // Only update innerHTML for external updates (template loading) and avoid internal updates (typing)
    if (editorRef.current && value && value !== lastContentRef.current && !isUpdatingRef.current) {
      console.log('🚀 Starting content update process')
      console.log('📋 Content to set:', value.substring(0, 200) + '...')
      
      isUpdatingRef.current = true
      
      // Save cursor position for external updates
      const savedPosition = saveTextCursorPosition(editorRef.current)
      
      // Update content
      editorRef.current.innerHTML = value
      lastContentRef.current = value
      console.log('📝 Content physically set to innerHTML')
      
      // Restore cursor position after DOM update for external updates
      setTimeout(() => {
        console.log('✅ Content set in editor, innerHTML length:', editorRef.current?.innerHTML?.length || 0)
        console.log('📊 Current editor content:', editorRef.current?.innerHTML?.substring(0, 200) + '...')
        
        if (editorRef.current && savedPosition && isExternalUpdateRef.current) {
          restoreTextCursorPosition(editorRef.current, savedPosition)
        }
        isUpdatingRef.current = false
        
        // Only reset flag and call callback if this was an external update
        if (isExternalUpdateRef.current) {
          console.log('🎯 Resetting external update flag and calling completion callback')
          isExternalUpdateRef.current = false
          
          // Call completion callback for external updates
          if (onExternalUpdateComplete) {
            onExternalUpdateComplete()
          }
        }
      }, 0)
    } else {
      console.log('❌ Skipping content update:', {
        hasEditor: !!editorRef.current,
        hasValue: !!value,
        contentChanged: value !== lastContentRef.current,
        notUpdating: !isUpdatingRef.current
      })
    }
  }, [value, isExternalUpdate])

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
          onFocus={handleFocus}
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
}
