import { api, Header, APIError } from "encore.dev/api";
import { db } from "./db";
import { processError } from "../intelligence/grouping";

export interface CaptureErrorRequest {
  message?: string;
  stack_trace?: string;
  url?: string;
  user_agent?: string;
  session_id?: string;
  metadata?: Record<string, any>;
  errors?: ErrorData[];
}

export interface ErrorData {
  message: string;
  stack_trace?: string;
  url?: string;
  user_agent?: string;
  session_id?: string;
  metadata?: Record<string, any>;
}

export interface CaptureErrorResponse {
  success: boolean;
  error_ids: number[];
  error_groups?: Array<{
    error_id: number;
    error_group_id: number;
    is_new_group: boolean;
    fingerprint: string;
  }>;
}

interface CaptureErrorParams extends CaptureErrorRequest {
  "x-api-key": Header<"X-API-Key">;
}

// Captures error data for a project, supporting both single errors and bulk capture.
export const captureError = api<CaptureErrorParams, CaptureErrorResponse>(
  { expose: true, method: "POST", path: "/api/capture/error" },
  async (req) => {
    const projectId = await validateApiKey(req["x-api-key"]);
    
    const errorsToProcess = req.errors || [req];
    const errorIds: number[] = [];
    const errorGroups: Array<{
      error_id: number;
      error_group_id: number;
      is_new_group: boolean;
      fingerprint: string;
    }> = [];
    
    for (const errorData of errorsToProcess) {
      // First insert the error
      const result = await db.queryRow<{ id: number }>`
        INSERT INTO errors (
          project_id, message, stack_trace, url, user_agent, 
          session_id, metadata, timestamp
        )
        VALUES (
          ${projectId}, ${errorData.message}, ${errorData.stack_trace}, 
          ${errorData.url}, ${errorData.user_agent}, ${errorData.session_id}, 
          ${JSON.stringify(errorData.metadata || {})}, NOW()
        )
        RETURNING id
      `;
      
      if (result) {
        errorIds.push(result.id);
        
        // Process error for intelligent grouping
        try {
          const groupingResult = await processError({
            project_id: projectId,
            error_id: result.id,
            error_data: {
              message: errorData.message,
              stack_trace: errorData.stack_trace,
              url: errorData.url,
              user_agent: errorData.user_agent
            },
            user_id: errorData.metadata?.userId,
            session_id: errorData.session_id
          });
          
          errorGroups.push({
            error_id: result.id,
            error_group_id: groupingResult.error_group_id,
            is_new_group: groupingResult.is_new_group,
            fingerprint: groupingResult.fingerprint
          });
        } catch (error) {
          // Log the grouping error but don't fail the capture
          console.error('Error grouping failed for error', result.id, error);
        }
      }
    }
    
    return {
      success: true,
      error_ids: errorIds,
      error_groups: errorGroups
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
