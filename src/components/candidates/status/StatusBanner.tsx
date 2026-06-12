import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusBannerTone = 'offer' | 'hired' | 'rejected';

interface StatusBannerProps {
  tone: StatusBannerTone;
  icon: LucideIcon;
  eyebrow: string;
  meta?: string;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const tones: Record<StatusBannerTone, {
  container: string;
  containerStyle?: React.CSSProperties;
  iconChip: string;
  iconColor: string;
  eyebrow: string;
  metaColor: string;
  titleColor: string;
  period: string;
  subColor: string;
  shadow: string;
  border: string;
}> = {
  offer: {
    container: 'text-[#fffcf9]',
    containerStyle: { backgroundColor: '#0d0d09' },
    iconChip: 'bg-[rgba(255,252,249,0.12)]',
    iconColor: 'text-[#fffcf9]',
    eyebrow: 'text-[#D7C5FB]',
    metaColor: 'text-[#fffcf9]/55',
    titleColor: 'text-[#fffcf9]',
    period: 'text-[#D7C5FB]',
    subColor: 'text-[#fffcf9]/72',
    shadow: 'shadow-[0_8px_24px_-8px_rgba(13,13,9,0.22)]',
    border: '',
  },
  hired: {
    container: 'text-[#fffcf9]',
    containerStyle: { backgroundColor: '#0B6E4F' },
    iconChip: 'bg-[rgba(255,252,249,0.14)]',
    iconColor: 'text-[#fffcf9]',
    eyebrow: 'text-[#86EFAC]',
    metaColor: 'text-[#fffcf9]/55',
    titleColor: 'text-[#fffcf9]',
    period: 'text-[#86EFAC]',
    subColor: 'text-[#fffcf9]/75',
    shadow: 'shadow-[0_8px_24px_-8px_rgba(11,110,79,0.35)]',
    border: '',
  },
  rejected: {
    container: 'text-[#0d0d09]',
    containerStyle: { backgroundColor: '#FBF1F0' },
    iconChip: 'bg-[#FEE2E2]',
    iconColor: 'text-[#B91C1C]',
    eyebrow: 'text-[#B91C1C]',
    metaColor: 'text-[#5A6072]',
    titleColor: 'text-[#0d0d09]',
    period: 'text-[#D7C5FB]',
    subColor: 'text-[#5A6072]',
    shadow: 'shadow-[0_1px_2px_rgba(13,13,9,0.04)]',
    border: 'border border-[#F3D9D6]',
  },
};

export function StatusBanner({
  tone,
  icon: Icon,
  eyebrow,
  meta,
  title,
  sub,
  actions,
  className,
}: StatusBannerProps) {
  const t = tones[tone];
  return (
    <div
      style={{ borderRadius: 14, padding: '14px 20px', ...t.containerStyle }}
      className={cn(
        'flex items-center gap-4 w-full',
        t.container,
        t.shadow,
        t.border,
        className,
      )}
    >
      <div
        className={cn('shrink-0 flex items-center justify-center', t.iconChip)}
        style={{ width: 40, height: 40, borderRadius: 10 }}
      >
        <Icon className={cn('h-[18px] w-[18px]', t.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1.5 leading-none">
          <span
            className={cn(
              'font-inter font-semibold uppercase',
              t.eyebrow,
            )}
            style={{ fontSize: 10.5, letterSpacing: '0.08em' }}
          >
            {eyebrow}
          </span>
          {meta && (
            <>
              <span
                className={cn('inline-block rounded-full', t.metaColor)}
                style={{ width: 3, height: 3, backgroundColor: 'currentColor' }}
              />
              <span
                className={cn('font-inter', t.metaColor)}
                style={{ fontSize: 10.5 }}
              >
                {meta}
              </span>
            </>
          )}
        </p>
        <p
          className={cn('font-poppins font-semibold mt-1.5 truncate', t.titleColor)}
          style={{ fontSize: 16, letterSpacing: '-0.02em', lineHeight: 1.25 }}
        >
          {title}
          <span className={t.period}>.</span>
        </p>
        {sub && (
          <p
            className={cn('font-inter mt-1 line-clamp-2', t.subColor)}
            style={{ fontSize: 12, lineHeight: 1.45 }}
          >
            {sub}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
