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
      try {
        // Validate and convert timestamp to Date object
        let timestamp: Date;
        if (eventData.timestamp) {
          // Handle both number (unix timestamp) and ISO string formats
          if (typeof eventData.timestamp === 'number') {
            timestamp = new Date(eventData.timestamp);
          } else if (typeof eventData.timestamp === 'string') {
            timestamp = new Date(eventData.timestamp);
          } else {
            timestamp = new Date();
          }
        } else {
          timestamp = new Date();
        }

        // Ensure data is valid JSON object
        const eventDataJson = eventData.data || {};
        
        const result = await db.queryRow<{ id: number }>`
          INSERT INTO session_events (
            session_id, event_type, data, timestamp
          )
          VALUES (
            ${eventData.session_id}, ${eventData.event_type}, 
            ${eventDataJson}, 
            ${timestamp}
          )
          RETURNING id
        `;
        
        if (result) {
          eventIds.push(result.id);
        }
      } catch (error) {
        console.error(`Failed to insert session event:`, error, eventData);
        // Continue processing other events rather than failing completely
        throw APIError.internal(`Failed to save session event: ${error instanceof Error ? error.message : 'Unknown error'}`);
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