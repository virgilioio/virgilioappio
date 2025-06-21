
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Building,
  Globe,
  Settings,
  Table
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgreementPlaceholders } from '@/hooks/useAgreementPlaceholders'
import { saveTextCursorPosition, restoreTextCursorPosition, type TextCursorPosition } from '@/lib/cursorUtils'

interface AgreementRichTextEditorProps {
  value: string
  onChange: (value: string) => void
  selectedCountryId?: string
  placeholder?: string
  className?: string
  minHeight?: string
}

export function AgreementRichTextEditor({ 
  value, 
  onChange, 
  selectedCountryId,
  placeholder = "Start typing your agreement...", 
  className,
  minHeight = "300px"
}: AgreementRichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const cursorPositionRef = useRef<TextCursorPosition | null>(null)
  const lastContentRef = useRef<string>(value)
  const isUpdatingRef = useRef(false)
  const { placeholders, getPlaceholdersByCategory } = useAgreementPlaceholders(selectedCountryId)

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

  const insertPlaceholder = useCallback((placeholderKey: string) => {
    const editor = editorRef.current
    if (editor) {
      editor.focus()
      
      // Save cursor position
      cursorPositionRef.current = saveTextCursorPosition(editor)
      
      // Insert the placeholder at cursor position
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        
        const placeholderSpan = document.createElement('span')
        placeholderSpan.className = 'bg-blue-100 text-blue-800 px-1 rounded font-mono text-sm'
        placeholderSpan.textContent = placeholderKey
        
        range.insertNode(placeholderSpan)
        range.setStartAfter(placeholderSpan)
        range.setEndAfter(placeholderSpan)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        // Fallback: append to end
        const placeholderSpan = document.createElement('span')
        placeholderSpan.className = 'bg-blue-100 text-blue-800 px-1 rounded font-mono text-sm'
        placeholderSpan.textContent = placeholderKey
        editor.appendChild(placeholderSpan)
      }
      
      updateContent(editor.innerHTML)
    }
  }, [updateContent])

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
    if (editorRef.current && value !== lastContentRef.current && !isUpdatingRef.current) {
      isUpdatingRef.current = true
      
      // Save current cursor position
      const savedPosition = saveTextCursorPosition(editorRef.current)
      
      // Update content
      editorRef.current.innerHTML = value
      lastContentRef.current = value
      
      // Restore cursor position after DOM update
      setTimeout(() => {
        if (editorRef.current && savedPosition) {
          restoreTextCursorPosition(editorRef.current, savedPosition)
        }
        isUpdatingRef.current = false
      }, 0)
    }
  }, [value])

  const renderPlaceholderSection = (title: string, icon: React.ReactNode, placeholders: any[]) => {
    if (placeholders.length === 0) return null

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </div>
        <div className="space-y-1">
          {placeholders.map((placeholder) => (
            <Button
              key={placeholder.key}
              variant="ghost"
              size="sm"
              className="w-full justify-start h-auto p-2 text-left"
              onClick={() => insertPlaceholder(placeholder.key)}
            >
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-blue-600">{placeholder.key}</span>
                </div>
                <span className="text-xs text-muted-foreground">{placeholder.label}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "border rounded-md bg-background transition-all duration-default",
      isFocused && "ring-2 ring-accent ring-offset-1",
      className
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-1 p-2 border-b bg-muted/30">
        <div className="flex items-center gap-1">
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
        </div>

        {/* Placeholder Inserter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Insert Placeholder
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <ScrollArea className="h-96">
              <div className="space-y-4 p-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Plus className="h-4 w-4" />
                  Available Placeholders
                </div>
                
                {renderPlaceholderSection(
                  "System Fields", 
                  <Settings className="h-3.5 w-3.5" />, 
                  getPlaceholdersByCategory('system')
                )}
                
                {renderPlaceholderSection(
                  "Organization Fields", 
                  <Building className="h-3.5 w-3.5" />, 
                  getPlaceholdersByCategory('organization')
                )}
                
                {selectedCountryId && renderPlaceholderSection(
                  "Country-Specific Fields", 
                  <Globe className="h-3.5 w-3.5" />, 
                  getPlaceholdersByCategory('country_field')
                )}
                
                {!selectedCountryId && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Select a country to see country-specific placeholders
                  </div>
                )}
              </div>
            </ScrollArea>
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
            "[&_.bg-blue-100]:bg-blue-100 [&_.text-blue-800]:text-blue-800",
            "[&_table]:border-collapse [&_table]:w-full [&_table]:my-4",
            "[&_td]:border [&_td]:border-gray-300 [&_td]:p-2",
            "[&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-50"
          )}
          style={{ minHeight }}
        />
      </div>
    </div>
  )
}
