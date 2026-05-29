import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  variant?: 'surface' | 'spotlight';
}

export default function Card({
  children,
  className = '',
  hover = false,
  variant = 'surface',
}: CardProps) {
  const base = `
    rounded-2xl
    border
    transition-all duration-300
  `;

  const variants: Record<string, string> = {
    surface: `
      bg-[var(--surface-1)]
      border-[var(--border-primary)]
      shadow-[var(--shadow-sm)]
      ${hover ? 'hover:shadow-[var(--shadow-md)] hover:border-[var(--border-accent)] hover:scale-[1.01] cursor-pointer' : ''}
    `,
    spotlight: `
      bg-gradient-to-br from-[var(--accent-primary)] to-[var(--gradient-coral)]
      border-transparent
      shadow-[var(--shadow-glow)]
      text-white
      ${hover ? 'hover:shadow-[var(--shadow-glow-strong)] hover:scale-[1.02] cursor-pointer' : ''}
    `,
  };

  return (
    <div className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
