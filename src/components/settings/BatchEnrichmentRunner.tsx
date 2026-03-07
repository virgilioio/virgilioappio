import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Play, Square, Search, CheckCircle2, AlertCircle, Zap } from 'lucide-react'

interface BatchResult {
  total: number
  queued: number
  skipped: number
  failed: number
  results: Array<{ id: string; name: string; status: string; error?: string }>
}

export function BatchEnrichmentRunner() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'running' | 'stopping' | 'done'>('idle')
  const [totalRemaining, setTotalRemaining] = useState<number | null>(null)
  const [processed, setProcessed] = useState(0)
  const [stats, setStats] = useState({ queued: 0, skipped: 0, failed: 0 })
  const [batchCount, setBatchCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)

  const BATCH_SIZE = 10
  const BATCH_DELAY_MS = 8000
  const MAX_RETRIES = 2

  const invokeBatch = async (dryRun: boolean, limit: number = BATCH_SIZE): Promise<BatchResult | { dry_run: true; count: number } | null> => {
    const { data, error } = await supabase.functions.invoke('batch-re-enrich', {
      body: dryRun ? { dry_run: true } : { limit },
    })
    if (error) throw new Error(error.message || 'Failed to invoke batch-re-enrich')
    return data
  }

  const invokeBatchWithRetry = async (limit: number): Promise<BatchResult | null> => {
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await invokeBatch(false, limit) as BatchResult | null
      } catch (err: any) {
        lastError = err
        if (attempt < MAX_RETRIES) {
          const delay = 10000 * (attempt + 1) // 10s, 20s
          console.log(`[BatchEnrichment] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    throw lastError
  }

  const handleCheck = async () => {
    setStatus('checking')
    setError(null)
    try {
      const result = await invokeBatch(true)
      if (result && 'count' in result) {
        setTotalRemaining(result.count)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  const handleStart = useCallback(async () => {
    stopRef.current = false
    setStatus('running')
    setProcessed(0)
    setStats({ queued: 0, skipped: 0, failed: 0 })
    setBatchCount(0)
    setError(null)

    // Pause real-time refreshes across the app
    ;(window as any).__enrichmentActive = true

    try {
      let hasMore = true
      while (hasMore && !stopRef.current) {
        const result = await invokeBatchWithRetry(BATCH_SIZE)
        
        if (!result || result.total === 0) {
          hasMore = false
          break
        }

        setBatchCount(prev => prev + 1)
        setProcessed(prev => prev + result.total)
        setStats(prev => ({
          queued: prev.queued + result.queued,
          skipped: prev.skipped + result.skipped,
          failed: prev.failed + result.failed,
        }))

        // If we got fewer than requested, we're done
        if (result.total < BATCH_SIZE) {
          hasMore = false
          break
        }

        // Wait between batches to avoid rate limits
        if (!stopRef.current) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
        }
      }

      setStatus('done')
    } catch (err: any) {
      setError(err.message)
      setStatus('idle')
    } finally {
      ;(window as any).__enrichmentActive = false
    }
  }, [])

  const handleStop = () => {
    stopRef.current = true
    setStatus('stopping')
  }

  const progressPercent = totalRemaining && totalRemaining > 0
    ? Math.min(100, Math.round((processed / totalRemaining) * 100))
    : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle>Batch AI Enrichment</CardTitle>
        </div>
        <CardDescription>
          Enrich all candidates with missing structured data. Processes 10 candidates at a time with automatic pacing and retry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={handleCheck}
            disabled={status === 'checking' || status === 'running'}
          >
            {status === 'checking' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Check Remaining
          </Button>

          {status !== 'running' && status !== 'stopping' ? (
            <Button onClick={handleStart} disabled={status === 'checking'}>
              <Play className="h-4 w-4 mr-2" />
              Start Enrichment
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleStop}
              disabled={status === 'stopping'}
            >
              <Square className="h-4 w-4 mr-2" />
              {status === 'stopping' ? 'Stopping...' : 'Stop'}
            </Button>
          )}

          {totalRemaining !== null && status === 'idle' && (
            <Badge variant="secondary" className="text-sm">
              {totalRemaining} candidates need enrichment
            </Badge>
          )}
        </div>

        {/* Progress */}
        {(status === 'running' || status === 'stopping' || status === 'done') && (
          <div className="space-y-3">
            <Progress value={progressPercent} className="h-3" />
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {status === 'running' && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing batch {batchCount + 1}...
                  </span>
                )}
                {status === 'stopping' && 'Stopping after current batch...'}
                {status === 'done' && (
                  <span className="flex items-center gap-1 text-primary">
                    <CheckCircle2 className="h-3 w-3" />
                    Complete
                  </span>
                )}
              </span>
              <span>{processed} processed{totalRemaining ? ` / ~${totalRemaining} total` : ''}</span>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <span className="text-primary">✓ Queued: {stats.queued}</span>
              <span className="text-muted-foreground">⊘ Skipped: {stats.skipped}</span>
              <span className="text-destructive">✗ Failed: {stats.failed}</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
