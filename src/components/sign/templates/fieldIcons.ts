import { AtSign, Calendar, Database, PenLine, SquareCheck, TextCursorInput, Type, User, type LucideIcon } from 'lucide-react'

import type { FieldType, SignerFieldType } from '@/lib/sign/templates'

/** Each field type's icon, on the page, in the field list and in the right panel. */
export const FIELD_ICON: Record<FieldType, LucideIcon> = {
  signature: PenLine,
  initials: Type,
  date: Calendar,
  name: User,
  email: AtSign,
  text: TextCursorInput,
  checkbox: SquareCheck,
  data: Database,
}
export const SIGNER_TILES: SignerFieldType[] = ['signature', 'initials', 'date', 'name', 'email', 'text', 'checkbox']
export const sideH = 'font-inter text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary'
