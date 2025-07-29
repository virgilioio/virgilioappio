import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WorkerContract } from '@/hooks/useWorkerContracts';
import { useCurrencies } from '@/hooks/useCurrencies';

interface ContractEditFormProps {
  contract: WorkerContract;
  onSave: (updatedContract: Partial<WorkerContract>) => void;
  onCancel: () => void;
}

export function ContractEditForm({ contract, onSave, onCancel }: ContractEditFormProps) {
  const { currencies } = useCurrencies();
  const [formData, setFormData] = useState({
    job_title: contract.job_title || '',
    contract_type: contract.contract_type || '',
    employment_terms: contract.employment_terms || '',
    employment_term: contract.employment_term || '',
    seniority_level: contract.seniority_level || '',
    start_date: contract.start_date || '',
    end_date: contract.end_date || '',
    working_location: contract.working_location || '',
    scope_of_work: contract.scope_of_work || '',
    currency: contract.currency || '',
    base_salary: contract.base_salary?.toString() || '',
    payment_period: contract.payment_period || '',
    payment_frequency: contract.payment_frequency || '',
    contractor_payment_type: contract.contractor_payment_type || '',
    hourly_rate: contract.hourly_rate?.toString() || '',
    monthly_fixed_amount: contract.monthly_fixed_amount?.toString() || '',
    project_details: contract.project_details || ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const updatedData: Partial<WorkerContract> = {
      job_title: formData.job_title || undefined,
      contract_type: formData.contract_type as WorkerContract['contract_type'] || undefined,
      employment_terms: formData.employment_terms as WorkerContract['employment_terms'] || undefined,
      employment_term: formData.employment_term as WorkerContract['employment_term'] || undefined,
      seniority_level: formData.seniority_level as WorkerContract['seniority_level'] || undefined,
      start_date: formData.start_date || undefined,
      end_date: formData.end_date || undefined,
      working_location: formData.working_location || undefined,
      scope_of_work: formData.scope_of_work || undefined,
      currency: formData.currency || undefined,
      base_salary: formData.base_salary ? parseFloat(formData.base_salary) : undefined,
      payment_period: formData.payment_period as WorkerContract['payment_period'] || undefined,
      payment_frequency: formData.payment_frequency as WorkerContract['payment_frequency'] || undefined,
      contractor_payment_type: formData.contractor_payment_type as WorkerContract['contractor_payment_type'] || undefined,
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined,
      monthly_fixed_amount: formData.monthly_fixed_amount ? parseFloat(formData.monthly_fixed_amount) : undefined,
      project_details: formData.project_details || undefined
    };
    
    // Remove empty strings
    Object.keys(updatedData).forEach(key => {
      if (updatedData[key as keyof typeof updatedData] === '') {
        delete updatedData[key as keyof typeof updatedData];
      }
    });
    
    onSave(updatedData);
  };

  const isEmployee = contract.worker_type === 'employee';
  const isContractor = contract.worker_type === 'contractor';

  return (
    <div className="space-y-6">
      {/* Job Information */}
      <Card>
        <CardHeader>
          <CardTitle>Job Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="job_title">Job Title</Label>
            <Input
              id="job_title"
              value={formData.job_title}
              onChange={(e) => handleInputChange('job_title', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="contract_type">Contract Type</Label>
            <Select value={formData.contract_type} onValueChange={(value) => handleInputChange('contract_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select contract type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="temporary">Temporary</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
                <SelectItem value="fixed_term">Fixed Term</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isEmployee && (
            <div>
              <Label htmlFor="employment_terms">Employment Terms</Label>
              <Select value={formData.employment_terms} onValueChange={(value) => handleInputChange('employment_terms', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employment terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="temporary">Temporary</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="employment_term">Employment Term</Label>
            <Select value={formData.employment_term} onValueChange={(value) => handleInputChange('employment_term', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select employment term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="indefinite">Indefinite</SelectItem>
                <SelectItem value="definite">Definite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="seniority_level">Seniority Level</Label>
            <Select value={formData.seniority_level} onValueChange={(value) => handleInputChange('seniority_level', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select seniority level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">Entry</SelectItem>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="principal">Principal</SelectItem>
                <SelectItem value="director">Director</SelectItem>
                <SelectItem value="vp">VP</SelectItem>
                <SelectItem value="c_level">C-Level</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contract Terms */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => handleInputChange('start_date', e.target.value)}
            />
          </div>

          {formData.employment_term === 'definite' && (
            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="working_location">Working Location</Label>
            <Input
              id="working_location"
              value={formData.working_location}
              onChange={(e) => handleInputChange('working_location', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="scope_of_work">Scope of Work</Label>
            <Textarea
              id="scope_of_work"
              value={formData.scope_of_work}
              onChange={(e) => handleInputChange('scope_of_work', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card>
        <CardHeader>
          <CardTitle>Compensation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select value={formData.currency} onValueChange={(value) => handleInputChange('currency', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEmployee && (
            <>
              <div>
                <Label htmlFor="base_salary">Base Salary</Label>
                <Input
                  id="base_salary"
                  type="number"
                  step="0.01"
                  value={formData.base_salary}
                  onChange={(e) => handleInputChange('base_salary', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="payment_period">Payment Period</Label>
                <Select value={formData.payment_period} onValueChange={(value) => handleInputChange('payment_period', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="semimonthly">Semi-monthly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment_frequency">Payment Frequency</Label>
                <Select value={formData.payment_frequency} onValueChange={(value) => handleInputChange('payment_frequency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bi_monthly">Bi-monthly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {isContractor && (
            <>
              <div>
                <Label htmlFor="contractor_payment_type">Payment Type</Label>
                <Select value={formData.contractor_payment_type} onValueChange={(value) => handleInputChange('contractor_payment_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_rate">Fixed Rate</SelectItem>
                    <SelectItem value="hourly_rate">Hourly Rate</SelectItem>
                    <SelectItem value="per_project">Per Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.contractor_payment_type === 'hourly_rate' && (
                <div>
                  <Label htmlFor="hourly_rate">Hourly Rate</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => handleInputChange('hourly_rate', e.target.value)}
                  />
                </div>
              )}

              {formData.contractor_payment_type === 'fixed_rate' && (
                <div>
                  <Label htmlFor="monthly_fixed_amount">Monthly Fixed Amount</Label>
                  <Input
                    id="monthly_fixed_amount"
                    type="number"
                    step="0.01"
                    value={formData.monthly_fixed_amount}
                    onChange={(e) => handleInputChange('monthly_fixed_amount', e.target.value)}
                  />
                </div>
              )}

              {formData.contractor_payment_type === 'per_project' && (
                <div>
                  <Label htmlFor="project_details">Project Details</Label>
                  <Textarea
                    id="project_details"
                    value={formData.project_details}
                    onChange={(e) => handleInputChange('project_details', e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}