import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format, parseISO } from 'date-fns'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CurrencySelect } from '@/components/ui/currency-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { ChevronRight } from 'lucide-react'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'
import { useDealStages } from '@/hooks/useDealStages'
import { useDealMutations, type Deal } from '@/hooks/useDeals'

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  organization_id: z.string().nullable().optional(),
  amount: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(Number(v)), 'Must be a number'),
  currency: z.string().min(3).max(3),
  owner_id: z.string().nullable().optional(),
  stage_id: z.string().nullable().optional(),
  expected_close_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>

interface DealFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal?: Deal | null
}

export function DealFormSheet({ open, onOpenChange, deal }: DealFormSheetProps) {
  const isEdit = !!deal
  const { organizations } = useOrganizations()
  const { members } = useMembers()
  const { data: stages = [] } = useDealStages()
  const { createDeal, updateDeal } = useDealMutations()

  const activeMembers = useMemo(
    () => (members ?? []).filter((m) => m.user_id && m.user_status === 'active'),
    [members]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      organization_id: null,
      amount: '',
      currency: 'USD',
      owner_id: null,
      stage_id: null,
      expected_close_date: null,
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        title: deal?.title ?? '',
        organization_id: deal?.organization_id ?? null,
        amount: deal?.amount != null ? String(deal.amount) : '',
        currency: deal?.currency ?? 'USD',
        owner_id: deal?.owner_id ?? null,
        stage_id: deal?.stage_id ?? null,
        expected_close_date: deal?.expected_close_date ?? null,
        notes: deal?.notes ?? '',
      })
    }
  }, [open, deal, form])

  const onSubmit = async (values: FormValues) => {
    const payload = {
      title: values.title.trim(),
      organization_id: values.organization_id || null,
      amount: values.amount ? Number(values.amount) : null,
      currency: values.currency,
      owner_id: values.owner_id || null,
      stage_id: values.stage_id || null,
      expected_close_date: values.expected_close_date || null,
      notes: values.notes || null,
    }
    if (isEdit && deal) {
      await updateDeal.mutateAsync({ id: deal.id, ...payload })
    } else {
      await createDeal.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  const submitting = createDeal.isPending || updateDeal.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-poppins font-bold tracking-[-0.04em]">
            {isEdit ? 'Edit deal' : 'New deal'}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? 'Update the deal details.' : 'Create a new deal in your CRM pipeline.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input className="h-11 focus-visible:ring-virgilio-purple" placeholder="e.g. Acme Q3 retainer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="organization_id"
              render={({ field }) => {
                const orgOptions: SearchableSelectOption[] = (organizations ?? [])
                  .filter((o) => o.status === 'active')
                  .map((o) => ({ value: o.id, label: o.name }))
                return (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={orgOptions}
                        value={field.value ?? ''}
                        onValueChange={(v) => field.onChange(v || null)}
                        placeholder="Select a company"
                        searchPlaceholder="Search companies..."
                        emptyMessage="No companies found."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11 focus-visible:ring-virgilio-purple"
                        inputMode="decimal"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ''}
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
                      <CurrencySelect value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="owner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)}>
                      <FormControl>
                        <SelectTrigger className="h-8 focus:ring-virgilio-purple">
                          <SelectValue placeholder="Select an owner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeMembers.map((m) => (
                          <SelectItem key={m.user_id!} value={m.user_id!}>
                            {(m.user_first_name || m.user_last_name)
                              ? `${m.user_first_name ?? ''} ${m.user_last_name ?? ''}`.trim()
                              : m.user_email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stage_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)}>
                      <FormControl>
                        <SelectTrigger className="h-8 focus:ring-virgilio-purple">
                          <SelectValue placeholder="Default" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="expected_close_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected close date</FormLabel>
                  <FormControl>
                    <DatePickerVirgilio
                      value={field.value ? parseISO(field.value) : undefined}
                      onChange={(d) => field.onChange(format(d, 'yyyy-MM-dd'))}
                      placeholder="Pick a close date"
                      className="w-full h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      className="focus-visible:ring-virgilio-purple"
                      placeholder="Context, next steps…"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-virgilio-purple hover:bg-virgilio-purple/90">
                {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create deal'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
