
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { FormField } from '@/components/ui/form-field'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { CandidateComments } from './CandidateComments'
import type { Candidate } from '@/hooks/useCandidates'

interface CandidateFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  candidate?: Candidate | null
  jobId: string
  isLoading: boolean
}

interface FormData {
  candidate_name: string
  location_country: string
  location_state: string
  location_city: string
  salary_amount: string
  salary_currency: string
  salary_period: string
  profile_summary: string
  notes: string
}

const currencies = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'KRW', label: 'KRW - South Korean Won' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar' },
  { value: 'NOK', label: 'NOK - Norwegian Krone' },
  { value: 'SEK', label: 'SEK - Swedish Krona' },
  { value: 'DKK', label: 'DKK - Danish Krone' },
  { value: 'PLN', label: 'PLN - Polish Zloty' },
  { value: 'CZK', label: 'CZK - Czech Koruna' },
  { value: 'HUF', label: 'HUF - Hungarian Forint' },
  { value: 'RUB', label: 'RUB - Russian Ruble' },
  { value: 'BRL', label: 'BRL - Brazilian Real' },
  { value: 'MXN', label: 'MXN - Mexican Peso' },
  { value: 'ARS', label: 'ARS - Argentine Peso' },
  { value: 'CLP', label: 'CLP - Chilean Peso' },
  { value: 'COP', label: 'COP - Colombian Peso' },
  { value: 'ZAR', label: 'ZAR - South African Rand' },
  { value: 'TRY', label: 'TRY - Turkish Lira' },
  { value: 'ILS', label: 'ILS - Israeli Shekel' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'EGP', label: 'EGP - Egyptian Pound' },
  { value: 'THB', label: 'THB - Thai Baht' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit' },
  { value: 'IDR', label: 'IDR - Indonesian Rupiah' },
  { value: 'PHP', label: 'PHP - Philippine Peso' },
  { value: 'VND', label: 'VND - Vietnamese Dong' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' }
]

export function CandidateForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  candidate, 
  jobId, 
  isLoading 
}: CandidateFormProps) {
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [profileSummary, setProfileSummary] = useState('')
  const [notes, setNotes] = useState('')
  const { user } = useAuth()

  const form = useForm<FormData>({
    defaultValues: {
      candidate_name: '',
      location_country: '',
      location_state: '',
      location_city: '',
      salary_amount: '',
      salary_currency: 'USD',
      salary_period: 'annually',
      profile_summary: '',
      notes: ''
    }
  })

  // Setup form persistence - only enable for new candidates (not editing existing ones)
  const { clearPersistedData } = useFormPersistence({
    storageKey: `candidate-form-${jobId}`,
    form,
    enabled: isOpen && !candidate, // Only persist for new candidates
    debounceMs: 300
  })

  // Effect for handling candidate data loading (when editing)
  useEffect(() => {
    if (candidate && isOpen) {
      console.log('Loading candidate data for editing:', candidate.candidate_name)
      
      // Reset form with candidate data when editing
      const candidateData = {
        candidate_name: candidate.candidate_name || '',
        location_country: candidate.location_country || '',
        location_state: candidate.location_state || '',
        location_city: candidate.location_city || '',
        salary_amount: candidate.salary_amount?.toString() || '',
        salary_currency: candidate.salary_currency || 'USD',
        salary_period: candidate.salary_period || 'annually',
        profile_summary: candidate.profile_summary || '',
        notes: candidate.notes || ''
      }
      
      form.reset(candidateData)
      
      // Set the rich text editor values separately with logging
      const profileSummaryValue = candidate.profile_summary || ''
      const notesValue = candidate.notes || ''
      
      console.log('Setting profile summary:', profileSummaryValue)
      console.log('Setting notes:', notesValue)
      
      setProfileSummary(profileSummaryValue)
      setNotes(notesValue)
    }
  }, [candidate, isOpen, form])

  // Effect for handling form reset (when closing dialog for new candidates)
  useEffect(() => {
    if (!isOpen && !candidate) {
      console.log('Resetting form for new candidate creation')
      
      // Only reset form when dialog closes for new candidates (not when editing)
      form.reset({
        candidate_name: '',
        location_country: '',
        location_state: '',
        location_city: '',
        salary_amount: '',
        salary_currency: 'USD',
        salary_period: 'annually',
        profile_summary: '',
        notes: ''
      })
      
      // Reset rich text editor values only for new candidates
      setProfileSummary('')
      setNotes('')
    }
  }, [isOpen, candidate, form])

  const handleSubmit = form.handleSubmit((data) => {
    const submitData = {
      ...data,
      salary_amount: data.salary_amount ? Number(data.salary_amount) : null,
      profile_summary: profileSummary,
      notes: notes,
      job_id: jobId
    }
    
    onSubmit(submitData)
    
    // Clear persisted data after successful submission
    if (!candidate) {
      clearPersistedData()
    }
  })

  const handleClose = () => {
    // Don't clear persisted data when closing - let it persist for later use
    onClose()
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-primary">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-xl font-semibold text-text-primary">
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Candidate Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Basic Information
              </h3>
              
              <FormField 
                label="Name or Alias" 
                required 
                error={form.formState.errors.candidate_name?.message}
                htmlFor="candidate_name"
              >
                <Input
                  id="candidate_name"
                  {...form.register('candidate_name', { required: 'Name is required' })}
                  placeholder="Enter candidate name or alias"
                  className="h-[44px]"
                />
              </FormField>
            </div>

            {/* Location Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Location
              </h3>
              
              <FormField 
                label="Country"
                htmlFor="location_country"
              >
                <Input
                  id="location_country"
                  {...form.register('location_country')}
                  placeholder="Country"
                  className="h-[44px]"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="State/Province"
                  htmlFor="location_state"
                >
                  <Input
                    id="location_state"
                    {...form.register('location_state')}
                    placeholder="State/Province"
                    className="h-[44px]"
                  />
                </FormField>

                <FormField 
                  label="City"
                  htmlFor="location_city"
                >
                  <Input
                    id="location_city"
                    {...form.register('location_city')}
                    placeholder="City"
                    className="h-[44px]"
                  />
                </FormField>
              </div>
            </div>

            {/* Salary Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Salary Expectations
              </h3>
              
              <FormField 
                label="Amount"
                error={form.formState.errors.salary_amount?.message}
                htmlFor="salary_amount"
              >
                <Input
                  id="salary_amount"
                  type="number"
                  {...form.register('salary_amount', {
                    validate: (value) => {
                      if (value && isNaN(Number(value))) return 'Please enter a valid number'
                      if (value && Number(value) <= 0) return 'Salary must be greater than 0'
                      return true
                    }
                  })}
                  placeholder="50000"
                  className="h-[44px]"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="Currency"
                  htmlFor="salary_currency"
                >
                  <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={currencyOpen}
                        className="w-full justify-between h-[44px]"
                      >
                        {form.watch('salary_currency')
                          ? currencies.find((currency) => currency.value === form.watch('salary_currency'))?.label
                          : "Select currency..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search currency..." />
                        <CommandList>
                          <CommandEmpty>No currency found.</CommandEmpty>
                          <CommandGroup>
                            {currencies.map((currency) => (
                              <CommandItem
                                key={currency.value}
                                value={currency.value}
                                onSelect={(currentValue) => {
                                  form.setValue('salary_currency', currentValue.toUpperCase())
                                  setCurrencyOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.watch('salary_currency') === currency.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {currency.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FormField>

                <FormField 
                  label="Period"
                  htmlFor="salary_period"
                >
                  <Select 
                    value={form.watch('salary_period')} 
                    onValueChange={(value) => form.setValue('salary_period', value)}
                  >
                    <SelectTrigger className="h-[44px]">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>

            {/* Profile & Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Additional Information
              </h3>
              
              <FormField 
                label="Profile Summary" 
                htmlFor="profile_summary"
                helpText="Brief overview of candidate's experience and skills"
              >
                <RichTextEditor
                  value={profileSummary}
                  onChange={setProfileSummary}
                  placeholder="Brief summary of candidate's background, experience, and key skills..."
                  minHeight="150px"
                  className="mt-1"
                />
              </FormField>

              <FormField 
                label="Internal Notes" 
                htmlFor="notes"
                helpText="Private notes visible only to internal team"
              >
                <RichTextEditor
                  value={notes}
                  onChange={setNotes}
                  placeholder="Add any additional internal notes about this candidate..."
                  minHeight="120px"
                  className="mt-1"
                />
              </FormField>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="flex-1 h-[44px]"
              >
                {isLoading ? 'Saving...' : candidate ? 'Update Candidate' : 'Add Candidate'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                className="h-[44px] sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </form>

          {/* Comments Section - Only show for existing candidates */}
          {candidate && (
            <>
              <Separator className="my-6" />
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                  Comments & Discussion
                </h3>
                <div className="bg-surface-secondary rounded-lg p-6">
                  <CandidateComments
                    candidateId={candidate.id}
                    jobId={candidate.job_id}
                    organizationId={user.user_metadata?.organization_id || 'default-org'}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
