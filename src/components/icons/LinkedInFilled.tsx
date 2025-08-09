import * as React from 'react'

export interface IconProps extends React.SVGProps<SVGSVGElement> {}

export const LinkedInFilled = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.024-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.941v5.665H9.352V9.5h3.414v1.493h.049c.476-.9 1.637-1.852 3.37-1.852 3.604 0 4.268 2.372 4.268 5.455v5.856zM5.337 8.008a2.062 2.062 0 11-.001-4.124 2.062 2.062 0 010 4.124zM6.813 20.452H3.562V9.5h3.251v10.952zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.543C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.271V1.729C24 .774 23.2 0 22.225 0z"
      />
    </svg>
  )
)
LinkedInFilled.displayName = 'LinkedInFilled'

export default LinkedInFilled
