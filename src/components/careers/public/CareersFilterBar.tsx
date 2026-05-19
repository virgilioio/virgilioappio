import { Search } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  search: string
  onSearch: (v: string) => void
  department: string
  onDepartment: (v: string) => void
  location: string
  onLocation: (v: string) => void
  type: string
  onType: (v: string) => void
  departments: string[]
  locations: string[]
  types: string[]
}

export function CareersFilterBar(p: Props) {
  return (
    <div className="border-b border-black/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B8F9E]" />
          <input
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Search by role, team, or keyword"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-black/10 text-[13px] placeholder:text-[#8B8F9E] focus:outline-none focus:ring-2 focus:ring-virgilio-purple/30"
          />
        </div>

        <FilterSelect value={p.department} onChange={p.onDepartment} label="Department" options={p.departments} />
        <FilterSelect value={p.location} onChange={p.onLocation} label="Location" options={p.locations} />
        <FilterSelect value={p.type} onChange={p.onType} label="Type" options={p.types} />

        <div className="ml-auto text-[12px] text-[#5a6072]">
          Sorted by <span className="font-medium text-[#0d0d09]">most recent</span>
        </div>
      </div>
    </div>
  )
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[140px] bg-white border-black/10 text-[13px]">
        <SelectValue placeholder={`${label}: Any`}>
          {value === 'all' ? `${label}: Any` : `${label}: ${value}`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: Any</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
