import * as React from "react"

export interface GmailLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
}

const GmailLogo = React.forwardRef<SVGSVGElement, GmailLogoProps>(
  ({ size = 20, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fill="#4285F4" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.366l8.073-5.873C21.69 2.28 24 3.434 24 5.457z"/>
      <path fill="#34A853" d="M0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.366v7.273L1.636 21.002A1.636 1.636 0 0 1 0 19.366z"/>
      <path fill="#FBBC04" d="M12 16.64l6.545-4.91v9.273h3.819c.904 0 1.636-.732 1.636-1.636V5.457c0-2.023-2.309-3.178-3.927-1.964L12 9.366"/>
      <path fill="#EA4335" d="M12 16.64V9.366l8.073-5.873C21.69 2.28 24 3.434 24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819"/>
    </svg>
  )
)

GmailLogo.displayName = "GmailLogo"

export { GmailLogo }
export default GmailLogo
