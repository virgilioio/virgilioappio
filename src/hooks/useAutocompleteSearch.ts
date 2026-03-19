import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface AutocompleteSuggestion {
  canonical: string
  category: string | null
  matchType: string
}

type TableName = 'standard_job_titles' | 'standard_skills'

const cache = new Map<string, AutocompleteSuggestion[]>()

export function useAutocompleteSearch(
  table: TableName,
  searchTerm: string,
  excludeValues: string[] = []
) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      return
    }

    const cacheKey = `${table}:${trimmed.toLowerCase()}`
    const cached = cache.get(cacheKey)
    if (cached) {
      setSuggestions(cached.filter(s => !excludeValues.includes(s.canonical)))
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('search_standard_terms', {
        p_table: table,
        p_query: trimmed,
        p_limit: 10,
      })

      if (error) throw error

      const results: AutocompleteSuggestion[] = (data || []).map((row: any) => ({
        canonical: row.canonical,
        category: row.category,
        matchType: row.match_type,
      }))

      cache.set(cacheKey, results)
      setSuggestions(results.filter(s => !excludeValues.includes(s.canonical)))
    } catch (err) {
      console.error('Autocomplete search error:', err)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [table, excludeValues])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    
    const trimmed = searchTerm.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(() => search(trimmed), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchTerm, search])

  return { suggestions, isLoading }
}
