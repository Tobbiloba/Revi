import { api, APIError } from "encore.dev/api";
import { db } from "./db";

export interface UpdateErrorStatusParams {
  errorId: number;
}

export interface UpdateErrorStatusRequest {
  status: 'new' | 'investigating' | 'resolved' | 'ignored';
  assigned_to?: string;
  resolution_notes?: string;
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
  status?: 'new' | 'investigating' | 'resolved' | 'ignored';
  assigned_to?: string;
  resolved_at?: Date;
  resolution_notes?: string;
}

export interface UpdateErrorStatusResponse {
  success: true;
  error: ErrorWithSession;
}

// Updates the status of an error (new, investigating, resolved, ignored).
export const updateErrorStatus = api<UpdateErrorStatusParams & UpdateErrorStatusRequest, UpdateErrorStatusResponse>(
  { expose: true, method: "PUT", path: "/api/errors/:errorId/status" },
  async (req) => {
    // Update the error status
    const updatedError = await db.queryRow<{
      id: number;
      project_id: number;
      message: string;
      stack_trace?: string;
      url?: string;
      user_agent?: string;
      session_id?: string;
      timestamp: Date;
      metadata: string;
      status: string;
      assigned_to?: string;
      resolved_at?: Date;
      resolution_notes?: string;
    }>`
      UPDATE errors
      SET 
        status = ${req.status},
        assigned_to = ${req.assigned_to || null},
        resolution_notes = ${req.resolution_notes || null},
        resolved_at = ${req.status === 'resolved' ? new Date() : null}
      WHERE id = ${req.errorId}
      RETURNING id, project_id, message, stack_trace, url, user_agent, session_id, 
                timestamp, metadata, status, assigned_to, resolved_at, resolution_notes
    `;
    
    if (!updatedError) {
      throw APIError.notFound("error not found");
    }
    
    // Get session metadata if session exists
    let sessionData = null;
    if (updatedError.session_id) {
      sessionData = await db.queryRow<{
        metadata: string;
        user_id?: string;
      }>`
        SELECT metadata, user_id
        FROM sessions
        WHERE session_id = ${updatedError.session_id} AND project_id = ${updatedError.project_id}
      `;
    }
    
    return {
      success: true,
      error: {
        id: updatedError.id,
        project_id: updatedError.project_id,
        message: updatedError.message,
        stack_trace: updatedError.stack_trace,
        url: updatedError.url,
        user_agent: updatedError.user_agent,
        session_id: updatedError.session_id,
        timestamp: updatedError.timestamp,
        metadata: typeof updatedError.metadata === 'string' ? JSON.parse(updatedError.metadata) : updatedError.metadata,
        session_metadata: sessionData?.metadata ? 
          (typeof sessionData.metadata === 'string' ? JSON.parse(sessionData.metadata) : sessionData.metadata) : 
          undefined,
        session_user_id: sessionData?.user_id,
        status: updatedError.status as 'new' | 'investigating' | 'resolved' | 'ignored',
        assigned_to: updatedError.assigned_to,
        resolved_at: updatedError.resolved_at,
        resolution_notes: updatedError.resolution_notes
      }
    };
  }
);

export interface BulkUpdateErrorStatusRequest {
  error_ids: number[];
  status: 'new' | 'investigating' | 'resolved' | 'ignored';
  assigned_to?: string;
  resolution_notes?: string;
}

export interface BulkUpdateErrorStatusResponse {
  success: true;
  updated_count: number;
}

// Updates the status of multiple errors in bulk.
export const bulkUpdateErrorStatus = api<BulkUpdateErrorStatusRequest, BulkUpdateErrorStatusResponse>(
  { expose: true, method: "PUT", path: "/api/errors/bulk/status" },
  async (req) => {
    const result = await db.queryRow<{ count: number }>`
      UPDATE errors
      SET 
        status = ${req.status},
        assigned_to = ${req.assigned_to || null},
        resolution_notes = ${req.resolution_notes || null},
        resolved_at = ${req.status === 'resolved' ? new Date() : null}
      WHERE id = ANY(${req.error_ids})
      RETURNING (
        SELECT COUNT(*)
        FROM errors
        WHERE id = ANY(${req.error_ids}) AND status = ${req.status}
      ) as count
    `;
    
    return {
      success: true,
      updated_count: result?.count || 0
    };
  }
);