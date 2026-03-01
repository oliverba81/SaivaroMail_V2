'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class StorageUsageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[StorageUsage] Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>Fehler beim Laden der Speicherplatz-Informationen</h3>
          <p style={{ color: '#666', marginTop: '1rem' }}>
            Die Speicherplatz-Daten konnten nicht geladen werden.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{ marginTop: '1rem' }}
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



