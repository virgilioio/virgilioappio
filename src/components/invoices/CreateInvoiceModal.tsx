
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useInvoices, CreateInvoiceData } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { convertCurrency, formatCurrencyAmount } from '@/utils/currencyUtils'

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
})

type FormData = z.infer<typeof formSchema>

interface CreateInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateInvoiceModal({ open, onOpenChange }: CreateInvoiceModalProps) {
  const { createInvoice } = useInvoices()
  const { organizations } = useOrganizations()
  const { isPlatformAdmin } = usePermissions()
  const { currencies } = useCurrencies()
  const { defaultCurrency } = useOrganizationCurrency()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [conversionPreview, setConversionPreview] = useState<{
    amount: number
    fromCurrency: string
    toCurrency: string
    convertedAmount: number
    exchangeRate: number
  } | null>(null)

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
    },
  })

  // Add form persistence
  const { clearPersistedData } = useFormPersistence({
    storageKey: 'create-invoice-form',
    form,
    enabled: open
  })

  const watchedAmount = form.watch('amount')
  const watchedCurrency = form.watch('currency')
  const watchedOrganization = form.watch('organization_id')

  // Get organization's preferred currency for conversion preview
  const selectedOrganization = organizations.find(org => org.id === watchedOrganization)
  const orgCurrency = selectedOrganization?.default_currency || defaultCurrency

  // Show conversion preview when currency differs from org currency
  const showConversion = watchedCurrency && orgCurrency && watchedCurrency !== orgCurrency && watchedAmount

  const updateConversionPreview = async () => {
    if (!showConversion) {
      setConversionPreview(null)
      return
    }

    try {
      const amount = parseFloat(watchedAmount)
      if (isNaN(amount)) return

      const result = await convertCurrency(amount, watchedCurrency, orgCurrency)
      setConversionPreview({
        amount,
        fromCurrency: watchedCurrency,
        toCurrency: orgCurrency,
        convertedAmount: result.convertedAmount,
        exchangeRate: result.exchangeRate
      })
    } catch (error) {
      console.error('Conversion preview error:', error)
      setConversionPreview(null)
    }
  }

  // Update conversion preview when relevant fields change
  React.useEffect(() => {
    if (showConversion) {
      const timeoutId = setTimeout(updateConversionPreview, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [watchedAmount, watchedCurrency, orgCurrency, showConversion])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const invoiceData: CreateInvoiceData = {
        organization_id: data.organization_id,
        title: data.title,
        description: data.description,
        amount: parseFloat(data.amount),
        currency: data.currency,
        issued_at: data.issued_at?.toISOString(),
        due_date: data.due_date?.toISOString(),
      }

      await createInvoice(invoiceData)
      form.reset()
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
    onOpenChange(false)
  }

  const availableOrganizations = organizations

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice for an organization
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableOrganizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name} ({org.country})
                          </SelectItem>
                        ))}
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
                        {currencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conversion Preview */}
              {conversionPreview && (
                <div className="sm:col-span-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Currency Conversion Preview</p>
                      <p className="text-sm text-blue-700">
                        {formatCurrencyAmount(conversionPreview.amount, conversionPreview.fromCurrency)} = {' '}
                        {formatCurrencyAmount(conversionPreview.convertedAmount, conversionPreview.toCurrency)}
                      </p>
                      <p className="text-xs text-blue-600">
                        Exchange rate: 1 {conversionPreview.fromCurrency} = {conversionPreview.exchangeRate.toFixed(6)} {conversionPreview.toCurrency}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={updateConversionPreview}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

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
                {isSubmitting ? 'Creating...' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
