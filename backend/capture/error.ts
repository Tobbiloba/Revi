import { api, Header, APIError } from "encore.dev/api";
import { db } from "./db";

export interface CaptureErrorRequest {
  message: string;
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
    
    for (const errorData of errorsToProcess) {
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
      }
    }
    
    return {
      success: true,
      error_ids: errorIds
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
