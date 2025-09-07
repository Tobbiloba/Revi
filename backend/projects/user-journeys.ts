import { api, Query } from "encore.dev/api";
import { db } from "./db";

export interface ProjectUserJourneyParams {
  project_id: number;
  limit?: Query<number>;
  days?: Query<number>;
}

export interface UserJourney {
  sessionId: string;
  userId?: string;
  path: string[];
  timestamps: Date[];
  errors: Array<{
    id: number;
    message: string;
    stack_trace?: string;
    url: string;
    timestamp: Date;
    resolved_at?: Date;
  }>;
  duration: number;
  converted: boolean;
}

export interface ProjectUserJourneysResponse {
  success: true;
  journeys: UserJourney[];
  total: number;
}

/**
 * Get user journey data for a project in the format expected by the dashboard
 */
export const getProjectUserJourneys = api<ProjectUserJourneyParams, ProjectUserJourneysResponse>(
  { expose: true, method: "GET", path: "/api/projects/:project_id/user-journeys" },
  async (params) => {
    const limit = Math.min(params.limit || 50, 500);
    const days = params.days || 1;
    
    // Map days parameter to time_range format expected by analytics
    let timeRange: '1h' | '24h' | '7d' | '30d';
    if (days <= 1) {
      timeRange = '24h';
    } else if (days <= 7) {
      timeRange = '7d';
    } else {
      timeRange = '30d';
    }
    
    // Calculate time range
    const endTime = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
      case '1h':
        startTime.setHours(endTime.getHours() - 1);
        break;
      case '24h':
        startTime.setHours(endTime.getHours() - 24);
        break;
      case '7d':
        startTime.setDate(endTime.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(endTime.getDate() - 30);
        break;
    }
    
    // Get user journey events from database
    const events = await db.queryAll<{
      id: number;
      session_id: string;
      user_id?: string;
      event_type: string;
      url: string;
      timestamp: Date;
      metadata: any;
    }>`
      SELECT id, session_id, user_id, event_type, url, timestamp, metadata
      FROM user_journey_events
      WHERE project_id = ${params.project_id} 
      AND timestamp >= ${startTime} AND timestamp <= ${endTime}
      ORDER BY timestamp ASC
      LIMIT ${limit * 2}
    `;
    
    // Get associated errors for these sessions
    const sessionIds = [...new Set(events.map(e => e.session_id))];
    const errors = sessionIds.length > 0 ? await db.queryAll<{
      id: number;
      session_id: string;
      message: string;
      stack_trace?: string;
      url: string;
      timestamp: Date;
    }>`
      SELECT id, session_id, message, stack_trace, url, timestamp
      FROM errors
      WHERE project_id = ${params.project_id} 
      AND session_id = ANY(${sessionIds})
      AND timestamp >= ${startTime} AND timestamp <= ${endTime}
    ` : [];
    
    // Transform data to dashboard format
    const journeysMap = new Map<string, {
      sessionId: string;
      userId?: string;
      events: typeof events;
      errors: typeof errors;
    }>();
    
    // Group events by session
    events.forEach(event => {
      if (!journeysMap.has(event.session_id)) {
        journeysMap.set(event.session_id, {
          sessionId: event.session_id,
          userId: event.user_id,
          events: [],
          errors: []
        });
      }
      
      const journey = journeysMap.get(event.session_id)!;
      journey.events.push(event);
    });
    
    // Add errors to corresponding sessions
    errors.forEach(error => {
      const journey = journeysMap.get(error.session_id);
      if (journey) {
        journey.errors.push(error);
      }
    });
    
    // Convert to UserJourney format
    const journeys: UserJourney[] = Array.from(journeysMap.values())
      .map(journey => {
        // Sort events by timestamp
        journey.events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        // Extract path and timestamps
        const path = journey.events.map(event => event.url);
        const timestamps = journey.events.map(event => event.timestamp);
        
        // Calculate duration
        const duration = timestamps.length > 1 
          ? timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime()
          : 0;
        
        // Check if converted (simplified: if they reached more than 3 pages)
        const converted = path.length > 3;
        
        return {
          sessionId: journey.sessionId,
          userId: journey.userId,
          path: [...new Set(path)], // Remove duplicates but keep order
          timestamps,
          errors: journey.errors.map(error => ({
            ...error,
            resolved_at: undefined
          })),
          duration,
          converted
        };
      })
      .slice(0, limit); // Apply limit after transformation
    
    return {
      success: true,
      journeys,
      total: journeys.length
    };
  }
);