import Link from 'next/link';
import { FiMessageCircle } from 'react-icons/fi';

interface LogoProps {
  size?: 'sm' | 'lg';
  href?: string;
  className?: string;
}

export default function Logo({ size = 'sm', href = '/', className = '' }: LogoProps) {
  const iconSize = size === 'lg' ? 'w-11 h-11' : 'w-8 h-8';
  const iconInner = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  const textSize = size === 'lg' ? 'text-2xl' : 'text-lg';
  const iconRadius = size === 'lg' ? 'rounded-2xl' : 'rounded-xl';

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${iconSize} ${iconRadius} bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center shadow-[var(--shadow-sm)]`}
      >
        <FiMessageCircle className={`${iconInner} text-white`} />
      </div>
      <span className={`${textSize} font-semibold tracking-tight`}>Blur</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex" aria-label="Blur — Home">
        {content}
      </Link>
    );
  }

  return content;
}
