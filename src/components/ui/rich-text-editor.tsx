
import React, { useState, useCallback } from 'react'
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

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
  }, [])

  const handleCommand = useCallback((command: string, value?: string) => {
    execCommand(command, value)
    // Trigger onChange by getting the content
    const editor = document.getElementById('rich-text-content')
    if (editor) {
      onChange(editor.innerHTML)
    }
  }, [execCommand, onChange])

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    onChange(target.innerHTML)
  }, [onChange])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])

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
      <div
        id="rich-text-content"
        contentEditable
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        dangerouslySetInnerHTML={{ __html: value }}
        className={cn(
          "p-3 text-sm ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none",
          "prose prose-sm max-w-none",
          "[&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:list-decimal [&_ol]:pl-6",
          "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
        )}
        style={{ minHeight }}
        data-placeholder={placeholder}
      />
      
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
