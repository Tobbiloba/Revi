import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  revi: any;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

class ReviErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const errorId = this.props.revi.captureException(error, {
      level: 'error',
      tags: { component: 'ErrorBoundary' },
      extra: {
        errorInfo,
        componentStack: errorInfo.componentStack
      }
    });

    this.setState({ errorId });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong!</h2>
          <p>An error occurred in the React component tree and has been captured by Revi Monitor.</p>
          {this.state.errorId && (
            <p>Error ID: <span className="code">{this.state.errorId}</span></p>
          )}
          {this.state.error && (
            <details>
              <summary>Error Details</summary>
              <pre>{this.state.error.stack}</pre>
            </details>
          )}
          <button 
            className="button"
            onClick={() => this.setState({ hasError: false, error: undefined, errorId: undefined })}
          >
            Reset Error Boundary
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ReviErrorBoundary;
