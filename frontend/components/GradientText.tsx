interface GradientTextProps {
  children: React.ReactNode;
  animated?: boolean;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
}

export default function GradientText({
  children,
  animated = false,
  className = '',
  as: Tag = 'span',
}: GradientTextProps) {
  return (
    <Tag className={`${animated ? 'gradient-text-animated' : 'gradient-text'} ${className}`}>
      {children}
    </Tag>
  );
}
