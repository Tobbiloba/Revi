import { api, APIError } from "encore.dev/api";
import { db } from "./db";

export interface GetSessionEventsParams {
  sessionId: string;
}

export interface SessionEventData {
  id: number;
  session_id: string;
  event_type: string;
  data: Record<string, any>;
  timestamp: Date;
  source: 'session' | 'network' | 'error';
}

export interface GetSessionEventsResponse {
  events: SessionEventData[];
  session_info: {
    session_id: string;
    project_id: number;
    user_id?: string;
    started_at: Date;
    ended_at?: Date;
    metadata: Record<string, any>;
  } | null;
}

// Retrieves the complete timeline of events for a session including DOM events, network calls, and errors.
export const getSessionEvents = api<GetSessionEventsParams, GetSessionEventsResponse>(
  { expose: true, method: "GET", path: "/api/session/:sessionId/events" },
  async (params) => {
    // Get session info
    const sessionInfo = await db.queryRow<{
      session_id: string;
      project_id: number;
      user_id?: string;
      started_at: Date;
      ended_at?: Date;
      metadata: string;
    }>`
      SELECT session_id, project_id, user_id, started_at, ended_at, metadata
      FROM sessions
      WHERE session_id = ${params.sessionId}
    `;
    
    if (!sessionInfo) {
      throw APIError.notFound("session not found");
    }
    
    // Get all events for the session in chronological order
    const [sessionEvents, networkEvents, errors] = await Promise.all([
      // Session events
      db.queryAll<{
        id: number;
        session_id: string;
        event_type: string;
        data: string;
        timestamp: Date;
      }>`
        SELECT id, session_id, event_type, data, timestamp
        FROM session_events
        WHERE session_id = ${params.sessionId}
      `,
      
      // Network events
      db.queryAll<{
        id: number;
        session_id: string;
        method: string;
        url: string;
        status_code?: number;
        response_time?: number;
        timestamp: Date;
        request_data: string;
        response_data: string;
      }>`
        SELECT id, session_id, method, url, status_code, response_time, 
               timestamp, request_data, response_data
        FROM network_events
        WHERE session_id = ${params.sessionId}
      `,
      
      // Errors
      db.queryAll<{
        id: number;
        session_id: string;
        message: string;
        stack_trace?: string;
        url?: string;
        timestamp: Date;
        metadata: string;
      }>`
        SELECT id, session_id, message, stack_trace, url, timestamp, metadata
        FROM errors
        WHERE session_id = ${params.sessionId}
      `
    ]);
    
    // Combine all events and sort by timestamp
    const allEvents: SessionEventData[] = [
      ...sessionEvents.map(event => ({
        id: event.id,
        session_id: event.session_id,
        event_type: event.event_type,
        data: typeof event.data === 'string' ? JSON.parse(event.data) : event.data,
        timestamp: event.timestamp,
        source: 'session' as const
      })),
      ...networkEvents.map(event => ({
        id: event.id,
        session_id: event.session_id,
        event_type: 'network_request',
        data: {
          method: event.method,
          url: event.url,
          status_code: event.status_code,
          response_time: event.response_time,
          request_data: typeof event.request_data === 'string' ? JSON.parse(event.request_data) : event.request_data,
          response_data: typeof event.response_data === 'string' ? JSON.parse(event.response_data) : event.response_data
        },
        timestamp: event.timestamp,
        source: 'network' as const
      })),
      ...errors.map(error => ({
        id: error.id,
        session_id: error.session_id,
        event_type: 'error',
        data: {
          message: error.message,
          stack_trace: error.stack_trace,
          url: error.url,
          metadata: typeof error.metadata === 'string' ? JSON.parse(error.metadata) : error.metadata
        },
        timestamp: error.timestamp,
        source: 'error' as const
      }))
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return {
      events: allEvents,
      session_info: {
        session_id: sessionInfo.session_id,
        project_id: sessionInfo.project_id,
        user_id: sessionInfo.user_id,
        started_at: sessionInfo.started_at,
        ended_at: sessionInfo.ended_at,
        metadata: typeof sessionInfo.metadata === 'string' ? JSON.parse(sessionInfo.metadata) : sessionInfo.metadata
      }
    };
  }
);
