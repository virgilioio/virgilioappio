import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useWorkers } from '@/hooks/useWorkers'
import { toast } from '@/hooks/use-toast'
import { DollarSign, PlayCircle } from 'lucide-react'

export function PayrollTable() {
  const { workers } = useWorkers()
  const [processingPayment, setProcessingPayment] = useState<string | null>(null)
  const [completingPayroll, setCompletingPayroll] = useState(false)

  // Filter only active workers with current contracts
  const activeWorkers = workers?.filter(worker => 
    worker.worker_status === 'active' && 
    worker.current_contract?.contract_status === 'active'
  ) || []

  const handleExecutePayment = async (workerId: string, workerName: string) => {
    setProcessingPayment(workerId)
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast({
        title: "Payment Executed",
        description: `Payment processed successfully for ${workerName}`,
      })
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setProcessingPayment(null)
    }
  }

  const handleCompletePayroll = async () => {
    setCompletingPayroll(true)
    try {
      // Simulate bulk payroll processing
      await new Promise(resolve => setTimeout(resolve, 3000))
      toast({
        title: "Payroll Completed",
        description: `Successfully processed payroll for ${activeWorkers.length} workers`,
      })
    } catch (error) {
      toast({
        title: "Payroll Failed",
        description: "Failed to complete payroll. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCompletingPayroll(false)
    }
  }

  const formatPayableAmount = (worker: any) => {
    const contract = worker.current_contract
    if (!contract) return 'N/A'

    const amount = contract.base_salary || contract.monthly_fixed_amount || contract.hourly_rate || 0
    const currency = contract.currency || 'USD'
    
    let periodLabel = ''
    if (contract.payment_period) {
      periodLabel = contract.payment_period === 'annual' ? '/year' :
                   contract.payment_period === 'monthly' ? '/month' :
                   contract.payment_period === 'hourly' ? '/hour' : ''
    }

    return `${currency} ${amount.toLocaleString()}${periodLabel}`
  }

  const getWorkerRole = (worker: any) => {
    return worker.current_contract?.job_title || 'No Role Assigned'
  }

  const getWorkerCountry = (worker: any) => {
    return worker.country || 'Not Specified'
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Active Workers Payroll
            </CardTitle>
            <Button 
              onClick={handleCompletePayroll}
              disabled={completingPayroll || activeWorkers.length === 0}
              className="gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              {completingPayroll ? 'Processing...' : 'Complete Payroll'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeWorkers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No active workers found with contracts</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Payable Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeWorkers.map((worker) => (
                  <TableRow key={worker.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {worker.full_name}
                        <Badge variant="secondary" className="text-xs">
                          {worker.current_contract?.worker_type || 'Unknown'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{getWorkerRole(worker)}</TableCell>
                    <TableCell>{getWorkerCountry(worker)}</TableCell>
                    <TableCell className="font-mono">
                      {formatPayableAmount(worker)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExecutePayment(worker.id, worker.full_name)}
                        disabled={processingPayment === worker.id}
                        className="gap-2"
                      >
                        <DollarSign className="h-3 w-3" />
                        {processingPayment === worker.id ? 'Processing...' : 'Execute Payment'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}