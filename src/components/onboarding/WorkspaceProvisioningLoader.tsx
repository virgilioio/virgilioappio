import { GoGioLogo } from '@/components/GoGioLogo'

interface WorkspaceProvisioningLoaderProps {
  status: 'creating' | 'configuring' | 'finalizing' | 'welcome'
  className?: string
}

const STATUS_MESSAGES = {
  creating: 'Creating your workspace',
  configuring: 'Setting up your environment',
  finalizing: 'Almost ready',
}

export function WorkspaceProvisioningLoader({ status, className = '' }: WorkspaceProvisioningLoaderProps) {
  // Special rendering for welcome status
  if (status === 'welcome') {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in ${className}`}>
        <div className="flex flex-col items-center space-y-8">
          <div className="animate-pulse">
            <GoGioLogo size="xl" />
          </div>
          
          <div className="text-center transition-opacity duration-300">
            <span className="font-poppins text-foreground text-xl">
              Welcome! Go and{' '}
            </span>
            <span className="font-poppins font-bold text-foreground text-xl" style={{ letterSpacing: '-0.06em' }}>
              Find your people
            </span>
            <span 
              className="font-poppins font-bold text-xl" 
              style={{ color: '#d7c5fb', letterSpacing: '-0.06em' }}
            >
              .
            </span>
          </div>
        </div>
      </div>
    )
  }
  
  const statusText = STATUS_MESSAGES[status]
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in ${className}`}>
      <div className="flex flex-col items-center space-y-8">
        {/* Logo with pulse animation */}
        <div className="animate-pulse">
          <GoGioLogo size="xl" />
        </div>
        
        {/* Status text with smooth transitions */}
        <div className="text-center transition-opacity duration-300">
          <span className="font-poppins font-bold tracking-page-title text-foreground text-xl">
            {statusText}
          </span>
          <span 
            className="font-poppins font-bold tracking-page-title text-xl" 
            style={{ color: '#d7c5fb' }}
          >
            ...
          </span>
        </div>
      </div>
    </div>
  )
}
