import googleCalendarIcon from "@/assets/google-calendar-icon.png"

export function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <img 
      src={googleCalendarIcon} 
      alt="Google Calendar" 
      className={className}
    />
  )
}
