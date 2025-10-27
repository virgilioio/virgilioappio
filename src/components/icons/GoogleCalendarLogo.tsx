export function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" fill="#4285F4" />
      <path
        d="M3 8h18V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2z"
        fill="#1967D2"
      />
      <rect x="7" y="2" width="2" height="4" rx="1" fill="#5F6368" />
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#5F6368" />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fill="white"
        fontSize="10"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        {new Date().getDate()}
      </text>
    </svg>
  )
}
