'use client';

import { ButtonHTMLAttributes, ReactNode, MouseEvent } from 'react';
import { Haptics } from '@/lib/haptics';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  isLoading,
  disabled,
  className = '',
  onClick,
  ...props
}: ButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    Haptics.light();
    if (onClick) onClick(e);
  };

  const base = `
    relative overflow-hidden font-medium
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.97]
    focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]
  `;

  const variants: Record<string, string> = {
    primary: `
      bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]
      text-white rounded-full
      shadow-[var(--shadow-md)]
      hover:shadow-[var(--shadow-glow)] hover:scale-[1.02]
      before:absolute before:inset-0 before:rounded-full before:bg-white before:opacity-0
      before:transition-opacity before:duration-200
      hover:before:opacity-[0.08]
    `,
    secondary: `
      bg-[var(--surface-1)] text-[var(--text-primary)]
      border border-[var(--border-primary)] rounded-full
      hover:bg-[var(--surface-2)] hover:border-[var(--border-accent)]
      hover:shadow-[var(--shadow-sm)]
    `,
    ghost: `
      bg-transparent text-[var(--text-secondary)] rounded-full
      hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]
    `,
    destructive: `
      bg-[var(--error)] text-white rounded-full
      shadow-[var(--shadow-sm)]
      hover:opacity-90 hover:shadow-md
    `,
  };

  const sizes: Record<string, string> = {
    sm: 'px-5 py-2 text-sm',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      onClick={handleClick}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Loading…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
