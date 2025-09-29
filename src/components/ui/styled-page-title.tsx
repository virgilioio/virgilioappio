import { cn } from "@/lib/utils";

interface StyledPageTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function StyledPageTitle({ children, className }: StyledPageTitleProps) {
  return (
    <h1 className={cn(
      "font-poppins-black font-black tracking-page-title text-text-primary text-2xl md:text-3xl",
      className
    )}>
      {children}
      <span className="text-purple-period">.</span>
    </h1>
  );
}