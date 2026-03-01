'use client';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'list';
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Skeleton({
  variant = 'rectangular',
  width,
  height,
  className = '',
  style = {},
}: SkeletonProps) {
  const baseStyle: React.CSSProperties = {
    backgroundColor: '#e0e0e0',
    borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? '4px' : '8px',
    animation: 'pulse 1.5s ease-in-out infinite',
    ...style,
  };

  if (width) {
    baseStyle.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height) {
    baseStyle.height = typeof height === 'number' ? `${height}px` : height;
  }

  return <div className={className} style={baseStyle} aria-busy="true" aria-live="polite" />;
}

// Spezielle Skeleton-Komponenten
export function SkeletonCard() {
  return (
    <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
      <Skeleton variant="rectangular" height={24} width="60%" style={{ marginBottom: '1rem' }} />
      <Skeleton variant="text" height={16} width="100%" style={{ marginBottom: '0.5rem' }} />
      <Skeleton variant="text" height={16} width="80%" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderBottom: '1px solid #e9ecef' }}>
          <Skeleton variant="circular" width={40} height={40} />
          <div style={{ flex: 1 }}>
            <Skeleton variant="text" height={16} width="40%" style={{ marginBottom: '0.5rem' }} />
            <Skeleton variant="text" height={14} width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div style={{ padding: '1.5rem' }}>
      <Skeleton variant="text" height={16} width="30%" style={{ marginBottom: '0.75rem' }} />
      <Skeleton variant="rectangular" height={40} width="100%" style={{ marginBottom: '1.5rem' }} />
      <Skeleton variant="text" height={16} width="30%" style={{ marginBottom: '0.75rem' }} />
      <Skeleton variant="rectangular" height={40} width="100%" style={{ marginBottom: '1.5rem' }} />
      <Skeleton variant="text" height={16} width="30%" style={{ marginBottom: '0.75rem' }} />
      <Skeleton variant="rectangular" height={100} width="100%" style={{ marginBottom: '1.5rem' }} />
      <Skeleton variant="rectangular" height={40} width="150px" />
    </div>
  );
}



