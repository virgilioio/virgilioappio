import { createRoot } from 'react-dom/client'
import './index.css'
import { GioFitExportDialog, type DossierExportOptions } from '@/components/candidates/insights/dossier/GioFitExportDialog'
import type { DossierPrintProps } from '@/components/candidates/insights/dossier/DossierPrintDocument'
import type { FitAnalysis } from '@/hooks/useCandidateFitInsights'

const analysis = {
  profile_summary:
    'Lena Park has spent nine years selling advisory services into mid-market financial institutions, most recently leading a team of four at Northgate Advisory where she carried a 3.2M quota and closed 118% of it in her last full year.',
  executive_summary:
    'Strongest signal: she has closed advisory retainers at the exact deal size this role carries. Biggest risk: no evidence of managing a named-account motion, which costs her 6 points on Role & Title Fit.',
  confidence: 'high',
  dimensions: [
    { name: 'Skills Alignment', weight: 30, score: 84, matches: ['Consultative selling across 6–9 month cycles', 'Built and ran her own outbound sequences'], gaps: ['No mention of MEDDPICC or a named qualification framework'], insight: 'Her pipeline discipline is described in her own words rather than a framework.' },
    { name: 'Experience Level', weight: 20, score: 88, matches: ['Nine years, all in advisory or professional services'], gaps: [] },
    { name: 'Role & Title Fit', weight: 15, score: 70, matches: ['Enterprise AE title since 2021'], gaps: ['No named-account ownership described'] },
    { name: 'Location Compatibility', weight: 10, score: 95, matches: ['Mexico City, matching the role'], gaps: [] },
    { name: 'Salary Alignment', weight: 10, score: null, matches: [], gaps: [] },
    { name: 'Language & Communication', weight: 10, score: 90, matches: ['Spanish and English CVs both on file'], gaps: [] },
    { name: 'Company Pedigree', weight: 5, score: 78, matches: ['Northgate Advisory, Deloitte alumni'], gaps: [] },
  ],
  validation_points: [
    { question: 'Has she carried a named-account list before?', reason: 'Role & Title Fit is the lowest scored dimension and rests on a single title.', priority: 'high', suggested_stage: 'Screening call' },
    { question: 'What is her expected base?', reason: 'No compensation data on file, so the salary dimension is excluded from the score.', priority: 'medium', suggested_stage: 'Screening call' },
  ],
  detected_languages: { summary: 'Mixed', confidence: 'high', sources: [{ label: 'Resume', code: 'es', name: 'Spanish' }, { label: 'LinkedIn', code: 'en', name: 'English' }] },
} as unknown as FitAnalysis

const buildData = (options: DossierExportOptions): DossierPrintProps => ({
  analysis,
  score: 84,
  candidateName: 'Lena Park',
  roleLine: 'Enterprise Account Executive at Northgate Advisory',
  jobTitle: 'Account Executive · Enterprise Advisory',
  location: 'Mexico City, Mexico',
  contactItems: ['lena.park@example.com', '+52 55 1234 5678', 'linkedin.com/in/lenapark'],
  requiredSkills: ['Consultative selling', 'Pipeline management', 'MEDDPICC', 'Advisory services'],
  candidateSkills: ['Consultative selling', 'Pipeline management', 'Advisory services', 'Outbound prospecting', 'Forecasting'],
  workExperience: [
    { id: '1', job_title: 'Enterprise Account Executive', company_name: 'Northgate Advisory', start_date: '2021-03-01', end_date: null, is_current: true, location: 'Mexico City', description: 'Carried a 3.2M advisory quota across financial services accounts.' },
  ] as never,
  education: [{ id: '1', degree_type: 'BBA', field_of_study: 'Business', institution_name: 'ITAM', end_date: '2014-06-01' }] as never,
  outputLanguageName: 'English',
  preparedBy: 'Virgilio',
  preparedOn: '18 September 2026',
  ...options,
})

createRoot(document.getElementById('root')!).render(
  <GioFitExportDialog
    open
    onOpenChange={() => {}}
    defaultClientReady={false}
    hasContactDetails
    candidateName="Lena Park"
    jobTitle="Account Executive · Enterprise Advisory"
    outputLanguageName="English"
    buildData={buildData}
  />,
)
