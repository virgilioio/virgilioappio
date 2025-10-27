import googleMeetIcon from '@/assets/google-meet-icon.png';

interface GoogleMeetLogoProps {
  className?: string;
  size?: number;
}

export function GoogleMeetLogo({ className, size = 20 }: GoogleMeetLogoProps) {
  return (
    <img
      src={googleMeetIcon}
      alt="Google Meet"
      width={size}
      height={size}
      className={className}
    />
  );
}
