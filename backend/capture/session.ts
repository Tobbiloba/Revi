import { api, Header, APIError } from "encore.dev/api";
import { db } from "./db";
import { broadcastSessionEvent } from "../sessions/streaming";

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
    console.log('[Revi Backend] Session event capture started', {
      timestamp: new Date().toISOString(),
      requestBody: {
        session_id: req.session_id,
        eventsCount: req.events?.length || (req.event_type ? 1 : 0),
        hasEvents: !!req.events,
        hasSingleEvent: !req.events && !!req.event_type,
        eventsStructure: req.events?.map((e, i) => ({
          index: i,
          event_type: e.event_type,
          hasSessionId: !!e.session_id,
          sessionIdValue: e.session_id || 'MISSING',
          timestamp: e.timestamp,
          dataKeys: Object.keys(e.data || {})
        }))
      }
    });

    const projectId = await validateApiKey(req["x-api-key"]);
    
    const eventsToProcess = req.events || [{
      event_type: req.event_type!,
      data: req.data!,
      timestamp: req.timestamp || Date.now(),
      session_id: req.session_id
    }];
    
    console.log('[Revi Backend] Events to process', {
      eventsCount: eventsToProcess.length,
      events: eventsToProcess.map((e, i) => ({
        index: i,
        event_type: e.event_type,
        session_id: e.session_id,
        hasSessionId: !!e.session_id,
        timestamp: e.timestamp
      }))
    });
    
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
          console.log('[Revi Backend] Session event saved successfully', {
            eventId: result.id,
            event_type: eventData.event_type,
            session_id: eventData.session_id
          });
          
          // Broadcast new session event to streaming clients
          await broadcastSessionEvent(
            eventData.session_id, 
            eventData.event_type, 
            eventData.data
          );
        }
      } catch (error) {
        console.error(`[Revi Backend] Failed to insert session event:`, error, {
          eventData,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined
        });
        // Continue processing other events rather than failing completely
        throw APIError.internal(`Failed to save session event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('[Revi Backend] Session event capture completed', {
      totalEventsProcessed: eventsToProcess.length,
      successfulEventIds: eventIds,
      session_id: req.session_id
    });
    
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