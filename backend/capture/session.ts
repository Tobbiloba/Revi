import { api, Header, APIError } from "encore.dev/api";
import { db } from "./db";

export interface SessionEventData {
  event_type: string;
  data: Record<string, any>;
  timestamp?: number;
  session_id: string;
}

export interface CaptureSessionEventRequest {
  session_id: string;
  events?: SessionEventData[];
  event_type?: string;
  data?: Record<string, any>;
  timestamp?: number;
}

export interface CaptureSessionEventResponse {
  success: boolean;
  event_ids: number[];
}

interface CaptureSessionEventParams extends CaptureSessionEventRequest {
  "x-api-key": Header<"X-API-Key">;
}

// Captures session event data for a project, supporting both single events and bulk capture.
export const captureSessionEvent = api<CaptureSessionEventParams, CaptureSessionEventResponse>(
  { expose: true, method: "POST", path: "/api/capture/session-event" },
  async (req) => {
    const projectId = await validateApiKey(req["x-api-key"]);
    
    const eventsToProcess = req.events || [{
      event_type: req.event_type!,
      data: req.data!,
      timestamp: req.timestamp || Date.now(),
      session_id: req.session_id
    }];
    
    const eventIds: number[] = [];
    
    // Ensure session exists or create it
    await ensureSessionExists(projectId, req.session_id);
    
    for (const eventData of eventsToProcess) {
      const result = await db.queryRow<{ id: number }>`
        INSERT INTO session_events (
          session_id, event_type, data, timestamp
        )
        VALUES (
          ${eventData.session_id}, ${eventData.event_type}, 
          ${JSON.stringify(eventData.data)}, 
          to_timestamp(${eventData.timestamp || Date.now()} / 1000.0)
        )
        RETURNING id
      `;
      
      if (result) {
        eventIds.push(result.id);
      }
    }
    
    return {
      success: true,
      event_ids: eventIds
    };
  }
);

async function validateApiKey(apiKey: string): Promise<number> {
  if (!apiKey) {
    throw APIError.unauthenticated("missing API key");
  }
  
  const project = await db.queryRow<{ id: number }>`
    SELECT id FROM projects WHERE api_key = ${apiKey}
  `;
  
  if (!project) {
    throw APIError.unauthenticated("invalid API key");
  }
  
  return project.id;
}

async function ensureSessionExists(projectId: number, sessionId: string): Promise<void> {
  // Check if session exists
  const existingSession = await db.queryRow<{ id: number }>`
    SELECT id FROM sessions WHERE session_id = ${sessionId}
  `;
  
  if (!existingSession) {
    // Create new session
    await db.queryRow`
      INSERT INTO sessions (
        project_id, session_id, started_at, metadata
      )
      VALUES (
        ${projectId}, ${sessionId}, NOW(), '{}'
      )
    `;
  }
}