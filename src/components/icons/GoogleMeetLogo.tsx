interface GoogleMeetLogoProps {
  className?: string;
  size?: number;
}

export function GoogleMeetLogo({ className, size = 20 }: GoogleMeetLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 87.5 72"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="m49.5 36 8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z"
        fill="#00832d"
      />
      <path
        d="m0 51.5v-31c0-3.589 2.911-6.5 6.5-6.5h50.96l-11.46 8.16v31.68l11.46 8.16h-50.96c-3.589 0-6.5-2.911-6.5-6.5z"
        fill="#0066da"
      />
      <path d="m60 14h1.48l9.52 7.33v29.34l-9.52 7.33h-1.48z" fill="#e94235" />
      <path
        d="m71 20.33v31.34l-11-7.17v-16.83z"
        fill="#2684fc"
      />
      <path
        d="m80 20.67-5 5.33h4z"
        fill="#00ac47"
      />
      <path
        d="m69.5 36.08 8.53 9.75 9.47 6.17v-23.5l-10 10.83z"
        fill="#00ac47"
      />
      <path
        d="m87.5 28.5v15l-9.55-7.5z"
        fill="#ffba00"
      />
    </svg>
  );
}
