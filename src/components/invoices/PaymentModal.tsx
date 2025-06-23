import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Invoice, useMarkInvoicePaid, PaymentData } from '@/hooks/useInvoices'

const formSchema = z.object({
  payment_method: z.string().optional(),
  payment_reference: z.string().optional(),
  payment_notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  onPaymentComplete?: () => void
}

export function PaymentModal({ open, onOpenChange, invoice, onPaymentComplete }: PaymentModalProps) {
  const markInvoiceAsPaidMutation = useMarkInvoicePaid()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      payment_method: '',
      payment_reference: '',
      payment_notes: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const paymentData: PaymentData = {
        payment_method: data.payment_method,
        payment_reference: data.payment_reference,
        payment_notes: data.payment_notes,
      }

      await markInvoiceAsPaidMutation.mutateAsync({ 
        invoiceId: invoice.id, 
        paymentData 
      })
      
      form.reset()
      onOpenChange(false)
      onPaymentComplete?.()
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
          <DialogDescription>
            Enter payment details for invoice {invoice.title}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Credit Card, Bank Transfer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Reference</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Transaction ID, Check Number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes about this payment" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Marking as Paid...' : 'Mark as Paid'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
