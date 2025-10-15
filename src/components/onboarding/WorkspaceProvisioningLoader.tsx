import { VirgilioLogo } from '@/components/VirgilioLogo'

interface WorkspaceProvisioningLoaderProps {
  status: 'creating' | 'configuring' | 'finalizing'
  className?: string
}

const STATUS_MESSAGES = {
  creating: 'Creating your workspace',
  configuring: 'Setting up your environment',
  finalizing: 'Almost ready',
}

export function WorkspaceProvisioningLoader({ status, className = '' }: WorkspaceProvisioningLoaderProps) {
  const statusText = STATUS_MESSAGES[status]
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in ${className}`}>
      <div className="flex flex-col items-center space-y-8">
        {/* Logo with pulse animation */}
        <div className="animate-pulse">
          <VirgilioLogo size="xl" />
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
