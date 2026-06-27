import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format, parseISO } from 'date-fns'
import {
  Building2, Briefcase, DollarSign, User as UserIcon, Layers,
  Calendar as CalendarIcon, FileText, X, Plus, Check,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CurrencySelect } from '@/components/ui/currency-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'
import { useDealStages } from '@/hooks/useDealStages'
import { useDealMutations, type Deal } from '@/hooks/useDeals'

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  organization_id: z.string().min(1, 'Company is required'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be a positive number'),
  currency: z.string().min(3, 'Currency is required').max(3),
  owner_id: z.string().min(1, 'Owner is required'),
  stage_id: z.string().min(1, 'Stage is required'),
  expected_close_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>

interface DealFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal?: Deal | null
  defaultOrganizationId?: string | null
  defaultStageId?: string | null
}

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 font-poppins text-[11px] font-semibold tracking-[0.12em] uppercase text-text-tertiary">
    {children}
  </div>
)

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('rounded-2xl border border-virgilio-border bg-white p-5', className)}>{children}</div>
)

export function DealFormSheet({
  open, onOpenChange, deal, defaultOrganizationId, defaultStageId,
}: DealFormSheetProps) {
  const isEdit = !!deal
  const { user } = useAuth()
  const { organizations } = useOrganizations()
  const { members } = useMembers()
  const { data: stages = [] } = useDealStages()
  const { createDeal, updateDeal } = useDealMutations()

  const activeMembers = useMemo(
    () => (members ?? []).filter((m) => m.user_id && m.user_status === 'active'),
    [members],
  )

  const orgOptions: SearchableSelectOption[] = useMemo(
    () =>
      (organizations ?? [])
        .filter((o) => o.status !== 'inactive')
        .map((o) => ({ value: o.id, label: o.name })),
    [organizations],
  )

  const ownerOptions: SearchableSelectOption[] = useMemo(
    () =>
      activeMembers.map((m) => {
        const name = `${m.user_first_name ?? ''} ${m.user_last_name ?? ''}`.trim()
        return { value: m.user_id!, label: name || m.user_email || 'Unknown' }
      }),
    [activeMembers],
  )

  const firstOpenStageId = useMemo(
    () => stages.find((s) => s.stage_type === 'open')?.id ?? stages[0]?.id ?? '',
    [stages],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      organization_id: '',
      amount: '',
      currency: 'MXN',
      owner_id: '',
      stage_id: '',
      expected_close_date: null,
      notes: '',
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      title: deal?.title ?? '',
      organization_id: deal?.organization_id ?? defaultOrganizationId ?? '',
      amount: deal?.amount != null ? String(deal.amount) : '',
      currency: deal?.currency ?? 'MXN',
      owner_id: deal?.owner_id ?? user?.id ?? '',
      stage_id: deal?.stage_id ?? defaultStageId ?? firstOpenStageId ?? '',
      expected_close_date: deal?.expected_close_date ?? null,
      notes: deal?.notes ?? '',
    })
  }, [open, deal, defaultOrganizationId, defaultStageId, firstOpenStageId, user?.id])

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

  const headerName = isEdit ? 'Edit deal' : 'New deal'
  const headerSubtitle = isEdit
    ? 'Update the deal details. Changes apply across the board and reports.'
    : 'Create a new deal in your CRM pipeline.'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[560px] p-0 flex flex-col bg-[#FAFAF7]"
      >
        {/* Header */}
        <div className="bg-white border-b border-virgilio-border px-6 pt-5 pb-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-poppins text-[10.5px] font-semibold tracking-[0.14em] uppercase text-virgilio-purple">
              CRM · Deal
            </div>
            <h2 className="mt-1 font-poppins font-semibold tracking-[-0.04em] text-[26px] leading-tight text-text-primary">
              {headerName}<span className="text-virgilio-purple">.</span>
            </h2>
            <p className="mt-2 text-body-sm text-text-secondary max-w-[460px]">
              {headerSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 hover:bg-[#F1F0EC] text-text-secondary"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-7"
          >
            {/* DEAL */}
            <section>
              <SectionHeader>Deal</SectionHeader>
              <Card>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">
                          Title <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                            <Input className="h-11 pl-9" placeholder="e.g. Senior Product Designer · Acme" {...field} />
                          </div>
                        </FormControl>
                        <p className="text-[11px] text-text-tertiary">
                          What this search is for — usually the role you're placing.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="organization_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">
                          Company <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary z-10 pointer-events-none" />
                            <SearchableSelect
                              options={orgOptions}
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || '')}
                              placeholder="Select a company"
                              searchPlaceholder="Search companies..."
                              emptyMessage="No companies found."
                              className="h-11 pl-9"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-[1fr_160px] gap-3">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            Amount <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                              <Input
                                className="h-11 pl-9 font-poppins tabular-nums"
                                inputMode="decimal"
                                placeholder="0"
                                {...field}
                                value={field.value ?? ''}
                              />
                            </div>
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
                          <FormLabel className="text-xs">
                            Currency <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <CurrencySelect value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </Card>
            </section>

            {/* PIPELINE */}
            <section>
              <SectionHeader>Pipeline</SectionHeader>
              <Card>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="owner_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            Owner <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary z-10 pointer-events-none" />
                              <SearchableSelect
                                options={ownerOptions}
                                value={field.value ?? ''}
                                onValueChange={(v) => field.onChange(v || '')}
                                placeholder="Select an owner"
                                searchPlaceholder="Search members..."
                                emptyMessage="No members found."
                                className="h-11 pl-9"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stage_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            Stage <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || '')}>
                            <FormControl>
                              <SelectTrigger className="h-11 focus:ring-virgilio-purple">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Layers className="w-4 h-4 text-text-tertiary shrink-0" />
                                  <SelectValue placeholder="Select stage" />
                                </div>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {stages.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: s.color ?? '#8B8F9E' }}
                                    />
                                    {s.name}
                                  </span>
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
                        <FormLabel className="text-xs">Expected close date</FormLabel>
                        <FormControl>
                          <DatePickerVirgilio
                            value={field.value ? parseISO(field.value) : undefined}
                            onChange={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : null)}
                            placeholder="Pick a close date"
                            className="w-full h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Card>
            </section>

            {/* NOTES */}
            <section>
              <SectionHeader>Notes</SectionHeader>
              <Card>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Context, next steps</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <FileText className="absolute left-3 top-3 w-4 h-4 text-text-tertiary" />
                          <Textarea
                            rows={4}
                            className="pl-9 focus-visible:ring-virgilio-purple"
                            placeholder="Add any context, decision-makers, or next steps…"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Card>
            </section>
          </form>
        </Form>

        {/* Footer */}
        <div className="border-t border-virgilio-border bg-white px-6 py-3 flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="ml-auto">
            <Button
              type="button"
              variant="primary"
              icon={isEdit ? Check : Plus}
              loading={submitting}
              onClick={form.handleSubmit(onSubmit)}
            >
              {isEdit ? 'Save changes' : 'Create deal'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
