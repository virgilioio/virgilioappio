import { Plus } from 'lucide-react'

interface Props {
  onClick: () => void
}

export function AddWidgetTile({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="col-span-4 min-h-[132px] rounded-[14px] border border-dashed border-[#D8D5CC] hover:border-[#6F3FF5] bg-transparent hover:bg-[#FAF8FF] transition-colors flex flex-col items-center justify-center gap-2 text-[#5A6072] hover:text-[#5B21B6] group"
    >
      <span className="h-8 w-8 rounded-full bg-[#F1F0EC] group-hover:bg-[#EDE4FF] flex items-center justify-center transition-colors">
        <Plus size={16} />
      </span>
      <span className="font-poppins font-semibold text-[12.5px]">Add widget</span>
    </button>
  )
}
