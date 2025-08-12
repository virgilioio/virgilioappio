import * as React from "react"

export interface GoogleLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
}

const GoogleLogo = React.forwardRef<SVGSVGElement, GoogleLogoProps>(
  ({ size = 20, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 533.5 544.3"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fill="#4285F4" d="M533.5 278.4c0-18.6-1.7-36.5-4.9-53.8H272.1v101.8h146.8c-6.3 34.1-25 63-53.3 82.3l86.1 66.8c50.3-46.4 81.8-114.9 81.8-197.1z" />
      <path fill="#34A853" d="M272.1 544.3c73.9 0 135.9-24.5 181.2-66.6l-86.1-66.8c-23.9 16-54.5 25.5-95.1 25.5-73 0-134.9-49.3-157-115.5l-90.8 70.2c45.6 90.5 139.2 153.2 247.8 153.2z" />
      <path fill="#FBBC05" d="M115.1 320.9c-10.9-32.7-10.9-68.1 0-100.8l-90.8-70.2C3.7 199.8 0 233.6 0 272S3.7 344.2 24.3 394.7l90.8-73.8z" />
      <path fill="#EA4335" d="M272.1 107.7c40.1 0 76.5 13.8 105 40.9l77.8-77.8C408 25.1 346 0 272.1 0 163.5 0 69.9 62.6 24.3 153.3l90.8 70.2c21.8-66.2 84-115.8 157-115.8z" />
    </svg>
  )
)

GoogleLogo.displayName = "GoogleLogo"

export { GoogleLogo }
export default GoogleLogo
