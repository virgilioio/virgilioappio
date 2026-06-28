// Standardized EEOC self-identification option sets and labels.
// Used by the public application form and the admin-only EEO card.

export type EeoGender = 'male' | 'female' | 'non_binary' | 'other' | 'decline'
export type EeoRaceEthnicity =
  | 'hispanic_latino'
  | 'white'
  | 'black_african_american'
  | 'native_hawaiian_pacific_islander'
  | 'asian'
  | 'american_indian_alaska_native'
  | 'two_or_more'
  | 'decline'
export type EeoVeteranStatus = 'not_veteran' | 'protected_veteran' | 'veteran_not_protected' | 'decline'
export type EeoDisabilityStatus = 'yes' | 'no' | 'decline'

export const EEO_GENDER_OPTIONS: { value: EeoGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
  { value: 'decline', label: 'Decline to identify' },
]

export const EEO_RACE_OPTIONS: { value: EeoRaceEthnicity; label: string }[] = [
  { value: 'hispanic_latino', label: 'Hispanic or Latino' },
  { value: 'white', label: 'White (Not Hispanic or Latino)' },
  { value: 'black_african_american', label: 'Black or African American (Not Hispanic or Latino)' },
  { value: 'native_hawaiian_pacific_islander', label: 'Native Hawaiian or Other Pacific Islander (Not Hispanic or Latino)' },
  { value: 'asian', label: 'Asian (Not Hispanic or Latino)' },
  { value: 'american_indian_alaska_native', label: 'American Indian or Alaska Native (Not Hispanic or Latino)' },
  { value: 'two_or_more', label: 'Two or More Races (Not Hispanic or Latino)' },
  { value: 'decline', label: 'Decline to identify' },
]

export const EEO_VETERAN_OPTIONS: { value: EeoVeteranStatus; label: string }[] = [
  { value: 'not_veteran', label: 'I am not a protected veteran' },
  { value: 'protected_veteran', label: 'I identify as one or more of the classifications of a protected veteran' },
  { value: 'veteran_not_protected', label: 'I am a veteran but not a protected veteran' },
  { value: 'decline', label: 'Decline to identify' },
]

export const EEO_DISABILITY_OPTIONS: { value: EeoDisabilityStatus; label: string }[] = [
  { value: 'yes', label: 'Yes, I have a disability (or previously had a disability)' },
  { value: 'no', label: 'No, I do not have a disability' },
  { value: 'decline', label: 'Decline to identify' },
]

export const EEO_LEGAL_DISCLAIMER = `Completion of this section is entirely voluntary. The information collected here will be kept confidential, used only for aggregate equal-employment-opportunity reporting, and will not be used in any way to influence hiring decisions. Refusal to provide this information will not subject you to any adverse treatment.`

export function labelFor<T extends string>(options: { value: T; label: string }[], v: T | null | undefined): string {
  if (!v) return ''
  return options.find(o => o.value === v)?.label ?? ''
}
