import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'
import { useJobBoardIntegration } from '@/hooks/useJobBoardIntegration'
import { Copy, Info } from 'lucide-react'
import { copyToClipboard } from '@/utils/clipboard'
import { useToast } from '@/hooks/use-toast'

export function JobBoardsTab() {
  const { toast } = useToast()
  const { integration, isLoading, toggleIntegration, isEnabled } = useJobBoardIntegration('talent')

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text)
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`
    })
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
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Provide these URLs to your Talent.com account representative to complete the integration:
              </AlertDescription>
            </Alert>
            
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
