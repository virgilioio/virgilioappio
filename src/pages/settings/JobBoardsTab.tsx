import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'
import { useJobBoardIntegration } from '@/hooks/useJobBoardIntegration'
import { Copy, Info, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { copyToClipboard } from '@/utils/clipboard'
import { useToast } from '@/hooks/use-toast'

interface FeedTestResult {
  status: 'success' | 'error'
  jobCount?: number
  message?: string
}

export function JobBoardsTab() {
  const { toast } = useToast()
  const { integration, isLoading, toggleIntegration, isEnabled } = useJobBoardIntegration('talent')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<FeedTestResult | null>(null)

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text)
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`
    })
  }

  const handleTestFeed = async () => {
    if (!integration?.feed_url) return
    
    setIsTesting(true)
    setTestResult(null)
    
    try {
      const response = await fetch(integration.feed_url)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setTestResult({
          status: 'error',
          message: errorData.error || `HTTP ${response.status}: ${response.statusText}`
        })
        return
      }
      
      const xmlText = await response.text()
      // Count <job> tags in the XML
      const jobMatches = xmlText.match(/<job>/g)
      const jobCount = jobMatches?.length || 0
      
      setTestResult({
        status: 'success',
        jobCount
      })
    } catch (error) {
      setTestResult({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to test feed'
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Job Boards" 
        subtitle="Connect to external job boards to expand your candidate reach"
      />

      {/* Talent.com Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">T</span>
              </div>
              <div>
                <CardTitle>Talent.com</CardTitle>
                <CardDescription>
                  Reach millions of job seekers across North America
                </CardDescription>
              </div>
            </div>
            <Switch 
              checked={isEnabled} 
              onCheckedChange={toggleIntegration}
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        
        {isEnabled && integration && (
          <CardContent className="space-y-4">
            {/* Test Feed Result */}
            {testResult && (
              <Alert variant={testResult.status === 'success' ? 'default' : 'destructive'}>
                {testResult.status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {testResult.status === 'success' 
                    ? `Feed working! ${testResult.jobCount} active job${testResult.jobCount !== 1 ? 's' : ''} found.`
                    : `Feed error: ${testResult.message}`
                  }
                  {testResult.status === 'success' && testResult.jobCount === 0 && (
                    <span className="block mt-1 text-amber-600">
                      No jobs are published to Talent.com yet. Enable "Publish to Talent.com" on your job postings.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Warning if no test has been done */}
            {!testResult && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Test your feed before sharing with Talent.com to ensure everything is working correctly.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-1">
              <FormField label="XML Feed URL">
                <div className="flex gap-2">
                  <Input 
                    value={integration.feed_url || ''} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopy(integration.feed_url || '', 'Feed URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={handleTestFeed}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Test Feed'
                    )}
                  </Button>
                </div>
              </FormField>
              <p className="text-xs text-muted-foreground">This feed contains all your active job postings</p>
            </div>
            
            <div className="space-y-1">
              <FormField label="Application Webhook URL">
                <div className="flex gap-2">
                  <Input 
                    value={integration.webhook_url || ''} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopy(integration.webhook_url || '', 'Webhook URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </FormField>
              <p className="text-xs text-muted-foreground">Talent.com will POST applications to this endpoint</p>
            </div>
            
            <div className="space-y-1">
              <FormField label="Screening Questions URL">
                <div className="flex gap-2">
                  <Input 
                    value={integration.questions_url || ''} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopy(integration.questions_url || '', 'Questions URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </FormField>
              <p className="text-xs text-muted-foreground">Dynamic screening questions per job posting</p>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">How it Works</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Enable job postings for Talent.com in each job's posting settings</li>
                <li>Talent.com automatically syncs your jobs from the feed URL</li>
                <li>Applications flow directly into your pipeline via the webhook</li>
                <li>AI automatically parses resumes and extracts candidate data</li>
              </ol>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Placeholder cards for future integrations */}
      <Card className="opacity-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <span className="text-lg font-bold text-muted-foreground">I</span>
            </div>
            <div>
              <CardTitle>Indeed</CardTitle>
              <CardDescription>Coming Soon - Post jobs to the world's #1 job site</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="opacity-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <span className="text-lg font-bold text-muted-foreground">L</span>
            </div>
            <div>
              <CardTitle>LinkedIn Jobs</CardTitle>
              <CardDescription>Coming Soon - Reach professional networks worldwide</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}
