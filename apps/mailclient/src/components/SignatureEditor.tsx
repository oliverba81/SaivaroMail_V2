'use client';

import { useEffect, useRef, useMemo, useId, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMCEEditor } from 'tinymce';
import { isEmptyEditorHtml } from '@/utils/signature-placeholders';

export interface SignatureEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  /** Wenn true, setzt den Fokus beim Mount auf das Ende des Editors (z. B. für Reply-Tab). */
  focusOnMount?: boolean;
  /** Wenn true, Fokus setzen (z. B. wenn Reply-Tab wieder aktiv wird). Bei Wechsel von false zu true wird fokussiert. */
  focusTrigger?: boolean;
}

export default function SignatureEditor({
  value,
  onChange,
  placeholder = 'Signatur (HTML)',
  disabled = false,
  minHeight = '120px',
  focusOnMount = false,
  focusTrigger = false,
}: SignatureEditorProps) {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const focusOnMountDoneRef = useRef(false);
  const prevFocusTriggerRef = useRef(false);
  const hasSyncedFromPropRef = useRef(false);
  const editorId = useId();

  const minHeightNum = parseInt(minHeight, 10) || 120;
  const apiKey = typeof process.env.NEXT_PUBLIC_TINYMCE_API_KEY === 'string' ? process.env.NEXT_PUBLIC_TINYMCE_API_KEY : '';
  const init = useMemo(
    () => ({
      placeholder,
      min_height: minHeightNum,
      max_height: 800,
      content_style: 'body { font-family: inherit; font-size: 14px; line-height: 1.6; }',
      plugins: 'lists link image code table advlist',
      toolbar:
        'undo redo | fontsize | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image | table | code',
      font_size_formats: '10px 11px 12px 14px 16px 18px 20px 24px 28px 32px',
      link_default_target: '_blank',
      link_assume_external_targets: 'https',
      rel_list: [{ title: 'Keine', value: '' }, { title: 'noopener', value: 'noopener' }],
      branding: false,
      promotion: false,
      resize: true,
      menubar: false,
      statusbar: true,
      contextmenu: 'link image table',
    }),
    [placeholder, minHeightNum]
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !focusOnMount || focusOnMountDoneRef.current || disabled) return;
    focusOnMountDoneRef.current = true;
    requestAnimationFrame(() => {
      try {
        editor.focus();
      } catch {
        // Editor might not be ready
      }
    });
  }, [focusOnMount, disabled]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    const trigger = focusTrigger === true;
    if (trigger && !prevFocusTriggerRef.current) {
      prevFocusTriggerRef.current = true;
      requestAnimationFrame(() => {
        try {
          editor.focus();
        } catch {
          // Editor might not be ready
        }
      });
    }
    if (!trigger) prevFocusTriggerRef.current = false;
  }, [focusTrigger, disabled]);

  // Wenn sich value von außen ändert (z. B. Signatur-Einblendung), Inhalt im Editor setzen.
  // TinyMCE übernimmt value-Änderungen nach dem ersten Render oft nicht – daher explizit setContent.
  useEffect(() => {
    if (!editorReady || disabled) return;
    const editor = editorRef.current;
    if (!editor) return;
    const target = value ?? '';
    const current = editor.getContent();
    const willSet = current !== target;
    if (willSet) {
      editor.setContent(target, { no_events: true });
      hasSyncedFromPropRef.current = true;
    }
  }, [value, disabled, editorReady]);

  return (
    <div
      className="signature-editor-wrap w-full rounded-lg overflow-hidden bg-white text-sm transition-[box-shadow,border-color] focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0"
      style={{ minHeight }}
    >
      <Editor
        apiKey={apiKey || undefined}
        value={value || ''}
        onEditorChange={(newValue) => {
          // Verhindern, dass der initial leere Editor-Inhalt die Signatur im Parent überschreibt (nur vor erstem Sync)
          if (
            !hasSyncedFromPropRef.current &&
            isEmptyEditorHtml(newValue ?? '') &&
            !isEmptyEditorHtml(value ?? '')
          ) {
            return;
          }
          onChange(newValue);
        }}
        onInit={(_evt, editor) => {
          editorRef.current = editor;
          setEditorReady(true);
        }}
        init={init}
        disabled={disabled}
        id={editorId}
      />
    </div>
  );
}
