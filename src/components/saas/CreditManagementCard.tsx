import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Coins, Gift, ShoppingCart, ChevronDown, TrendingUp } from 'lucide-react'
import { CreditPurchaseHistory } from './CreditPurchaseHistory'
import { GrantCreditsDialog } from '@/components/settings/GrantCreditsDialog'
import { useGrantTenantCredits } from '@/hooks/useGrantTenantCredits'
import { useCreateCreditPurchase } from '@/hooks/useCreateCreditPurchase'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'

interface CreditManagementCardProps {
  tenantId: string
  tenantName: string
  bonusCreditsBalance: number
  bonusCreditsPurchased: number
  bonusCreditsUsed: number
}

const BUNDLE_OPTIONS = [
  { size: '500' as const, credits: 500, price: 49 },
  { size: '1500' as const, credits: 1500, price: 129 },
  { size: '5000' as const, credits: 5000, price: 349 },
]

export function CreditManagementCard({
  tenantId,
  tenantName,
  bonusCreditsBalance,
  bonusCreditsPurchased,
  bonusCreditsUsed,
}: CreditManagementCardProps) {
  const [grantDialogOpen, setGrantDialogOpen] = useState(false)
  const grantCreditsMutation = useGrantTenantCredits()
  const purchaseCreditsMutation = useCreateCreditPurchase()
  const { toast } = useToast()

  const handleGrantCredits = (credits: number, reason: string) => {
    grantCreditsMutation.mutate(
      { tenantId, credits, reason },
      {
        onSuccess: () => {
          setGrantDialogOpen(false)
        },
      }
    )
  }

  const handlePurchaseBundle = async (bundleSize: '500' | '1500' | '5000') => {
    // For admin-initiated purchases, we invoke the edge function directly with tenantId
    try {
      const { data, error } = await supabase.functions.invoke('create-credit-purchase', {
        body: { bundleSize, tenantId }
      })

      if (error) throw error

      if (data?.url) {
        toast({
          title: 'Redirecting to Checkout',
          description: `Opening Stripe checkout for ${bundleSize} credits...`,
        })
        window.open(data.url, '_blank')
      }
    } catch (err: any) {
      toast({
        title: 'Purchase Failed',
        description: err?.message || 'Failed to create checkout session',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card className="shadow-calendly border-virgilio-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text flex items-center gap-2">
              <Coins className="h-5 w-5 text-virgilio-purple" />
              Credit Management<span className="text-virgilio-purple">.</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-virgilio-border hover:border-virgilio-purple/30"
                onClick={() => setGrantDialogOpen(true)}
              >
                <Gift className="h-4 w-4" />
                Grant Credits
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Purchase Bundle
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {BUNDLE_OPTIONS.map((bundle) => (
                    <DropdownMenuItem
                      key={bundle.size}
                      onClick={() => handlePurchaseBundle(bundle.size)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">{bundle.credits.toLocaleString()} credits</span>
                        <span className="text-virgilio-muted">${bundle.price}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credit Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-virgilio-purple/5 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-virgilio-muted mb-1">Available Balance</div>
              <div className="text-2xl font-bold text-virgilio-text flex items-center justify-center gap-2">
                {bonusCreditsBalance.toLocaleString()}
                {bonusCreditsBalance > 0 && (
                  <Badge variant="default" className="text-xs">Active</Badge>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-virgilio-muted mb-1">Total Purchased</div>
              <div className="text-2xl font-bold text-virgilio-text">
                {bonusCreditsPurchased.toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-virgilio-muted mb-1">Total Used</div>
              <div className="text-2xl font-bold text-virgilio-text flex items-center justify-center gap-2">
                {bonusCreditsUsed.toLocaleString()}
                {bonusCreditsPurchased > 0 && (
                  <span className="text-xs text-virgilio-muted font-normal">
                    ({Math.round((bonusCreditsUsed / bonusCreditsPurchased) * 100)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Usage Indicator */}
          {bonusCreditsPurchased > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-virgilio-muted">Usage Progress</span>
                <span className="text-virgilio-text font-medium">
                  {bonusCreditsUsed.toLocaleString()} / {bonusCreditsPurchased.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-virgilio-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-virgilio-purple rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((bonusCreditsUsed / bonusCreditsPurchased) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Purchase History */}
          <div className="pt-4 border-t border-virgilio-border">
            <h4 className="text-sm font-semibold text-virgilio-text mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-virgilio-purple" />
              Purchase History
            </h4>
            <CreditPurchaseHistory tenantId={tenantId} />
          </div>
        </CardContent>
      </Card>

      <GrantCreditsDialog
        open={grantDialogOpen}
        onOpenChange={setGrantDialogOpen}
        onConfirm={handleGrantCredits}
        tenantName={tenantName}
        isPending={grantCreditsMutation.isPending}
      />
    </>
  )
}
