'use client';

import { ReactNode } from 'react';
import { FiX } from 'react-icons/fi';

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when overlay is clicked or close button is used */
  onClose: () => void;
  /** Optional title shown in the header */
  title?: string;
  /** Modal content */
  children: ReactNode;
  /** Max width: 'sm' | 'md' | 'lg' (default: md) */
  maxWidth?: 'sm' | 'md' | 'lg';
  /** Optional class for the panel */
  className?: string;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/**
 * Gemeinsame Modal-Basis: Backdrop + Panel mit modernem Stil.
 * Verhindert Klick-Durchgang auf den Inhalt (stopPropagation).
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  className = '',
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className={`relative w-full ${maxWidthClasses[maxWidth]} rounded-xl bg-white shadow-2xl ring-1 ring-black/5 transition-all ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
            <h2 id="modal-title" className="text-lg font-semibold text-[#1F2937]">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937] transition-colors"
              aria-label="Schließen"
            >
              <FiX size={20} />
            </button>
          </div>
        ) : null}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
