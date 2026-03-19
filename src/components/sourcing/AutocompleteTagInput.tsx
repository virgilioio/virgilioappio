import { useState, useRef, useEffect } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAutocompleteSearch } from '@/hooks/useAutocompleteSearch'

interface AutocompleteTagInputProps {
  placeholder: string
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  badgeVariant?: 'secondary' | 'pastel-purple' | 'keyword-match' | 'pastel-orange'
  table: 'standard_job_titles' | 'standard_skills'
}

export function AutocompleteTagInput({
  placeholder,
  tags,
  onAdd,
  onRemove,
  badgeVariant = 'secondary',
  table,
}: AutocompleteTagInputProps) {
  const [value, setValue] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { suggestions, isLoading } = useAutocompleteSearch(table, value, tags)

  useEffect(() => {
    setHighlightIndex(-1)
    setShowDropdown(value.trim().length >= 2)
  }, [value, suggestions])

  const addTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      onAdd(tag.trim())
    }
    setValue('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        addTag(suggestions[highlightIndex].canonical)
      } else if (value.trim()) {
        addTag(value.trim())
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <div className="flex gap-1.5">
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (value.trim().length >= 2) setShowDropdown(true) }}
            className="h-7 text-xs flex-1"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => addTag(value)}
            className="h-7 w-7 p-0 hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {showDropdown && (suggestions.length > 0 || isLoading) && (
          <div
            ref={dropdownRef}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto"
          >
            {isLoading && suggestions.length === 0 ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              suggestions.map((s, idx) => (
                <button
                  key={s.canonical}
                  className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent transition-colors flex items-center justify-between gap-2 ${
                    idx === highlightIndex ? 'bg-accent' : ''
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); addTag(s.canonical) }}
                  onMouseEnter={() => setHighlightIndex(idx)}
                >
                  <span className="truncate text-foreground">{s.canonical}</span>
                  {s.category && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{s.category}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <Badge key={tag} variant={badgeVariant} className="text-[10px] h-5 gap-0.5 pr-1">
              {tag}
              <button onClick={() => onRemove(tag)} className="hover:bg-destructive/10 rounded-sm">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
