import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Link, Calendar, Hash, Type, List, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { CURRENCY_SYMBOLS } from "@/constants/currencies";
import { SalaryFieldConfig } from "@/hooks/useJobPostingFields";

interface ApplicationResponse {
  id: string;
  field_name: string;
  field_label: string;
  field_value: string | null;
  field_type: string;
  posting_id: string;
  created_at: string;
}

interface CandidateApplicationResponsesProps {
  candidateId: string;
  jobId: string;
}

const getFieldIcon = (fieldType: string) => {
  switch (fieldType) {
    case 'email':
      return <Link className="h-4 w-4" />;
    case 'date':
      return <Calendar className="h-4 w-4" />;
    case 'number':
      return <Hash className="h-4 w-4" />;
    case 'select':
    case 'radio':
      return <List className="h-4 w-4" />;
    case 'file':
      return <Upload className="h-4 w-4" />;
    case 'textarea':
      return <FileText className="h-4 w-4" />;
    default:
      return <Type className="h-4 w-4" />;
  }
};

const formatSalaryValue = (value: string | null, config: SalaryFieldConfig | null) => {
  if (!value) return "Not provided";
  const num = Number(value);
  const formatted = isNaN(num) ? value : num.toLocaleString();
  const symbol = config?.currency ? (CURRENCY_SYMBOLS[config.currency] || config.currency) : '';
  const period = config?.period ? config.period.charAt(0).toUpperCase() + config.period.slice(1) : '';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{symbol}{formatted}</span>
      {period && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{period}</Badge>}
    </span>
  );
};

const formatFieldValue = (value: string | null, fieldType: string, fieldConfig?: SalaryFieldConfig | null) => {
  if (!value) return "Not provided";
  
  if (fieldType === 'salary') return formatSalaryValue(value, fieldConfig ?? null);

  switch (fieldType) {
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'email':
      return (
        <a href={`mailto:${value}`} className="text-primary hover:underline">
          {value}
        </a>
      );
    case 'phone':
      return (
        <a href={`tel:${value}`} className="text-primary hover:underline">
          {value}
        </a>
      );
    case 'url':
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {value}
        </a>
      );
    case 'textarea':
      return (
        <div className="whitespace-pre-wrap text-sm">
          {value.length > 200 ? `${value.substring(0, 200)}...` : value}
        </div>
      );
    case 'location': {
      try {
        const loc = JSON.parse(value);
        const parts = [loc.city, loc.state, loc.country].filter(Boolean);
        return parts.join(', ') || value;
      } catch {
        return value;
      }
    }
    default:
      return value;
  }
};

import { useCoreFields } from '@/hooks/useCoreFields'

// Fields to exclude from display as they're already shown in the candidate header
const excludedFields = ['name', 'email', 'phone', 'candidate_name', 'full_name', 'contact_email', 'contact_phone'];

export const CandidateApplicationResponses: React.FC<CandidateApplicationResponsesProps> = ({
  candidateId,
  jobId,
}) => {
  const [responses, setResponses] = useState<ApplicationResponse[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<Record<string, SalaryFieldConfig>>({});
  const [loading, setLoading] = useState(true);
  const { coreFields } = useCoreFields();

  useEffect(() => {
    const fetchResponses = async () => {
      try {
        const { data, error } = await supabase
          .from('candidate_application_responses')
          .select('*')
          .eq('candidate_id', candidateId)
          .eq('job_id', jobId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        // Create exclusion set from core fields + additional excluded fields
        const coreFieldNames = new Set(coreFields.map(f => f.field_name.toLowerCase()));
        const allExcludedFields = new Set([
          ...excludedFields.map(f => f.toLowerCase()),
          ...coreFieldNames
        ]);
        
        // Filter out core fields - only show custom fields
        const filteredResponses = (data || []).filter(response => {
          return !allExcludedFields.has(response.field_name.toLowerCase());
        });

        // Fetch field_config for salary/location fields from posting fields
        const postingIds = [...new Set(filteredResponses.map(r => r.posting_id).filter(Boolean))];
        const salaryFieldNames = filteredResponses.filter(r => r.field_type === 'salary').map(r => r.field_name);
        
        if (postingIds.length > 0 && salaryFieldNames.length > 0) {
          const { data: fieldRows } = await supabase
            .from('job_posting_application_fields')
            .select('field_name, field_config')
            .in('posting_id', postingIds)
            .in('field_name', salaryFieldNames);
          
          const configMap: Record<string, SalaryFieldConfig> = {};
          (fieldRows || []).forEach((row: any) => {
            if (row.field_config) configMap[row.field_name] = row.field_config as SalaryFieldConfig;
          });
          setFieldConfigs(configMap);
        }

        setResponses(filteredResponses);
      } catch (error) {
        console.error('Error fetching application responses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResponses();
  }, [candidateId, jobId, coreFields]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job Application Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (responses.length === 0) {
    return null; // Don't show the card if there are no responses
  }

  return (
    <div className="space-y-4">
      {responses.map((response, index) => (
        <div key={response.id}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              {getFieldIcon(response.field_type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1">
                <span className="font-medium text-sm">{response.field_label}</span>
              </div>
              <div className="text-sm text-muted-foreground break-words">
                {formatFieldValue(response.field_value, response.field_type, fieldConfigs[response.field_name])}
              </div>
            </div>
          </div>
          {index < responses.length - 1 && <Separator className="mt-4" />}
        </div>
      ))}
      {responses.length === 0 && (
        <div className="text-sm text-muted-foreground">No additional application details available.</div>
      )}
    </div>
  );
};