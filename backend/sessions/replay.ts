import { api, APIError } from "encore.dev/api";
import { db } from "./db";

export interface GetSessionReplayParams {
  sessionId: string;
}

export interface ReplayEvent {
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

export interface GetSessionReplayResponse {
  session_id: string;
  events: ReplayEvent[];
  metadata: {
    duration: number;
    total_events: number;
    start_time: number;
    end_time: number;
  };
}

// Retrieves session replay data formatted for frontend replay components.
export const getSessionReplay = api<GetSessionReplayParams, GetSessionReplayResponse>(
  { expose: true, method: "GET", path: "/api/session/:sessionId/replay" },
  async (params) => {
    // Get session info to verify it exists and get timing data
    const sessionInfo = await db.queryRow<{
      session_id: string;
      started_at: Date;
      ended_at?: Date;
    }>`
      SELECT session_id, started_at, ended_at
      FROM sessions
      WHERE session_id = ${params.sessionId}
    `;
    
    if (!sessionInfo) {
      throw APIError.notFound("session not found");
    }
    
    // Get all session events that are relevant for replay
    const sessionEvents = await db.queryAll<{
      event_type: string;
      data: string;
      timestamp: Date;
    }>`
      SELECT event_type, data, timestamp
      FROM session_events
      WHERE session_id = ${params.sessionId}
      AND event_type IN (
        'dom_mutation', 'click', 'input', 'scroll', 'resize', 
        'mouse_move', 'key_press', 'page_load', 'navigation'
      )
      ORDER BY timestamp ASC
    `;
    
    const startTime = sessionInfo.started_at.getTime();
    const endTime = sessionInfo.ended_at?.getTime() || Date.now();
    
    const replayEvents: ReplayEvent[] = sessionEvents.map(event => ({
      type: event.event_type,
      timestamp: event.timestamp.getTime() - startTime, // Relative timestamp
      data: typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    }));
    
    return {
      session_id: params.sessionId,
      events: replayEvents,
      metadata: {
        duration: endTime - startTime,
        total_events: replayEvents.length,
        start_time: startTime,
        end_time: endTime
      }
    };
  }
);
