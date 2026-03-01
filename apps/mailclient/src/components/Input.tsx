'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className = '', ...props }: InputProps) {
  // Prüfe, ob className explizit Padding enthält
  const hasExplicitPadding = className && /\b(p[xy]?-\d+|p[xy]?-[0-9.]+|py-|px-)/.test(className);
  const defaultPadding = hasExplicitPadding ? '' : 'px-3 py-1';
  const inputClasses = `w-full ${defaultPadding} border border-gray-300 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent h-8 ${className}`;
  const labelClasses = 'block mb-2 text-sm font-semibold text-gray-700';

  if (label) {
    return (
      <div>
        <label className={labelClasses} htmlFor={props.id}>
          {label}
        </label>
        <input className={inputClasses} {...props} />
      </div>
    );
  }

  return <input className={inputClasses} {...props} />;
}

