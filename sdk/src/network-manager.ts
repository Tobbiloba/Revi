export class NetworkManager {
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private connectionType: string = 'unknown';
  private listeners: Array<(online: boolean) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for online/offline events
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners(true);
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners(false);
      });

      // Detect connection type if available
      this.detectConnectionType();
    }
  }

  getConnectionStatus(): { online: boolean; connectionType: string } {
    return {
      online: this.isOnline,
      connectionType: this.connectionType
    };
  }

  onConnectionChange(callback: (online: boolean) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getBatchSize(): number {
    if (!this.isOnline) {
      return 0; // Don't upload when offline
    }

    // Adjust batch size based on connection quality
    switch (this.connectionType) {
      case 'slow-2g':
        return 5;
      case '2g':
        return 10;
      case '3g':
        return 25;
      case '4g':
        return 50;
      default:
        return 25;
    }
  }

  getUploadDelay(): number {
    if (!this.isOnline) {
      return 0; // Don't upload when offline
    }

    // Adjust upload frequency based on connection
    switch (this.connectionType) {
      case 'slow-2g':
        return 30000; // 30 seconds
      case '2g':
        return 15000; // 15 seconds
      case '3g':
        return 10000; // 10 seconds
      case '4g':
        return 5000;  // 5 seconds
      default:
        return 10000; // 10 seconds
    }
  }

  shouldRetry(attempt: number): boolean {
    if (!this.isOnline) {
      return false; // Don't retry when offline
    }

    // Exponential backoff with max attempts
    const maxAttempts = 5;
    return attempt < maxAttempts;
  }

  getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, attempt), 16000);
  }

  private detectConnectionType(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.connectionType = connection.effectiveType || connection.type || 'unknown';
      
      // Listen for connection changes
      connection.addEventListener('change', () => {
        this.connectionType = connection.effectiveType || connection.type || 'unknown';
      });
    }
  }

  private notifyListeners(online: boolean): void {
    this.listeners.forEach(callback => {
      try {
        callback(online);
      } catch (error) {
        console.error('[Revi] Error in connection change callback:', error);
      }
    });
  }

  // Ping test to verify actual connectivity
  async testConnectivity(url?: string): Promise<boolean> {
    if (!this.isOnline) {
      return false;
    }

    try {
      const testUrl = url || 'https://api.revi.dev/health';
      await fetch(testUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}