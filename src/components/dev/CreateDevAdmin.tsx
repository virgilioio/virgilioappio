
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'

export function CreateDevAdmin() {
  const [isCreating, setIsCreating] = useState(false)

  const createDevAdmin = async () => {
    setIsCreating(true)
    
    try {
      const response = await fetch('/functions/v1/create-dev-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        throw new Error('Server returned non-JSON response')
      }

      const result = await response.json()
      console.log('Function result:', result)

      toast({
        title: 'Success',
        description: result.message,
      })
    } catch (error) {
      console.error('Error calling edge function:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create admin user',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Development Setup</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create a Platform Admin user for development and testing purposes.
          </p>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              <strong>Email:</strong> allan@virgilio.tech
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Password:</strong> test1234
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Role:</strong> Platform Admin
            </p>
          </div>
          <Button 
            onClick={createDevAdmin} 
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? 'Creating...' : 'Create Dev Admin User'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
