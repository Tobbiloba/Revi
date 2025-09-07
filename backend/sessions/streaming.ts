import { api, APIError } from "encore.dev/api";
import { db } from "./db";

// WebSocket streaming interface for real-time session events
export interface StreamingAuth {
  apiKey: string;
  projectId: string;
  sessionId: string;
}

export interface StreamingMessage {
  type: 'auth' | 'session-event' | 'error-event' | 'heartbeat' | 'session-ended';
  data?: any;
  timestamp?: number;
}

// In-memory store for active WebSocket connections
const activeConnections = new Map<string, Set<WebSocket>>();

// Utility to broadcast messages to all connections for a session
function broadcastToSession(sessionId: string, message: StreamingMessage) {
  const connections = activeConnections.get(sessionId);
  if (connections) {
    const messageStr = JSON.stringify({
      ...message,
      timestamp: message.timestamp || Date.now()
    });
    
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }
}

// WebSocket endpoint for real-time session streaming
export const streamSession = api<{ sessionId: string }, void>(
  { 
    expose: true, 
    method: "GET", 
    path: "/api/stream/session/:sessionId",
    // Note: Encore.ts may need WebSocket support configuration
  },
  async (params, req) => {
    // For WebSocket upgrade, we need to handle this specially
    // This is a placeholder - actual WebSocket implementation depends on Encore.ts WebSocket support
    
    throw APIError.unimplemented("WebSocket streaming endpoint - requires WebSocket server setup");
  }
);

// Server-Sent Events endpoint as WebSocket fallback
export const streamSessionEvents = api<{ 
  sessionId: string; 
  apiKey?: string;
  projectId?: string;
}, void>(
  {
    expose: true,
    method: "GET", 
    path: "/api/stream/session/:sessionId/events"
  },
  async (params, req) => {
    const { sessionId, apiKey, projectId } = params;
    
    if (!apiKey || !projectId) {
      throw APIError.unauthenticated("Missing apiKey or projectId");
    }
    
    // Verify session exists
    const sessionInfo = await db.queryRow`
      SELECT session_id, project_id 
      FROM sessions 
      WHERE session_id = ${sessionId}
    `;
    
    if (!sessionInfo) {
      throw APIError.notFound("Session not found");
    }
    
    // Set SSE headers
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    };
    
    // Create a proper SSE stream that sends periodic updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        const initialEvent = `data: ${JSON.stringify({
          type: 'session-event',
          data: {
            id: `sse-${Date.now()}`,
            session_id: sessionId,
            event_type: 'connection_established',
            timestamp: Date.now()
          }
        })}\n\n`;
        controller.enqueue(encoder.encode(initialEvent));
        
        // Set up periodic heartbeat and data polling
        const interval = setInterval(async () => {
          try {
            // Send heartbeat
            const heartbeat = `data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: Date.now()
            })}\n\n`;
            controller.enqueue(encoder.encode(heartbeat));
            
            // Poll for new events periodically (every 5 seconds)
            // In production, this would be triggered by actual new data
            const recentEvents = await db.queryAll<{
              id: number;
              event_type: string;
              data: string;
              timestamp: Date;
            }>`
              SELECT id, event_type, data, timestamp
              FROM session_events
              WHERE session_id = ${sessionId} 
              AND timestamp > NOW() - INTERVAL '10 seconds'
              ORDER BY timestamp DESC
              LIMIT 10
            `;
            
            // Send any new events
            for (const event of recentEvents) {
              const eventData = `data: ${JSON.stringify({
                type: 'session-event',
                data: {
                  id: event.id,
                  session_id: sessionId,
                  event_type: event.event_type,
                  data: typeof event.data === 'string' ? JSON.parse(event.data) : event.data,
                  timestamp: event.timestamp.getTime()
                }
              })}\n\n`;
              controller.enqueue(encoder.encode(eventData));
            }
          } catch (error) {
            console.error('SSE polling error:', error);
          }
        }, 5000);
        
        // Clean up on close
        req.signal?.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      }
    });
    
    return new Response(stream, { headers });
  }
);

// Polling endpoint for clients that don't support WebSocket/SSE
export const pollSessionEvents = api<{
  sessionId: string;
  since?: string;
  apiKey?: string;
}, {
  events: Array<{
    id: number;
    type: string;
    timestamp: number;
    data: any;
  }>;
  hasMore: boolean;
}>(
  {
    expose: true,
    method: "GET",
    path: "/api/session/:sessionId/events/poll"
  },
  async (params, req) => {
    const { sessionId, since = '0', apiKey } = params;
    
    if (!apiKey) {
      throw APIError.unauthenticated("Missing API key");
    }
    
    // Verify session exists
    const sessionInfo = await db.queryRow`
      SELECT session_id, project_id 
      FROM sessions 
      WHERE session_id = ${sessionId}
    `;
    
    if (!sessionInfo) {
      throw APIError.notFound("Session not found");
    }
    
    const sinceId = parseInt(since) || 0;
    
    // Get events newer than 'since' parameter
    const [sessionEvents, networkEvents, errors] = await Promise.all([
      // Session events
      db.queryAll<{
        id: number;
        event_type: string;
        data: string;
        timestamp: Date;
      }>`
        SELECT id, event_type, data, timestamp
        FROM session_events
        WHERE session_id = ${sessionId} AND id > ${sinceId}
        ORDER BY timestamp ASC
        LIMIT 100
      `,
      
      // Network events
      db.queryAll<{
        id: number;
        method: string;
        url: string;
        status_code?: number;
        timestamp: Date;
      }>`
        SELECT id, method, url, status_code, timestamp
        FROM network_events
        WHERE session_id = ${sessionId} AND id > ${sinceId}
        ORDER BY timestamp ASC
        LIMIT 100
      `,
      
      // Errors
      db.queryAll<{
        id: number;
        message: string;
        timestamp: Date;
      }>`
        SELECT id, message, timestamp
        FROM errors
        WHERE session_id = ${sessionId} AND id > ${sinceId}
        ORDER BY timestamp ASC
        LIMIT 100
      `
    ]);
    
    // Combine and format events
    const allEvents = [
      ...sessionEvents.map(event => ({
        id: event.id,
        type: event.event_type,
        timestamp: event.timestamp.getTime(),
        data: typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      })),
      ...networkEvents.map(event => ({
        id: event.id,
        type: 'network_request',
        timestamp: event.timestamp.getTime(),
        data: {
          method: event.method,
          url: event.url,
          status_code: event.status_code
        }
      })),
      ...errors.map(error => ({
        id: error.id,
        type: 'error',
        timestamp: error.timestamp.getTime(),
        data: {
          message: error.message
        }
      }))
    ].sort((a, b) => a.timestamp - b.timestamp);
    
    return {
      events: allEvents,
      hasMore: allEvents.length === 100 // If we got max results, there might be more
    };
  }
);

// Utility function to broadcast new events to streaming clients
export async function broadcastSessionEvent(
  sessionId: string, 
  eventType: string, 
  eventData: any
) {
  const message: StreamingMessage = {
    type: 'session-event',
    data: {
      id: `broadcast-${Date.now()}`,
      session_id: sessionId,
      event_type: eventType,
      data: eventData,
      timestamp: Date.now()
    }
  };
  
  broadcastToSession(sessionId, message);
}

// Utility function to broadcast errors to streaming clients
export async function broadcastSessionError(
  sessionId: string,
  error: {
    id: number;
    message: string;
    stack_trace?: string;
    url?: string;
  }
) {
  const message: StreamingMessage = {
    type: 'error-event',
    data: {
      id: error.id,
      session_id: sessionId,
      message: error.message,
      stack: error.stack_trace,
      url: error.url,
      timestamp: Date.now()
    }
  };
  
  broadcastToSession(sessionId, message);
}