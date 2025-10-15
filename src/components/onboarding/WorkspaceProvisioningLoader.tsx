import { VirgilioLogo } from '@/components/VirgilioLogo'

interface WorkspaceProvisioningLoaderProps {
  status: 'creating' | 'configuring' | 'finalizing'
}

const STATUS_MESSAGES = {
  creating: 'Creating your workspace',
  configuring: 'Setting up your environment',
  finalizing: 'Almost ready',
}

export function WorkspaceProvisioningLoader({ status }: WorkspaceProvisioningLoaderProps) {
  const statusText = STATUS_MESSAGES[status]
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-8">
        {/* Logo with pulse animation */}
        <div className="animate-pulse">
          <VirgilioLogo size="xl" />
        </div>
        
        {/* Status text with custom typography */}
        <div className="text-center">
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
