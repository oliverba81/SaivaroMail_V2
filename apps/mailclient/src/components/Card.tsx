'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e?: React.MouseEvent) => void;
}

export default function Card({ children, className = '', onClick }: CardProps) {
  // Prüfe, ob className explizit Padding enthält (p-0, p-2, px-, py-, etc.)
  const hasExplicitPadding = className && /\b(p-\d+|p-0|px-|py-|pt-|pb-|pl-|pr-)/.test(className);
  
  // Basis-Klassen ohne Padding
  const baseClasses = 'bg-white rounded-lg shadow-sm flex flex-col';
  const clickableClasses = onClick ? 'cursor-pointer transition-all hover:shadow-md' : '';
  
  // Padding: Standard p-6, außer wenn explizit in className gesetzt
  const paddingClass = hasExplicitPadding ? '' : 'p-6';

  // Kombiniere Klassen: baseClasses, dann paddingClass, dann clickableClasses, dann className
  // className kommt zuletzt, damit es Padding überschreiben kann (z.B. p-0)
  const combinedClasses = `${baseClasses} ${paddingClass} ${clickableClasses} ${className}`.trim().replace(/\s+/g, ' ');

  return (
    <div 
      className={combinedClasses}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
