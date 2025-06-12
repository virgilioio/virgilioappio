
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

  const logoHeight = sizeMap[size];

  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src="/virgilio-logo.png" 
        alt="Virgilio"
        height={logoHeight}
        className="h-auto"
        style={{ height: `${logoHeight}px` }}
      />
    </div>
  );
}
