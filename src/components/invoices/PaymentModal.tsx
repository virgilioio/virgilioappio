
import { useState } from 'react'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CalendarIcon, DollarSign } from 'lucide-react'
import { Invoice, PaymentData, useInvoices } from '@/hooks/useInvoices'

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  onPaymentLogged?: () => void
}

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Wire Transfer',
  'ACH',
  'Check',
  'PayPal',
  'Stripe',
  'Credit Card',
  'Cash',
  'Other'
]

export function PaymentModal({ 
  open, 
  onOpenChange, 
  invoice, 
  onPaymentLogged 
}: PaymentModalProps) {
  const { markInvoiceAsPaid } = useInvoices()
  const [isLoading, setIsLoading] = useState(false)
  
  // Form state
  const [paidAt, setPaidAt] = useState<Date>(new Date())
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!paymentMethod) {
      return
    }

    setIsLoading(true)
    
    try {
      const paymentData: PaymentData = {
        paid_at: paidAt.toISOString(),
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || undefined,
        payment_notes: paymentNotes.trim() || undefined,
      }

      await markInvoiceAsPaid(invoice.id, paymentData)
      
      // Reset form
      setPaidAt(new Date())
      setPaymentMethod('')
      setPaymentReference('')
      setPaymentNotes('')
      
      onOpenChange(false)
      onPaymentLogged?.()
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsLoading(false)
    }
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Log Payment
          </DialogTitle>
          <DialogDescription>
            Record payment details for invoice "{invoice.title}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invoice Summary */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Amount:</span>
              <span className="font-medium">
                {formatAmount(invoice.amount, invoice.currency)}
              </span>
            </div>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="paid-at">Payment Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-10",
                    !paidAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paidAt ? format(paidAt, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paidAt}
                  onSelect={(date) => date && setPaidAt(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Reference */}
          <div className="space-y-2">
            <Label htmlFor="payment-reference">Reference Number</Label>
            <Input
              id="payment-reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Transaction ID, check number, etc."
              className="h-10"
            />
          </div>

          {/* Payment Notes */}
          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes</Label>
            <Textarea
              id="payment-notes"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Additional payment details..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !paymentMethod}
              loading={isLoading}
            >
              Mark as Paid
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
