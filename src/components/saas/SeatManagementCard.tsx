import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Minus, Plus, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface SeatManagementCardProps {
  tenantId: string
  currentSeats: number
  maxSeats: number | null
  lastUpdated?: string | null
}

export function SeatManagementCard({
  tenantId,
  currentSeats,
  maxSeats,
  lastUpdated,
}: SeatManagementCardProps) {
  const [seatCount, setSeatCount] = useState(currentSeats)
  const queryClient = useQueryClient()

  const updateSeatsMutation = useMutation({
    mutationFn: async (newSeatCount: number) => {
      const { data, error } = await supabase.functions.invoke('update-seat-quantity', {
        body: {
          tenantId,
          newSeatCount,
        },
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Seat count updated successfully')
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer'] })
    },
    onError: (error: Error) => {
      console.error('Failed to update seat count:', error)
      toast.error('Failed to update seat count', {
        description: error.message || 'An unexpected error occurred',
      })
      setSeatCount(currentSeats) // Reset to current value on error
    },
  })

  const handleIncrement = () => {
    const newCount = seatCount + 1
    setSeatCount(newCount)
    updateSeatsMutation.mutate(newCount)
  }

  const handleDecrement = () => {
    if (seatCount > 1) {
      const newCount = seatCount - 1
      setSeatCount(newCount)
      updateSeatsMutation.mutate(newCount)
    }
  }

  const handleManualUpdate = () => {
    if (seatCount !== currentSeats && seatCount > 0) {
      updateSeatsMutation.mutate(seatCount)
    }
  }

  return (
    <Card className="shadow-calendly border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
          Seat Management<span className="text-virgilio-purple">.</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 text-sm text-virgilio-muted mb-1">
              <Users className="h-4 w-4" />
              Current Seats
            </div>
            <div className="text-2xl font-bold text-virgilio-text">{currentSeats}</div>
          </div>
          
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <div className="text-sm text-virgilio-muted mb-1">Maximum Allowed</div>
            <div className="text-2xl font-bold text-virgilio-text">
              {maxSeats || 'Unlimited'}
            </div>
          </div>
        </div>

        {/* Seat Adjustment Controls */}
        <div className="space-y-3">
          <Label htmlFor="seat-count" className="text-virgilio-text">
            Adjust Seat Count
          </Label>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handleDecrement}
              disabled={seatCount <= 1 || updateSeatsMutation.isPending}
              className="border-virgilio-border hover:border-virgilio-purple/30"
            >
              <Minus className="h-4 w-4" />
            </Button>
            
            <Input
              id="seat-count"
              type="number"
              min="1"
              max={maxSeats || undefined}
              value={seatCount}
              onChange={(e) => setSeatCount(parseInt(e.target.value) || 1)}
              className="text-center font-mono text-lg w-24"
              disabled={updateSeatsMutation.isPending}
            />
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleIncrement}
              disabled={(maxSeats !== null && seatCount >= maxSeats) || updateSeatsMutation.isPending}
              className="border-virgilio-border hover:border-virgilio-purple/30"
            >
              <Plus className="h-4 w-4" />
            </Button>

            {seatCount !== currentSeats && (
              <Button
                onClick={handleManualUpdate}
                disabled={updateSeatsMutation.isPending}
                className="ml-auto bg-virgilio-purple hover:bg-virgilio-purple/90"
              >
                {updateSeatsMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update
              </Button>
            )}
          </div>

          <p className="text-sm text-virgilio-muted">
            Click +/- or enter a number to adjust the seat count. Changes are applied immediately.
          </p>
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="pt-4 border-t border-virgilio-border">
            <div className="text-sm text-virgilio-muted">
              Last updated: {format(new Date(lastUpdated), 'MMMM d, yyyy h:mm a')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
