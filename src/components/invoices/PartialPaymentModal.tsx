
import { useState } from 'react'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Invoice, PartialPaymentData, useInvoices } from '@/hooks/useInvoices'

const formSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  payment_date: z.date(),
  payment_method: z.string().min(1, 'Payment method is required'),
  payment_reference: z.string().optional(),
  payment_notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface PartialPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice | null
  onPaymentAdded?: () => void
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

export function PartialPaymentModal({ 
  open, 
  onOpenChange, 
  invoice, 
  onPaymentAdded 
}: PartialPaymentModalProps) {
  const { addPartialPayment } = useInvoices()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      payment_date: new Date(),
      payment_method: '',
      payment_reference: '',
      payment_notes: '',
    },
  })

  const handleSubmit = async (data: FormData) => {
    if (!invoice) return
    
    setIsLoading(true)
    
    try {
      const paymentData: PartialPaymentData = {
        amount: data.amount,
        currency: invoice.currency,
        payment_date: data.payment_date.toISOString(),
        payment_method: data.payment_method,
        payment_reference: data.payment_reference?.trim() || undefined,
        payment_notes: data.payment_notes?.trim() || undefined,
      }

      await addPartialPayment(invoice.id, paymentData)
      
      // Reset form
      form.reset()
      
      onOpenChange(false)
      onPaymentAdded?.()
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const remainingAmount = invoice ? (invoice.amount - (invoice.total_paid || 0)) : 0

  // Don't render if no invoice is provided
  if (!invoice) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Record Partial Payment
          </DialogTitle>
          <DialogDescription>
            Record a partial payment for invoice "{invoice.title}"
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Invoice Summary */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Invoice Total:</span>
                <span className="font-medium">
                  {formatAmount(invoice.amount, invoice.currency)}
                </span>
              </div>
              {invoice.total_paid && invoice.total_paid > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Already Paid:</span>
                  <span className="font-medium text-green-600">
                    {formatAmount(invoice.total_paid, invoice.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-sm text-muted-foreground">Remaining:</span>
                <span className="font-medium">
                  {formatAmount(remainingAmount, invoice.currency)}
                </span>
              </div>
            </div>

            {/* Payment Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount ({invoice.currency}) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={remainingAmount}
                      placeholder="0.00"
                      className="h-10"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Date */}
            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-10",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : "Select date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Reference */}
            <FormField
              control={form.control}
              name="payment_reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Transaction ID, check number, etc."
                      className="h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Notes */}
            <FormField
              control={form.control}
              name="payment_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional payment details..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Recording...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
