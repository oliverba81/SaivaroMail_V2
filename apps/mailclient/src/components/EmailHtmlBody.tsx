'use client';

interface EmailHtmlBodyProps {
  html: string;
  isHtml: boolean;
}

export default function EmailHtmlBody({ html, isHtml }: EmailHtmlBodyProps) {
  if (!isHtml) {
    return <>{html}</>;
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

