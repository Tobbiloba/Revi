import { api, Query } from "encore.dev/api";
import { db } from "./db";

export interface ListErrorsParams {
  projectId: number;
  page?: Query<number>;
  limit?: Query<number>;
  session_id?: Query<string>;
  start_date?: Query<string>;
  end_date?: Query<string>;
}

export interface ErrorWithSession {
  id: number;
  project_id: number;
  message: string;
  stack_trace?: string;
  url?: string;
  user_agent?: string;
  session_id?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  session_metadata?: Record<string, any>;
  session_user_id?: string;
}

export interface ListErrorsResponse {
  success: true;
  errors: ErrorWithSession[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// Lists errors for a project with pagination and filtering options.
export const listErrors = api<ListErrorsParams, ListErrorsResponse>(
  { expose: true, method: "GET", path: "/api/errors/:projectId" },
  async (params) => {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const offset = (page - 1) * limit;
    
    let whereConditions = "WHERE e.project_id = $1";
    const queryParams: any[] = [params.projectId];
    let paramIndex = 2;
    
    if (params.session_id) {
      whereConditions += ` AND e.session_id = $${paramIndex}`;
      queryParams.push(params.session_id);
      paramIndex++;
    }
    
    if (params.start_date) {
      whereConditions += ` AND e.timestamp >= $${paramIndex}`;
      queryParams.push(new Date(params.start_date));
      paramIndex++;
    }
    
    if (params.end_date) {
      whereConditions += ` AND e.timestamp <= $${paramIndex}`;
      queryParams.push(new Date(params.end_date));
      paramIndex++;
    }
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM errors e
      ${whereConditions}
    `;
    
    const dataQuery = `
      SELECT 
        e.id, e.project_id, e.message, e.stack_trace, e.url, 
        e.user_agent, e.session_id, e.timestamp, e.metadata,
        s.metadata as session_metadata, s.user_id as session_user_id
      FROM errors e
      LEFT JOIN sessions s ON e.session_id = s.session_id AND e.project_id = s.project_id
      ${whereConditions}
      ORDER BY e.timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const [countResult, errors] = await Promise.all([
      db.rawQueryRow<{ total: number }>(countQuery, ...queryParams),
      db.rawQueryAll<ErrorWithSession>(dataQuery, ...queryParams, limit, offset)
    ]);
    
    const total = countResult?.total || 0;
    
    return {
      success: true,
      errors: errors.map(error => ({
        ...error,
        metadata: typeof error.metadata === 'string' ? JSON.parse(error.metadata) : error.metadata,
        session_metadata: error.session_metadata ? 
          (typeof error.session_metadata === 'string' ? JSON.parse(error.session_metadata) : error.session_metadata) 
          : undefined
      })),
      total,
      page,
      limit,
      has_more: offset + limit < total
    };
  }
);
