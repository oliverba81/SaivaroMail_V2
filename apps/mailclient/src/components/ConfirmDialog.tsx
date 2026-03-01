'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface ConfirmOptions {
  /** Optional title (e.g. "Bestätigung") */
  title?: string;
  /** Main message (e.g. "Entwurf verwerfen?") */
  message: string;
  /** Label for confirm button (default: "OK") */
  confirmLabel?: string;
  /** Label for cancel button (default: "Abbrechen") */
  cancelLabel?: string;
  /** "danger" = red primary button for delete actions */
  variant?: 'default' | 'danger';
}

interface ConfirmContextType {
  /** Show confirm dialog; returns Promise<true> if OK, Promise<false> if Cancel */
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
}

interface ConfirmProviderProps {
  children: ReactNode;
}

type DialogState = ConfirmOptions & { open: boolean };

export default function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [dialog, setDialog] = useState<DialogState>({ open: false, message: '' });
  const resolveRef = useRef<(value: boolean) => void>(() => {});

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setDialog({
        open: true,
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel: opts.cancelLabel ?? 'Abbrechen',
        variant: opts.variant ?? 'default',
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current(true);
    setDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current(false);
    setDialog((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog.open && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-desc"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={handleCancel}
            aria-hidden
          />
          {/* Panel */}
          <div
            className="relative w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-black/5 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {dialog.title && (
                <h2 id="confirm-dialog-title" className="text-lg font-semibold text-[#1F2937] mb-2">
                  {dialog.title}
                </h2>
              )}
              <p id="confirm-dialog-desc" className="text-[#374151] text-sm leading-relaxed">
                {dialog.message}
              </p>
              <div className="mt-6 flex flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={
                    dialog.variant === 'danger'
                      ? 'px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors'
                      : 'px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 transition-colors'
                  }
                >
                  {dialog.confirmLabel}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#E5E7EB] focus:ring-offset-2 transition-colors"
                >
                  {dialog.cancelLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
