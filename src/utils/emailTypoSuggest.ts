// Domain-typo suggestions for common email providers.
// Silent-until-triggered: returns null when there's nothing to suggest.

const DOMAIN_FIXES: Record<string, string> = {
  // Gmail
  'gnail.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmaail.com': 'gmail.com',
  'ggmail.com': 'gmail.com',
  // Hotmail
  'hotnail.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmial.co': 'hotmail.com',
  // Outlook
  'outlok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outllok.com': 'outlook.com',
  // Yahoo
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  // iCloud
  'icloud.co': 'icloud.com',
  'icloud.con': 'icloud.com',
  'iclould.com': 'icloud.com',
}

/**
 * Returns a corrected email string when the domain matches a known typo,
 * otherwise null. Case-insensitive on the domain half.
 */
export function suggestEmailFix(email: string | null | undefined): string | null {
  if (!email) return null
  const trimmed = email.trim()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return null
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1).toLowerCase()
  const fix = DOMAIN_FIXES[domain]
  if (!fix || fix === domain) return null
  return `${local}@${fix}`
}
