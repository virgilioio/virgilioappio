
// Country codes sorted by length (longest first) for greedy matching
const COUNTRY_CODES = [
  '+1684', '+1670', '+1671', '+1787', '+1939', '+1242', '+1246', '+1264',
  '+1268', '+1284', '+1340', '+1345', '+1441', '+1473', '+1649', '+1664',
  '+1721', '+1758', '+1767', '+1784', '+1849', '+1868', '+1869', '+1876',
  '+998', '+996', '+995', '+994', '+993', '+992', '+977', '+976', '+975',
  '+974', '+973', '+972', '+971', '+968', '+967', '+966', '+965', '+964',
  '+963', '+962', '+961', '+960', '+886', '+880', '+856', '+855', '+853',
  '+852', '+850', '+692', '+691', '+690', '+689', '+688', '+687', '+686',
  '+685', '+683', '+682', '+681', '+680', '+679', '+678', '+677', '+676',
  '+675', '+674', '+673', '+672', '+670', '+599', '+598', '+597', '+596',
  '+595', '+594', '+593', '+592', '+591', '+590', '+509', '+508', '+507',
  '+506', '+505', '+504', '+503', '+502', '+501', '+500', '+423', '+421',
  '+420', '+389', '+387', '+386', '+385', '+383', '+382', '+381', '+380',
  '+378', '+377', '+376', '+375', '+374', '+373', '+372', '+371', '+370',
  '+359', '+358', '+357', '+356', '+355', '+354', '+353', '+352', '+351',
  '+350', '+299', '+298', '+297', '+291', '+269', '+268', '+267', '+266',
  '+265', '+264', '+263', '+262', '+261', '+260', '+258', '+257', '+256',
  '+255', '+254', '+253', '+252', '+251', '+250', '+249', '+248', '+247',
  '+246', '+245', '+244', '+243', '+242', '+241', '+240', '+239', '+238',
  '+237', '+236', '+235', '+234', '+233', '+232', '+231', '+230', '+229',
  '+228', '+227', '+226', '+225', '+224', '+223', '+222', '+221', '+220',
  '+218', '+216', '+213', '+212', '+211',
  '+98', '+95', '+94', '+93', '+92', '+91', '+90', '+86', '+84', '+82',
  '+81', '+66', '+65', '+64', '+63', '+62', '+61', '+60', '+58', '+57',
  '+56', '+55', '+54', '+53', '+52', '+51', '+49', '+48', '+47', '+46',
  '+45', '+44', '+43', '+41', '+40', '+39', '+36', '+34', '+33', '+32',
  '+31', '+30', '+27', '+20',
  '+7', '+1',
]

/**
 * Strips all non-digit and non-plus characters from a phone string.
 * Ensures the result starts with '+'.
 * Example: "+52 (1) 333-255-5660" → "+5213332555660"
 */
export function sanitizeToE164(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/[^\d+]/g, '')
  // Ensure it starts with +
  if (cleaned && !cleaned.startsWith('+')) {
    return '+' + cleaned
  }
  return cleaned
}

/**
 * Formats an E.164 phone number for display by inserting a space after the country code.
 * Example: "+5213332555660" → "+52 13332555660"
 * If no country code is matched, returns the sanitized number as-is.
 */
export function formatE164Display(phone: string): string {
  if (!phone) return ''
  const sanitized = sanitizeToE164(phone)
  if (!sanitized) return ''

  for (const code of COUNTRY_CODES) {
    if (sanitized.startsWith(code)) {
      const subscriber = sanitized.slice(code.length)
      if (subscriber.length > 0) {
        return `${code} ${subscriber}`
      }
      return sanitized
    }
  }

  return sanitized
}

/**
 * Builds a WhatsApp wa.me URL from a phone number.
 * Strips everything except digits.
 * Returns null if the number is too short or missing.
 */
export function buildWhatsAppUrl(phone: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d]/g, '')
  return digits.length >= 7 ? `https://wa.me/${digits}` : null
}
