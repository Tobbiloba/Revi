'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw, Home, MessageCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  sessionId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class SessionReplayErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Session Replay Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              {/* Error Icon */}
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              {/* Error Message */}
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-red-900">
                  Session Replay Error
                </h3>
                <p className="text-red-700 max-w-md mx-auto">
                  Something went wrong while rendering the session replay. This could be due to corrupted session data or a rendering issue.
                </p>
                {this.props.sessionId && (
                  <p className="text-sm text-red-600">
                    Session ID: <code className="bg-red-100 px-2 py-1 rounded font-mono">{this.props.sessionId}</code>
                  </p>
                )}
              </div>

              {/* Error Details (in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left bg-red-100 p-4 rounded-lg border border-red-200">
                  <summary className="cursor-pointer text-red-800 font-medium mb-2">
                    Technical Details (Development Only)
                  </summary>
                  <div className="space-y-2 text-sm text-red-700">
                    <div>
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-auto">
                        {this.state.error.stack}
                      </pre>
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-auto">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3">
                <Button 
                  variant="outline" 
                  className="border-red-300 text-red-700 hover:bg-red-100"
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null });
                  }}
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                
                <Button 
                  variant="outline" 
                  className="border-red-300 text-red-700 hover:bg-red-100"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Refresh Page
                </Button>
                
                <Button 
                  variant="ghost" 
                  className="text-red-600 hover:bg-red-100"
                  onClick={() => window.history.back()}
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>

              {/* Support Contact */}
              <div className="pt-4 border-t border-red-200">
                <p className="text-sm text-red-600">
                  If this error persists, please{' '}
                  <Button
                    variant="link"
                    className="text-red-700 underline h-auto p-0"
                    onClick={() => {
                      // In a real app, this would open a support form or link
                      console.log('Report error:', this.state.error);
                    }}
                  >
                    <MessageCircle className="w-3 h-3 mr-1" />
                    report this issue
                  </Button>
                  {' '}with the session ID above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}