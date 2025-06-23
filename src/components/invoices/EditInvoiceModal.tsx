
import { useState, useEffect } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUpdateInvoice } from '@/hooks/useInvoices'
import { useFormPersistence } from '@/hooks/useFormPersistence'

const formSchema = z.object({
  title: z.string().min(2, {
    message: 'Invoice title must be at least 2 characters.',
  }),
  description: z.string().optional(),
  amount: z.string().min(1, 'Amount is required'),
  currency: z.string().default('USD'),
  issued_at: z.date().optional(),
  due_date: z.date().optional(),
  status: z.enum(['pending', 'paid', 'overdue']).default('pending'),
})

type FormData = z.infer<typeof formSchema>

interface EditInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: {
    id: string
    title: string
    description?: string
    amount: number
    currency: string
    issued_at?: string
    due_date?: string
    status: 'pending' | 'paid' | 'overdue'
  }
}

export function EditInvoiceModal({ open, onOpenChange, invoice }: EditInvoiceModalProps) {
  const updateInvoiceMutation = useUpdateInvoice()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: invoice.title,
      description: invoice.description || '',
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      issued_at: invoice.issued_at ? new Date(invoice.issued_at) : undefined,
      due_date: invoice.due_date ? new Date(invoice.due_date) : undefined,
      status: invoice.status,
    },
  })

  const { clearPersistedData } = useFormPersistence(`edit-invoice-form-${invoice.id}`, form)

  useEffect(() => {
    form.reset({
      title: invoice.title,
      description: invoice.description || '',
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      issued_at: invoice.issued_at ? new Date(invoice.issued_at) : undefined,
      due_date: invoice.due_date ? new Date(invoice.due_date) : undefined,
      status: invoice.status,
    })
  }, [invoice, form])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const updateData = {
        title: data.title,
        description: data.description,
        amount: parseFloat(data.amount),
        currency: data.currency,
        issued_at: data.issued_at?.toISOString(),
        due_date: data.due_date?.toISOString(),
        status: data.status as 'pending' | 'paid' | 'overdue',
      }

      await updateInvoiceMutation.mutateAsync({ 
        id: invoice.id, 
        ...updateData 
      })
      clearPersistedData()
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          <DialogDescription>
            Update the details of the invoice.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Invoice Title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Invoice description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issued_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issued At</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? field.value.toISOString().substring(0, 10) : ''}
                      onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? field.value.toISOString().substring(0, 10) : ''}
                      onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
