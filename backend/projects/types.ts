export interface Project {
  id: number;
  name: string;
  api_key: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProjectRequest {
  name: string;
}

export interface CreateProjectResponse {
  project: Project;
}

export interface GetProjectResponse {
  project: Project;
}

export interface Session {
  id: number;
  project_id: number;
  session_id: string;
  user_id?: string;
  started_at: Date;
  ended_at?: Date;
  metadata: Record<string, any>;
}

export interface Error {
  id: number;
  project_id: number;
  message: string;
  stack_trace?: string;
  url?: string;
  user_agent?: string;
  session_id?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface SessionEvent {
  id: number;
  session_id: string;
  event_type: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface NetworkEvent {
  id: number;
  session_id: string;
  method: string;
  url: string;
  status_code?: number;
  response_time?: number;
  timestamp: Date;
  request_data: Record<string, any>;
  response_data: Record<string, any>;
}
