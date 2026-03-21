import { cn } from "@/lib/utils";

interface StyledPageTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function StyledPageTitle({ children, className }: StyledPageTitleProps) {
  return (
    <h1 className={cn(
      "font-poppins font-bold tracking-page-title text-text-primary text-h1-mobile md:text-h1-desktop",
      className
    )}>
      {children}
      <span className="text-purple-period">.</span>
    </h1>
  );
}