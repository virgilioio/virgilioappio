/**
 * Parse a contact entry that might be a JSON string, object, or plain string.
 * Handles contact_emails and contact_phones stored as text[] with JSON strings.
 */
export const parseContactEntry = (entry: any): any => {
  if (!entry) return null;
  
  // Already an object, return as-is
  if (typeof entry === 'object') return entry;
  
  // String that looks like JSON object
  if (typeof entry === 'string' && entry.trim().startsWith('{')) {
    try {
      return JSON.parse(entry);
    } catch {
      return entry; // Failed to parse, return original
    }
  }
  
  // Plain string (just the email/phone value)
  return entry;
};

/**
 * Extract email value and type from a contact entry
 */
export const getEmailFromEntry = (entry: any): { email: string | null; type: string } => {
  const parsed = parseContactEntry(entry);
  
  if (!parsed) return { email: null, type: 'personal' };
  
  if (typeof parsed === 'object') {
    return { 
      email: parsed.email || null, 
      type: parsed.type || 'personal' 
    };
  }
  
  // Plain string is the email itself
  return { email: parsed, type: 'personal' };
};

/**
 * Extract phone value and type from a contact entry
 */
export const getPhoneFromEntry = (entry: any): { phone: string | null; type: string } => {
  const parsed = parseContactEntry(entry);
  
  if (!parsed) return { phone: null, type: 'personal' };
  
  if (typeof parsed === 'object') {
    return { 
      phone: parsed.number || parsed.phone || null, 
      type: parsed.type || 'personal' 
    };
  }
  
  // Plain string is the phone itself
  return { phone: parsed, type: 'personal' };
};
