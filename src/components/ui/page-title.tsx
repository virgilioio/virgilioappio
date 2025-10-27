import { cn } from "@/lib/utils";

interface PageTitleProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

export function PageTitle({ children, className, as = 'h1' }: PageTitleProps) {
  const Component = as;
  
  const sizeClasses = {
    h1: 'text-h1-mobile md:text-h1-desktop',
    h2: 'text-h2-mobile md:text-h2-desktop',
    h3: 'text-h3-mobile md:text-h3-desktop',
    h4: 'text-h4-mobile md:text-h4-desktop',
  };
  
  return (
    <Component className={cn(
      "font-poppins font-bold tracking-page-title text-virgilio-text",
      sizeClasses[as],
      className
    )}>
      {children}
      <span className="text-purple-period">.</span>
    </Component>
  );
}
