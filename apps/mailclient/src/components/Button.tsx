'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  children,
  className = '',
  ...props
}, ref) => {
  const variantClasses = {
    primary: 'bg-primary hover:bg-primary-hover text-white',
    secondary: 'bg-secondary hover:bg-secondary-hover text-white',
    danger: 'bg-danger hover:bg-danger-hover text-white',
    success: 'bg-success hover:bg-success-hover text-white',
    warning: 'bg-warning hover:bg-warning-hover text-gray-800',
  };

  // Prüfe, ob className explizit Padding oder Höhe enthält
  const hasExplicitPadding = className && /\b(p[xy]?-\d+|p[xy]?-[0-9.]+|py-|px-)/.test(className);
  const hasExplicitHeight = className && /\b(h-\d+|h-[0-9.]+|min-h-|max-h-)/.test(className);
  
  // Standard-Padding: px-3 py-1 für kompakte Buttons (wie Spam-Button)
  const defaultPadding = hasExplicitPadding ? '' : 'px-3 py-1';
  // Feste Höhe für Konsistenz (entspricht px-3 py-1 mit text-sm), außer wenn explizit überschrieben
  const defaultHeight = hasExplicitHeight ? '' : 'h-8';

  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 ${defaultPadding} ${defaultHeight} rounded-md text-sm font-medium cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;

