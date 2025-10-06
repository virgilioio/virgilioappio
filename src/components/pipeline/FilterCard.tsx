import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface FilterCardProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  jobStatus: string;
  onJobStatusChange: (value: string) => void;
  selectedUsers: string[];
  onSelectedUsersChange: (users: string[]) => void;
  userOptions: { value: string; label: string }[];
  showUserFilter: boolean;
}

export function FilterCard({
  searchTerm,
  onSearchChange,
  jobStatus,
  onJobStatusChange,
  selectedUsers,
  onSelectedUsersChange,
  userOptions,
  showUserFilter,
}: FilterCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="border" style={{ borderColor: '#0d0d09' }}>
      <CardContent className="pt-6">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          {/* Always Visible Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Input
              placeholder="Search by job title..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={jobStatus} onValueChange={onJobStatusChange}>
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue placeholder="Job Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            {showUserFilter && userOptions.length > 0 && (
              <MultiSelect
                options={userOptions}
                selectedValues={selectedUsers}
                onSelectionChange={onSelectedUsersChange}
                placeholder="Filter by user..."
                className="sm:w-[220px]"
              />
            )}
            <div className="ml-auto">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  Advanced
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Advanced Filters (Collapsed by default) */}
          <CollapsibleContent className="pt-4 space-y-3">
            <div className="border-t pt-4" style={{ borderColor: '#0d0d09' }}>
              <p className="text-sm text-muted-foreground mb-3">
                Additional filters coming soon...
              </p>
              {/* Placeholder for future filters:
                - Date range filter
                - Department/Team filter
                - Location filter
                - Salary range filter
              */}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
