import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDealPayments, type DealPayment } from '@/hooks/useDealPayments'
import { useDealInvoices } from '@/hooks/useDealInvoices'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  dealId: string
  currency: string
  payment?: DealPayment | null
}

const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
]

export function DealPaymentFormDialog({ open, onOpenChange, dealId, currency, payment }: Props) {
  const { create, update } = useDealPayments(dealId)
  const invoices = useDealInvoices(dealId)
  const isEdit = !!payment

  const [amount, setAmount] = useState<string>(payment ? String(payment.amount) : '')
  const [paidAt, setPaidAt] = useState<string>(payment?.paid_at ?? new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState<string>(payment?.method ?? 'bank_transfer')
  const [note, setNote] = useState<string>(payment?.note ?? '')
  const [invoiceId, setInvoiceId] = useState<string>(payment?.invoice_id ?? 'none')

  const handleSubmit = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) return
    const payload = {
      amount: amt,
      currency,
      paid_at: paidAt,
      method: method || null,
      note: note.trim() || null,
      invoice_id: invoiceId && invoiceId !== 'none' ? invoiceId : null,
    }
    if (isEdit && payment) {
      await update.mutateAsync({ id: payment.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit payment' : 'Register payment'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ({currency})</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(invoices.data ?? []).length > 0 && (
            <div className="space-y-1.5">
              <Label>Linked invoice (optional)</Label>
              <Select value={invoiceId} onValueChange={setInvoiceId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(invoices.data ?? []).map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.file_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || Number(amount) <= 0 || create.isPending || update.isPending}
            className="bg-virgilio-purple hover:bg-virgilio-purple/90"
          >
            {isEdit ? 'Save' : 'Register payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
