interface PollingEvent {
  id: number;
  type: string;
  timestamp: number;
  data: unknown;
}

interface PollingResponse {
  events: PollingEvent[];
  hasMore: boolean;
}

export class SessionPollingClient {
  private sessionId: string;
  private apiKey: string;
  private baseUrl: string;
  private intervalId: NodeJS.Timeout | null = null;
  private lastEventId: number = 0;
  private isPolling: boolean = false;
  private onEventCallbacks: Array<(events: PollingEvent[]) => void> = [];

  constructor(sessionId: string, apiKey: string, baseUrl: string = 'http://localhost:4000') {
    this.sessionId = sessionId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  public onEvents(callback: (events: PollingEvent[]) => void): () => void {
    this.onEventCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.onEventCallbacks.indexOf(callback);
      if (index > -1) {
        this.onEventCallbacks.splice(index, 1);
      }
    };
  }

  public startPolling(intervalMs: number = 2000): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    console.log(`[SessionPolling] Starting polling for session ${this.sessionId} every ${intervalMs}ms`);
    
    // Poll immediately
    this.poll();
    
    // Then poll at intervals
    this.intervalId = setInterval(() => {
      this.poll();
    }, intervalMs);
  }

  public stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
    console.log(`[SessionPolling] Stopped polling for session ${this.sessionId}`);
  }

  public reset(): void {
    this.lastEventId = 0;
    console.log(`[SessionPolling] Reset last event ID for session ${this.sessionId}`);
  }

  private async poll(): Promise<void> {
    try {
      const url = new URL(`${this.baseUrl}/api/session/${this.sessionId}/events/poll`);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('since', this.lastEventId.toString());

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error(`[SessionPolling] Polling failed:`, response.status, response.statusText);
        return;
      }

      const data: PollingResponse = await response.json();
      
      if (data.events && data.events.length > 0) {
        console.log(`[SessionPolling] Received ${data.events.length} new events for session ${this.sessionId}`);
        
        // Update last event ID to the highest ID received
        const maxId = Math.max(...data.events.map(e => e.id));
        this.lastEventId = maxId;
        
        // Notify all callbacks
        this.onEventCallbacks.forEach(callback => {
          try {
            callback(data.events);
          } catch (error) {
            console.error('[SessionPolling] Error in event callback:', error);
          }
        });
      }
    } catch (error) {
      console.error(`[SessionPolling] Polling error for session ${this.sessionId}:`, error);
    }
  }

  public getCurrentEventId(): number {
    return this.lastEventId;
  }

  public isActive(): boolean {
    return this.isPolling;
  }
}

// Singleton manager for multiple sessions
export class SessionPollingManager {
  private static instance: SessionPollingManager | null = null;
  private clients: Map<string, SessionPollingClient> = new Map();

  public static getInstance(): SessionPollingManager {
    if (!SessionPollingManager.instance) {
      SessionPollingManager.instance = new SessionPollingManager();
    }
    return SessionPollingManager.instance;
  }

  public startPolling(sessionId: string, apiKey: string, baseUrl?: string): SessionPollingClient {
    const clientKey = `${sessionId}-${apiKey}`;
    
    if (this.clients.has(clientKey)) {
      const existingClient = this.clients.get(clientKey)!;
      if (!existingClient.isActive()) {
        existingClient.startPolling();
      }
      return existingClient;
    }

    const client = new SessionPollingClient(sessionId, apiKey, baseUrl);
    this.clients.set(clientKey, client);
    client.startPolling();
    
    return client;
  }

  public stopPolling(sessionId: string, apiKey: string): void {
    const clientKey = `${sessionId}-${apiKey}`;
    const client = this.clients.get(clientKey);
    
    if (client) {
      client.stopPolling();
      this.clients.delete(clientKey);
    }
  }

  public stopAllPolling(): void {
    this.clients.forEach(client => client.stopPolling());
    this.clients.clear();
  }

  public getClient(sessionId: string, apiKey: string): SessionPollingClient | null {
    const clientKey = `${sessionId}-${apiKey}`;
    return this.clients.get(clientKey) || null;
  }
}