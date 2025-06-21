
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveCursorPosition, restoreCursorPosition, type CursorPosition } from '@/lib/cursorUtils'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Start typing...", 
  className,
  minHeight = "200px"
}: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const cursorPositionRef = useRef<CursorPosition | null>(null)
  const isUpdatingRef = useRef(false)

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
  }, [])

  const handleCommand = useCallback((command: string, value?: string) => {
    if (!editorRef.current) return
    
    // Save cursor position before command
    cursorPositionRef.current = saveCursorPosition(editorRef.current)
    
    execCommand(command, value)
    
    // Get the updated content and trigger onChange
    const newContent = editorRef.current.innerHTML
    onChange(newContent)
  }, [execCommand, onChange])

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isUpdatingRef.current) return
    
    const target = e.target as HTMLDivElement
    const newContent = target.innerHTML
    
    // Save cursor position before triggering onChange
    cursorPositionRef.current = saveCursorPosition(target)
    
    onChange(newContent)
  }, [onChange])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])

  // Restore cursor position after content updates
  useEffect(() => {
    if (editorRef.current && cursorPositionRef.current && !isUpdatingRef.current) {
      isUpdatingRef.current = true
      
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (editorRef.current && cursorPositionRef.current) {
          restoreCursorPosition(editorRef.current, cursorPositionRef.current)
        }
        isUpdatingRef.current = false
      }, 0)
    }
  }, [value])

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
          dangerouslySetInnerHTML={{ __html: value }}
          className={cn(
            "p-3 text-sm ring-offset-background relative z-20",
            "focus-visible:outline-none",
            "prose prose-sm max-w-none",
            "[&_ul]:list-disc [&_ul]:pl-6",
            "[&_ol]:list-decimal [&_ol]:pl-6",
            "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
          )}
          style={{ minHeight }}
        />
      </div>
    </div>
  )
}
