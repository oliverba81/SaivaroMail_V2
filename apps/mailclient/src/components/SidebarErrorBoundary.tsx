'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SidebarErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Sidebar] Error Boundary:', error, errorInfo);
    }
    // Optional: Error-Tracking-Service (z.B. Sentry)
    // trackError(error, { component: 'Sidebar', errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div 
          style={{ 
            padding: '1rem', 
            textAlign: 'center', 
            color: '#666',
            width: '280px',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#F9FAFB',
            borderRight: '1px solid #E5E7EB'
          }}
        >
          <p style={{ marginBottom: '1rem', fontSize: '14px' }}>Fehler beim Laden der Sidebar</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#2563EB',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            aria-label="Erneut versuchen"
          >
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
