import gmailIcon from "@/assets/gmail-icon.png"

export function GmailLogo({ className }: { className?: string }) {
  return (
    <img 
      src={gmailIcon} 
      alt="Gmail" 
      className={className}
    />
  )
}
