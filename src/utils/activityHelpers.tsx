import { 
  UserPlus, 
  Edit3, 
  Briefcase, 
  ArrowRight, 
  CheckCircle, 
  Mail, 
  StickyNote,
  Paperclip,
  LucideIcon
} from 'lucide-react';

export function getActivityIcon(activityType: string): React.ReactNode {
  const iconMap: Record<string, LucideIcon> = {
    'candidate_created': UserPlus,
    'candidate_profile_updated': Edit3,
    'candidate_assigned_to_job': Briefcase,
    'candidate_stage_changed': ArrowRight,
    'candidate_status_changed': CheckCircle,
    'candidate_email_sent': Mail,
    'candidate_note_added': StickyNote,
    'candidate_attachment_uploaded': Paperclip,
  };
  
  const Icon = iconMap[activityType] || Briefcase;
  return <Icon className="h-4 w-4 text-white" />;
}

export function getActivityColor(activityType: string): string {
  const colorMap: Record<string, string> = {
    'candidate_created': 'hsl(var(--success))',
    'candidate_profile_updated': 'hsl(var(--info))',
    'candidate_assigned_to_job': 'hsl(var(--primary))',
    'candidate_stage_changed': 'hsl(var(--warning))',
    'candidate_status_changed': 'hsl(var(--info))',
    'candidate_email_sent': 'hsl(var(--accent))',
    'candidate_note_added': 'hsl(var(--primary))',
    'candidate_attachment_uploaded': 'hsl(var(--success))',
  };
  
  return colorMap[activityType] || 'hsl(var(--muted))';
}
