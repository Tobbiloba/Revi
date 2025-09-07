import { api, Query } from "encore.dev/api";
import { db } from "./db";

export interface ListSessionsParams {
  projectId: number;
  page?: Query<number>;
  limit?: Query<number>;
  user_id?: Query<string>;
  start_date?: Query<string>;
  end_date?: Query<string>;
  has_errors?: Query<boolean>;
}

export interface SessionSummary {
  session_id: string;
  project_id: number;
  user_id?: string;
  started_at: Date;
  ended_at?: Date;
  duration?: number; // in seconds
  error_count: number;
  event_count: number;
  last_error?: string;
  metadata: Record<string, any>;
  user_agent?: string;
  ip_address?: string;
}

export interface ListSessionsResponse {
  sessions: SessionSummary[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// Lists sessions for a project with pagination and filtering options.
export const listSessions = api<ListSessionsParams, ListSessionsResponse>(
  { expose: true, method: "GET", path: "/api/sessions/:projectId" },
  async (params) => {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const offset = (page - 1) * limit;
    
    let whereConditions = "WHERE s.project_id = $1";
    const queryParams: any[] = [params.projectId];
    let paramIndex = 2;
    
    if (params.user_id) {
      whereConditions += ` AND s.user_id = $${paramIndex}`;
      queryParams.push(params.user_id);
      paramIndex++;
    }
    
    if (params.start_date) {
      whereConditions += ` AND s.started_at >= $${paramIndex}`;
      queryParams.push(new Date(params.start_date));
      paramIndex++;
    }
    
    if (params.end_date) {
      whereConditions += ` AND s.started_at <= $${paramIndex}`;
      queryParams.push(new Date(params.end_date));
      paramIndex++;
    }
    
    if (params.has_errors !== undefined) {
      if (params.has_errors) {
        whereConditions += " AND error_stats.error_count > 0";
      } else {
        whereConditions += " AND (error_stats.error_count = 0 OR error_stats.error_count IS NULL)";
      }
    }
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as error_count
        FROM errors
        GROUP BY session_id
      ) error_stats ON s.session_id = error_stats.session_id
      ${whereConditions}
    `;
    
    const dataQuery = `
      SELECT 
        s.session_id, s.project_id, s.user_id, s.started_at, s.ended_at, s.metadata,
        COALESCE(error_stats.error_count, 0) as error_count,
        COALESCE(event_stats.event_count, 0) as event_count,
        error_stats.last_error,
        CAST(EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at)) AS BIGINT) as duration
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as error_count, 
               MAX(message) as last_error
        FROM errors
        GROUP BY session_id
      ) error_stats ON s.session_id = error_stats.session_id
      LEFT JOIN (
        SELECT 
          COALESCE(se_stats.session_id, uje_stats.session_id) as session_id,
          (COALESCE(se_stats.event_count, 0) + COALESCE(uje_stats.event_count, 0)) as event_count
        FROM (
          SELECT session_id, COUNT(*) as event_count
          FROM session_events
          GROUP BY session_id
        ) se_stats
        FULL OUTER JOIN (
          SELECT session_id, COUNT(*) as event_count
          FROM user_journey_events
          GROUP BY session_id
        ) uje_stats ON se_stats.session_id = uje_stats.session_id
      ) event_stats ON s.session_id = event_stats.session_id
      ${whereConditions}
      ORDER BY s.started_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const [countResult, sessions] = await Promise.all([
      db.rawQueryRow<{ total: number }>(countQuery, ...queryParams),
      db.rawQueryAll<{
        session_id: string;
        project_id: number;
        user_id?: string;
        started_at: Date;
        ended_at?: Date;
        metadata: string;
        error_count: number;
        event_count: number;
        last_error?: string;
        duration: bigint;
      }>(dataQuery, ...queryParams, limit, offset)
    ]);
    
    const total = countResult?.total || 0;
    
    return {
      sessions: sessions.map(session => ({
        session_id: session.session_id,
        project_id: session.project_id,
        user_id: session.user_id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration: Math.round(Number(session.duration)),
        error_count: Number(session.error_count),
        event_count: Number(session.event_count),
        last_error: session.last_error,
        metadata: typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata
      })),
      total,
      page,
      limit,
      has_more: offset + limit < total
    };
  }
);