
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Invoice, useInvoices } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { convertCurrency, formatCurrencyAmount, getCurrencySymbol } from '@/utils/currencyUtils'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'

const formSchema = z.object({
  organization_id: z.string().min(1, 'Organization is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  amount: z.string()
    .min(1, 'Amount is required')
    .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), 'Please enter a valid amount (e.g., 1234.56)')
    .refine((val) => parseFloat(val) > 0, 'Amount must be greater than 0'),
  currency: z.string().min(1, 'Currency is required'),
  issued_at: z.date().optional(),
  due_date: z.date().optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'partial']),
})

type FormData = z.infer<typeof formSchema>

interface EditInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice | null
}

export function EditInvoiceModal({ open, onOpenChange, invoice }: EditInvoiceModalProps) {
  const { updateInvoice } = useInvoices()
  const { organizations } = useOrganizations()
  const { currencies } = useCurrencies()
  const { defaultCurrency } = useOrganizationCurrency()
  const { organizationId } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [conversionPreview, setConversionPreview] = useState<{
    convertedAmount: number
    exchangeRate: number
    rateDate: string
    isEstimate: boolean
  } | null>(null)
  const [isLoadingConversion, setIsLoadingConversion] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organization_id: '',
      title: '',
      description: '',
      amount: '',
      currency: defaultCurrency,
      issued_at: new Date(),
      due_date: undefined,
      status: 'pending',
    },
  })

  // Add form persistence only when invoice exists and modal is open
  const { clearPersistedData } = useFormPersistence({
    storageKey: invoice ? `edit-invoice-form-${invoice.id}` : 'edit-invoice-form-temp',
    form,
    enabled: open && !!invoice
  })

  // Update form when invoice changes
  useEffect(() => {
    if (invoice && open) {
      form.reset({
        organization_id: invoice.organization_id,
        title: invoice.title,
        description: invoice.description || '',
        amount: invoice.amount.toString(),
        currency: invoice.currency,
        issued_at: new Date(invoice.issued_at),
        due_date: invoice.due_date ? new Date(invoice.due_date) : undefined,
        status: invoice.status,
      })
    }
  }, [invoice, open, form])

  // Watch for amount and currency changes to update conversion preview
  const watchedAmount = form.watch('amount')
  const watchedCurrency = form.watch('currency')

  // Update conversion preview when amount or currency changes
  useEffect(() => {
    const updateConversionPreview = async () => {
      if (!watchedAmount || !watchedCurrency || watchedCurrency === defaultCurrency) {
        setConversionPreview(null)
        return
      }

      const amount = parseFloat(watchedAmount)
      if (isNaN(amount) || amount <= 0) {
        setConversionPreview(null)
        return
      }

      setIsLoadingConversion(true)
      try {
        const result = await convertCurrency(
          amount,
          watchedCurrency,
          defaultCurrency,
          organizationId
        )
        setConversionPreview(result)
      } catch (error) {
        console.error('Error converting currency:', error)
        setConversionPreview(null)
      } finally {
        setIsLoadingConversion(false)
      }
    }

    updateConversionPreview()
  }, [watchedAmount, watchedCurrency, defaultCurrency, organizationId])

  const refreshConversionRate = async () => {
    if (!watchedAmount || !watchedCurrency || watchedCurrency === defaultCurrency) return

    const amount = parseFloat(watchedAmount)
    if (isNaN(amount) || amount <= 0) return

    setIsLoadingConversion(true)
    try {
      const result = await convertCurrency(
        amount,
        watchedCurrency,
        defaultCurrency,
        organizationId
      )
      setConversionPreview(result)
    } catch (error) {
      console.error('Error refreshing conversion rate:', error)
    } finally {
      setIsLoadingConversion(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    if (!invoice) return
    
    setIsSubmitting(true)
    try {
      const updateData = {
        organization_id: data.organization_id,
        title: data.title,
        description: data.description,
        amount: parseFloat(data.amount),
        currency: data.currency,
        issued_at: data.issued_at?.toISOString(),
        due_date: data.due_date?.toISOString(),
        status: data.status,
      }

      await updateInvoice(invoice.id, updateData)
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
    clearPersistedData()
    setConversionPreview(null)
    onOpenChange(false)
  }

  // Don't render if no invoice is provided
  if (!invoice) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          <DialogDescription>
            Update invoice details for {invoice.title}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Organization Selection */}
              <FormField
                control={form.control}
                name="organization_id"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Organization *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations?.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name} ({org.country})
                          </SelectItem>
                        )) || []}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Invoice Title *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., April 2025 Success Fee" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional details about this invoice"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input 
                        type="text"
                        inputMode="decimal"
                        placeholder="1234.56"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                            field.onChange(value)
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency */}
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies?.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        )) || []}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency Conversion Preview */}
              {conversionPreview && watchedCurrency !== defaultCurrency && (
                <div className="sm:col-span-2">
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-blue-900">
                            Conversion Preview
                          </div>
                          <div className="text-lg font-semibold text-blue-700">
                            {formatCurrencyAmount(conversionPreview.convertedAmount, defaultCurrency)} {defaultCurrency}
                          </div>
                          <div className="text-xs text-blue-600">
                            Rate: 1 {watchedCurrency} = {conversionPreview.exchangeRate.toFixed(6)} {defaultCurrency}
                          </div>
                          <div className="text-xs text-blue-500">
                            Rate from: {new Date(conversionPreview.rateDate).toLocaleDateString()}
                            {conversionPreview.isEstimate && ' (estimated)'}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={refreshConversionRate}
                          disabled={isLoadingConversion}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <RefreshCw className={cn("h-4 w-4", isLoadingConversion && "animate-spin")} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Issued Date */}
              <FormField
                control={form.control}
                name="issued_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issued Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date */}
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
