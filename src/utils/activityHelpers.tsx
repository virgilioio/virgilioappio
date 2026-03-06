import { 
  UserPlus, 
  Edit3, 
  Briefcase, 
  ArrowRight, 
  CheckCircle, 
  Mail, 
  StickyNote,
  Paperclip,
  Calendar,
  Search,
  RefreshCw,
  Archive,
  Award,
  Send,
  X,
  Undo2,
  FileText,
  LucideIcon
} from 'lucide-react';

export function getActivityIcon(activityType: string): React.ReactNode {
  const iconMap: Record<string, LucideIcon> = {
    'candidate_created': UserPlus,
    'candidate_added': UserPlus,
    'candidate_profile_updated': Edit3,
    'candidate_assigned_to_job': Briefcase,
    'candidate_stage_changed': ArrowRight,
    'candidate_status_changed': CheckCircle,
    'candidate_email_sent': Mail,
    'candidate_email_received': Mail,
    'candidate_note_added': StickyNote,
    'candidate_attachment_uploaded': Paperclip,
    'interview_scheduled': Calendar,
    'sourcing_project_created': Search,
    'sourcing_project_updated': RefreshCw,
    'sourcing_project_archived': Archive,
    'scorecard_submitted': Award,
  };
  
  const Icon = iconMap[activityType] || Briefcase;
  return <Icon className="h-4 w-4 text-white" />;
}

export function getActivityColor(activityType: string): string {
  const colorMap: Record<string, string> = {
    'candidate_created': 'hsl(var(--success))',
    'candidate_added': 'hsl(var(--success))',
    'candidate_profile_updated': 'hsl(var(--info))',
    'candidate_assigned_to_job': 'hsl(var(--primary))',
    'candidate_stage_changed': 'hsl(var(--warning))',
    'candidate_status_changed': 'hsl(var(--info))',
    'candidate_email_sent': 'hsl(var(--accent))',
    'candidate_email_received': 'hsl(var(--info))',
    'candidate_note_added': 'hsl(var(--primary))',
    'candidate_attachment_uploaded': 'hsl(var(--success))',
    'interview_scheduled': 'hsl(var(--primary))',
    'sourcing_project_created': 'hsl(var(--success))',
    'sourcing_project_updated': 'hsl(var(--info))',
    'sourcing_project_archived': 'hsl(var(--muted))',
    'scorecard_submitted': 'hsl(var(--primary))',
  };
  
  return colorMap[activityType] || 'hsl(var(--muted))';
}
