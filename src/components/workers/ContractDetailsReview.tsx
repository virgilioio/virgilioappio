import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Briefcase, DollarSign } from "lucide-react";

interface ContractDetailsReviewProps {
  worker: any;
  contract: any;
  contractType: 'cor' | 'eor' | 'direct';
  onComplete: (details: any) => void;
  onCancel: () => void;
}

export function ContractDetailsReview({ 
  worker, 
  contract, 
  contractType, 
  onComplete, 
  onCancel 
}: ContractDetailsReviewProps) {
  const [formData, setFormData] = useState({
    // Personal Information
    full_name: worker?.full_name || '',
    legal_first_name: worker?.legal_first_name || '',
    legal_last_name: worker?.legal_last_name || '',
    citizenship: worker?.citizenship || '',
    personal_email: worker?.personal_email || '',
    work_email: worker?.work_email || '',
    personal_phone: worker?.personal_phone || '',
    country: worker?.country || '',
    state_province: worker?.state_province || '',
    
    // Employment Details
    job_title: contract?.job_title || worker?.current_contract?.job_title || '',
    seniority_level: contract?.seniority_level || worker?.current_contract?.seniority_level || 'mid',
    working_location: contract?.working_location || worker?.current_contract?.working_location || '',
    scope_of_work: contract?.scope_of_work || worker?.current_contract?.scope_of_work || '',
    start_date: contract?.start_date || worker?.current_contract?.start_date || '',
    end_date: contract?.end_date || worker?.current_contract?.end_date || '',
    
    // Compensation
    currency: contract?.currency || worker?.current_contract?.currency || 'USD',
    base_salary: contract?.base_salary || worker?.current_contract?.base_salary || '',
    payment_period: contract?.payment_period || worker?.current_contract?.payment_period || 'monthly',
    employment_terms: contract?.employment_terms || worker?.current_contract?.employment_terms || 'full_time',
    
    // Contract Specifics
    worker_type: contractType === 'eor' ? 'employee' : 'contractor',
    contract_type: contractType === 'eor' ? 'permanent' : 'freelance',
    employment_term: 'indefinite'
  });

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleContinue = () => {
    onComplete(formData);
  };

  const isFormValid = () => {
    return formData.full_name && 
           formData.legal_first_name && 
           formData.legal_last_name && 
           formData.job_title && 
           formData.base_salary;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Review Contract Details</h3>
        <p className="text-muted-foreground">
          Review and edit the contract details for {worker?.full_name}. 
          Make sure all information is accurate before proceeding.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Worker's personal details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => updateFormData('full_name', e.target.value)}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="citizenship">Citizenship</Label>
                <Input
                  id="citizenship"
                  value={formData.citizenship}
                  onChange={(e) => updateFormData('citizenship', e.target.value)}
                  placeholder="Enter citizenship"
                />
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legal_first_name">Legal First Name *</Label>
                <Input
                  id="legal_first_name"
                  value={formData.legal_first_name}
                  onChange={(e) => updateFormData('legal_first_name', e.target.value)}
                  placeholder="Enter legal first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_last_name">Legal Last Name *</Label>
                <Input
                  id="legal_last_name"
                  value={formData.legal_last_name}
                  onChange={(e) => updateFormData('legal_last_name', e.target.value)}
                  placeholder="Enter legal last name"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="personal_email">Personal Email</Label>
                <Input
                  id="personal_email"
                  type="email"
                  value={formData.personal_email}
                  onChange={(e) => updateFormData('personal_email', e.target.value)}
                  placeholder="Enter personal email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_email">Work Email</Label>
                <Input
                  id="work_email"
                  type="email"
                  value={formData.work_email}
                  onChange={(e) => updateFormData('work_email', e.target.value)}
                  placeholder="Enter work email"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Employment Details
            </CardTitle>
            <CardDescription>
              Job title, role, and working arrangements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title *</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => updateFormData('job_title', e.target.value)}
                  placeholder="Enter job title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seniority_level">Seniority Level</Label>
                <Select value={formData.seniority_level} onValueChange={(value) => updateFormData('seniority_level', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select seniority level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry Level</SelectItem>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="mid">Mid Level</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="principal">Principal</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="vp">VP</SelectItem>
                    <SelectItem value="c_level">C-Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="working_location">Working Location</Label>
                <Input
                  id="working_location"
                  value={formData.working_location}
                  onChange={(e) => updateFormData('working_location', e.target.value)}
                  placeholder="Enter working location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employment_terms">Employment Terms</Label>
                <Select value={formData.employment_terms} onValueChange={(value) => updateFormData('employment_terms', value)}>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope_of_work">Scope of Work</Label>
              <Textarea
                id="scope_of_work"
                value={formData.scope_of_work}
                onChange={(e) => updateFormData('scope_of_work', e.target.value)}
                placeholder="Describe the scope of work and responsibilities"
                rows={3}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => updateFormData('start_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date (if applicable)</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => updateFormData('end_date', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compensation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Compensation Details
            </CardTitle>
            <CardDescription>
              Salary, payment terms, and currency information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="base_salary">Base Salary *</Label>
                <Input
                  id="base_salary"
                  type="number"
                  value={formData.base_salary}
                  onChange={(e) => updateFormData('base_salary', e.target.value)}
                  placeholder="Enter base salary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={formData.currency} onValueChange={(value) => updateFormData('currency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_period">Payment Period</Label>
                <Select value={formData.payment_period} onValueChange={(value) => updateFormData('payment_period', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleContinue}
          disabled={!isFormValid()}
        >
          Continue to Preview
        </Button>
      </div>
    </div>
  );
}