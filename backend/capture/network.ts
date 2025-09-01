import { api, Header, APIError } from "encore.dev/api";
import { db } from "./db";

export interface NetworkEventData {
  method: string;
  url: string;
  status_code?: number;
  response_time?: number;
  timestamp?: number;
  session_id: string;
  request_data?: Record<string, any>;
  response_data?: Record<string, any>;
}

export interface CaptureNetworkEventRequest {
  session_id: string;
  events?: NetworkEventData[];
  method?: string;
  url?: string;
  status_code?: number;
  response_time?: number;
  timestamp?: number;
  request_data?: Record<string, any>;
  response_data?: Record<string, any>;
}

export interface CaptureNetworkEventResponse {
  success: boolean;
  event_ids: number[];
}

interface CaptureNetworkEventParams extends CaptureNetworkEventRequest {
  "x-api-key": Header<"X-API-Key">;
}

// Captures network event data for a project, supporting both single events and bulk capture.
export const captureNetworkEvent = api<CaptureNetworkEventParams, CaptureNetworkEventResponse>(
  { expose: true, method: "POST", path: "/api/capture/network-event" },
  async (req) => {
    const projectId = await validateApiKey(req["x-api-key"]);
    
    const eventsToProcess = req.events || [{
      method: req.method!,
      url: req.url!,
      status_code: req.status_code,
      response_time: req.response_time,
      timestamp: req.timestamp || Date.now(),
      session_id: req.session_id,
      request_data: req.request_data || {},
      response_data: req.response_data || {}
    }];
    
    const eventIds: number[] = [];
    
    // Ensure session exists or create it
    await ensureSessionExists(projectId, req.session_id);
    
    for (const eventData of eventsToProcess) {
      const result = await db.queryRow<{ id: number }>`
        INSERT INTO network_events (
          session_id, method, url, status_code, response_time, 
          timestamp, request_data, response_data
        )
        VALUES (
          ${eventData.session_id}, ${eventData.method}, ${eventData.url},
          ${eventData.status_code}, ${eventData.response_time},
          to_timestamp(${eventData.timestamp || Date.now()} / 1000.0),
          ${JSON.stringify(eventData.request_data || {})},
          ${JSON.stringify(eventData.response_data || {})}
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