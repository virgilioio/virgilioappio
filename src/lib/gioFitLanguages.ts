export const GIO_FIT_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
] as const

export type GioFitLanguageCode = (typeof GIO_FIT_LANGUAGES)[number]['code']

export function getGioFitLanguage(code?: string | null) {
  return GIO_FIT_LANGUAGES.find((language) => language.code === code) ?? GIO_FIT_LANGUAGES[0]
}