
interface VirgilioLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function VirgilioLogo({ size = 'md', className = '' }: VirgilioLogoProps) {
  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
  };

  const logoSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg 
        width={logoSize} 
        height={logoSize} 
        viewBox="0 0 200 200" 
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* V lettermark */}
        <polygon 
          points="60,50 100,130 140,50 160,50 110,160 90,160 40,50" 
          fill="currentColor"
          className="text-green-500"
        />
        {/* Connecting dot */}
        <circle 
          cx="170" 
          cy="90" 
          r="12" 
          fill="currentColor"
          className="text-red-500"
        />
      </svg>
      <div className="flex flex-col">
        <span className={`font-bold text-foreground ${size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : size === 'lg' ? 'text-2xl' : 'text-3xl'}`}>
          Virgilio
        </span>
        {size !== 'sm' && (
          <span className="text-sm text-muted-foreground -mt-1">
            Connecting talent with opportunity
          </span>
        )}
      </div>
    </div>
  );
}
