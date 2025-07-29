interface WorkerContractData {
  worker?: {
    full_name?: string
    worker_id?: number
    legal_first_name?: string
    legal_last_name?: string
    citizenship?: string
    country_of_residence?: string
  }
  contract?: {
    job_title?: string
    worker_type?: string
    contract_type?: string
    start_date?: string
    end_date?: string
    base_salary?: number
    currency?: string
    payment_period?: string
    working_location?: string
    scope_of_work?: string
    employment_terms?: string
    seniority_level?: string
    contract_number?: string
  }
  organization?: {
    name?: string
    department_name?: string
    manager_name?: string
  }
  countryFields?: Record<string, string>
  organizationFields?: Record<string, string>
}

export function processWorkerContractTemplate(
  templateContent: string,
  data: WorkerContractData,
  templateVersion: number = 1
): string {
  let processedContent = templateContent

  // System placeholders
  const currentDate = new Date().toLocaleDateString()
  processedContent = processedContent.replace(/{{current_date}}/g, currentDate)
  processedContent = processedContent.replace(/{{template_version}}/g, templateVersion.toString())
  processedContent = processedContent.replace(/{{contract_number}}/g, data.contract?.contract_number || 'TBD')

  // Worker placeholders
  if (data.worker) {
    processedContent = processedContent.replace(/{{worker_name}}/g, data.worker.full_name || '')
    processedContent = processedContent.replace(/{{worker_id}}/g, data.worker.worker_id?.toString() || '')
    processedContent = processedContent.replace(/{{legal_first_name}}/g, data.worker.legal_first_name || '')
    processedContent = processedContent.replace(/{{legal_last_name}}/g, data.worker.legal_last_name || '')
    processedContent = processedContent.replace(/{{citizenship}}/g, data.worker.citizenship || '')
    processedContent = processedContent.replace(/{{country_of_residence}}/g, data.worker.country_of_residence || '')
  }

  // Contract placeholders
  if (data.contract) {
    processedContent = processedContent.replace(/{{job_title}}/g, data.contract.job_title || '')
    processedContent = processedContent.replace(/{{worker_type}}/g, data.contract.worker_type || '')
    processedContent = processedContent.replace(/{{contract_type}}/g, data.contract.contract_type || '')
    processedContent = processedContent.replace(/{{start_date}}/g, data.contract.start_date || '')
    processedContent = processedContent.replace(/{{end_date}}/g, data.contract.end_date || '')
    processedContent = processedContent.replace(/{{base_salary}}/g, data.contract.base_salary?.toString() || '')
    processedContent = processedContent.replace(/{{currency}}/g, data.contract.currency || '')
    processedContent = processedContent.replace(/{{payment_period}}/g, data.contract.payment_period || '')
    processedContent = processedContent.replace(/{{working_location}}/g, data.contract.working_location || '')
    processedContent = processedContent.replace(/{{scope_of_work}}/g, data.contract.scope_of_work || '')
    processedContent = processedContent.replace(/{{employment_terms}}/g, data.contract.employment_terms || '')
    processedContent = processedContent.replace(/{{seniority_level}}/g, data.contract.seniority_level || '')
  }

  // Organization placeholders
  if (data.organization) {
    processedContent = processedContent.replace(/{{organization_name}}/g, data.organization.name || '')
    processedContent = processedContent.replace(/{{department_name}}/g, data.organization.department_name || '')
    processedContent = processedContent.replace(/{{manager_name}}/g, data.organization.manager_name || '')
  }

  // Country compliance field placeholders
  if (data.countryFields) {
    Object.entries(data.countryFields).forEach(([fieldName, value]) => {
      const placeholder = new RegExp(`{{country_${fieldName}}}`, 'g')
      processedContent = processedContent.replace(placeholder, value || '')
    })
  }

  // Organization compliance field placeholders
  if (data.organizationFields) {
    Object.entries(data.organizationFields).forEach(([fieldName, value]) => {
      const placeholder = new RegExp(`{{org_${fieldName}}}`, 'g')
      processedContent = processedContent.replace(placeholder, value || '')
    })
  }

  return processedContent
}

export function generateWorkerContractTitle(
  worker: { full_name?: string }, 
  contract: { job_title?: string }
): string {
  return `Employment Contract - ${worker.full_name || 'Worker'} - ${contract.job_title || 'Position'}`
}

export function validateWorkerContractData(
  data: WorkerContractData, 
  requiredFields: string[]
): string[] {
  const errors: string[] = []
  
  requiredFields.forEach(field => {
    const fieldPath = field.split('.')
    let value: any = data
    
    for (const path of fieldPath) {
      value = value?.[path]
    }
    
    if (!value) {
      errors.push(`${field} is required`)
    }
  })
  
  return errors
}