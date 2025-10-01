
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'

export function CreateDevAdmin() {
  const [isCreating, setIsCreating] = useState(false)

  const createPlatformSetup = async () => {
    setIsCreating(true)
    
    try {
      console.log('Calling create-dev-admin edge function...')
      
      const { data, error } = await supabase.functions.invoke('create-dev-admin', {
        body: {}
      })

      console.log('Function response:', { data, error })

      if (error) {
        console.error('Edge function error:', error)
        throw new Error(error.message || 'Failed to call edge function')
      }

      if (!data) {
        throw new Error('No response data from edge function')
      }

      console.log('Function result:', data)

      toast({
        title: 'Success',
        description: data.message || 'Platform setup completed successfully',
      })
    } catch (error) {
      console.error('Error calling edge function:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to set up platform',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Virgilio Platform Setup</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set up Virgilio as the platform organization and create the Platform Admin user.
          </p>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              <strong>Organization:</strong> Virgilio (Platform)
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Admin Email:</strong> allan@virgilio.tech
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Password:</strong> test1234
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Role:</strong> Platform Admin
            </p>
          </div>
          <Button 
            onClick={createPlatformSetup} 
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? 'Setting up...' : 'Set Up Virgilio Platform'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
