'use client';

import { useState, useEffect } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { ValidationResult } from '@/utils/validation';

interface ValidatedInputProps {
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  validator?: (value: string) => ValidationResult;
  placeholder?: string;
  required?: boolean;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export default function ValidatedInput({
  type = 'text',
  value,
  onChange,
  onBlur,
  validator,
  placeholder,
  required = false,
  label,
  className = '',
  style = {},
  id,
}: ValidatedInputProps) {
  const [touched, setTouched] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true });

  useEffect(() => {
    if (touched && validator) {
      const result = validator(value);
      setValidation(result);
    }
  }, [value, touched, validator]);

  const handleBlur = () => {
    setTouched(true);
    if (onBlur) {
      onBlur();
    }
  };

  const showError = touched && !validation.isValid;
  const showSuccess = touched && validation.isValid && value.trim() !== '';

  // Prüfe, ob className explizit Padding enthält
  const hasExplicitPadding = className && /\b(p[xy]?-\d+|p[xy]?-[0-9.]+|py-|px-)/.test(className);
  const defaultPadding = hasExplicitPadding ? '' : 'px-3 py-1';
  const inputClasses = `w-full ${defaultPadding} border rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent h-8 ${className}`;
  const labelClasses = 'block mb-2 text-sm font-semibold text-gray-700';

  const inputStyles = {
    ...style,
    borderColor: showError ? '#dc3545' : showSuccess ? '#28a745' : '#d1d5db',
    paddingRight: showError || showSuccess ? '2.5rem' : undefined,
  };

  return (
    <div>
      {label && (
        <label className={labelClasses} htmlFor={id}>
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          className={inputClasses}
          style={inputStyles}
        />
        {showSuccess && (
          <FiCheck className="absolute right-3 top-1/2 -translate-y-1/2 text-success" size={18} />
        )}
        {showError && (
          <FiX className="absolute right-3 top-1/2 -translate-y-1/2 text-danger" size={18} />
        )}
      </div>
      {showError && validation.error && (
        <div className="mt-1 text-sm text-danger">
          {validation.error}
        </div>
      )}
    </div>
  );
}

