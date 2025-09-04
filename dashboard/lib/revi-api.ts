// Revi API client for connecting Next.js dashboard to backend
export interface ErrorWithSession {
  id: number;
  project_id: number;
  message: string;
  stack_trace?: string;
  url?: string;
  user_agent?: string;
  session_id?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  session_metadata?: Record<string, unknown>;
  session_user_id?: string;
  status?: 'new' | 'investigating' | 'resolved' | 'ignored';
  assigned_to?: string;
  resolved_at?: Date;
  resolution_notes?: string;
}

export interface ListErrorsParams {
  page?: number;
  limit?: number;
  session_id?: string;
  start_date?: string;
  end_date?: string;
  status?: 'new' | 'investigating' | 'resolved' | 'ignored';
}

export interface UpdateErrorStatusRequest {
  status: 'new' | 'investigating' | 'resolved' | 'ignored';
  assigned_to?: string;
  resolution_notes?: string;
}

export interface UpdateErrorStatusResponse {
  success: true;
  error: ErrorWithSession;
}

export interface ListErrorsResponse {
  errors: ErrorWithSession[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface SessionEventData {
  id: number;
  session_id: string;
  event_type: string;
  data: Record<string, unknown>;
  timestamp: Date;
  source: 'session' | 'network' | 'error';
}

export interface SessionInfo {
  session_id: string;
  project_id: number;
  user_id?: string;
  started_at: Date;
  ended_at?: Date;
  metadata: Record<string, unknown>;
}

export interface GetSessionEventsResponse {
  events: SessionEventData[];
  session_info: SessionInfo | null;
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
  metadata: Record<string, unknown>;
  user_agent?: string;
  ip_address?: string;
}

export interface ListSessionsParams {
  page?: number;
  limit?: number;
  user_id?: string;
  start_date?: string;
  end_date?: string;
  has_errors?: boolean;
}

export interface ListSessionsResponse {
  sessions: SessionSummary[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface ProjectStats {
  totalErrors: number;
  errorRate: number;
  activeSessions: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastSeen: Date;
  }>;
  errorTrend: Array<{
    date: string;
    count: number;
  }>;
  browserDistribution: Array<{
    browser: string;
    version?: string;
    count: number;
    percentage: number;
  }>;
  osDistribution: Array<{
    os: string;
    version?: string;
    count: number;
    percentage: number;
  }>;
  topErrorPages: Array<{
    url: string;
    count: number;
    percentage: number;
  }>;
  errorsByStatus: {
    new: number;
    investigating: number;
    resolved: number;
    ignored: number;
  };
  averageSessionDuration: number;
  uniqueUsers: number;
}

export interface APIError {
  success: false;
  error: string;
  status?: number;
}

// Dashboard Overview Types
export interface ProjectHealthSummary {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
  totalErrors: number;
  hasRecentActivity: boolean;
  lastActivity?: Date;
  errorRate: number;
  activeSessions: number;
  status: 'critical' | 'warning' | 'active' | 'healthy' | 'unknown';
}

export interface DashboardOverview {
  success: true;
  summary: {
    totalProjects: number;
    totalErrors: number;
    totalActiveSessions: number;
    totalUniqueUsers: number;
    lastActivity?: Date;
    avgErrorRate: number;
  };
  projectsHealth?: ProjectHealthSummary[];
  recentErrorTrend: Array<{
    date: string;
    count: number;
  }>;
  topErrorMessages: Array<{
    message: string;
    count: number;
    affectedProjects: number;
  }>;
}

export interface BatchHealthCheckRequest {
  projectIds: number[];
  days?: number;
}

export interface BatchHealthCheckResponse {
  success: true;
  projects: Record<number, {
    totalErrors: number;
    hasRecentActivity: boolean;
    lastActivity?: Date;
    errorRate: number;
    activeSessions: number;
    status: 'critical' | 'warning' | 'active' | 'healthy' | 'unknown';
  }>;
}

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
  success: true;
  project: Project;
}

export interface ListProjectsResponse {
  success: true;
  projects: Project[];
}

export interface GetProjectResponse {
  success: true;
  project: Project;
}

class ReviAPIClient {
  private baseURL: string;
  private projectId: number;
  
  constructor(
    baseURL: string = process.env.NEXT_PUBLIC_REVI_API_URL || 'http://localhost:4000', 
    projectId: number = parseInt(process.env.NEXT_PUBLIC_REVI_PROJECT_ID || '1')
  ) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.projectId = projectId;
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async getErrors(params: ListErrorsParams = {}): Promise<ListErrorsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.session_id) searchParams.append('session_id', params.session_id);
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    
    const queryString = searchParams.toString();
    const endpoint = `/api/errors/${this.projectId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.makeRequest<ListErrorsResponse>(endpoint);
    
    // Convert date strings to Date objects
    response.errors = response.errors.map(error => ({
      ...error,
      timestamp: new Date(error.timestamp),
    }));
    
    return response;
  }

  async getSessionEvents(sessionId: string): Promise<GetSessionEventsResponse> {
    const endpoint = `/api/session/${encodeURIComponent(sessionId)}/events`;
    const response = await this.makeRequest<GetSessionEventsResponse>(endpoint);
    
    // Convert date strings to Date objects
    response.events = response.events.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp),
    }));
    
    if (response.session_info) {
      response.session_info.started_at = new Date(response.session_info.started_at);
      if (response.session_info.ended_at) {
        response.session_info.ended_at = new Date(response.session_info.ended_at);
      }
    }
    
    return response;
  }

  async getProjectStats(projectId?: number, days: number = 7): Promise<ProjectStats> {
    const targetProjectId = projectId || this.projectId;
    const endpoint = `/api/projects/${targetProjectId}/stats?days=${days}`;
    return this.makeRequest<ProjectStats>(endpoint);
  }

  async getErrorById(errorId: number): Promise<ErrorWithSession | null> {
    // Get all errors and find the one with matching ID
    // Note: This is not optimal - ideally backend would have a dedicated endpoint
    const response = await this.getErrors({ limit: 1000 });
    return response.errors.find(error => error.id === errorId) || null;
  }

  // Health check to verify API connection
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest('/health');
  }

  // Update project ID for multi-project support
  setProjectId(projectId: number) {
    this.projectId = projectId;
  }

  getProjectId(): number {
    return this.projectId;
  }

  // Project management methods
  async createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    const response = await this.makeRequest<CreateProjectResponse>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    // Convert date strings to Date objects
    response.project.created_at = new Date(response.project.created_at);
    response.project.updated_at = new Date(response.project.updated_at);
    
    return response;
  }

  async listProjects(): Promise<ListProjectsResponse> {
    const response = await this.makeRequest<ListProjectsResponse>('/api/projects');
    
    // Convert date strings to Date objects
    response.projects = response.projects.map(project => ({
      ...project,
      created_at: new Date(project.created_at),
      updated_at: new Date(project.updated_at),
    }));
    
    return response;
  }

  async getProject(id: number): Promise<GetProjectResponse> {
    const response = await this.makeRequest<GetProjectResponse>(`/api/projects/${id}`);
    
    // Convert date strings to Date objects
    response.project.created_at = new Date(response.project.created_at);
    response.project.updated_at = new Date(response.project.updated_at);
    
    return response;
  }

  // Session management methods
  async getSessions(params: ListSessionsParams = {}): Promise<ListSessionsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.user_id) searchParams.append('user_id', params.user_id);
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.has_errors !== undefined) searchParams.append('has_errors', params.has_errors.toString());
    
    const queryString = searchParams.toString();
    const endpoint = `/api/sessions/${this.projectId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.makeRequest<ListSessionsResponse>(endpoint);
    
    // Convert date strings to Date objects
    response.sessions = response.sessions.map(session => ({
      ...session,
      started_at: new Date(session.started_at),
      ended_at: session.ended_at ? new Date(session.ended_at) : undefined,
    }));
    
    return response;
  }

  // Error status management methods
  async updateErrorStatus(errorId: number, data: UpdateErrorStatusRequest): Promise<UpdateErrorStatusResponse> {
    const response = await this.makeRequest<UpdateErrorStatusResponse>(`/api/errors/${errorId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    
    // Convert date strings to Date objects
    response.error.timestamp = new Date(response.error.timestamp);
    if (response.error.resolved_at) {
      response.error.resolved_at = new Date(response.error.resolved_at);
    }
    
    return response;
  }

  async bulkUpdateErrorStatus(errorIds: number[], data: UpdateErrorStatusRequest): Promise<{ success: true; updated_count: number }> {
    return this.makeRequest('/api/errors/bulk/status', {
      method: 'PUT',
      body: JSON.stringify({
        error_ids: errorIds,
        ...data,
      }),
    });
  }

  // Dashboard aggregation methods
  async getDashboardOverview(days: number = 7, includeProjectHealth: boolean = true): Promise<DashboardOverview> {
    const params = new URLSearchParams();
    params.append('days', days.toString());
    params.append('includeProjectHealth', includeProjectHealth.toString());
    
    const response = await this.makeRequest<DashboardOverview>(
      `/api/dashboard/overview?${params.toString()}`
    );
    
    // Convert date strings to Date objects
    if (response.summary.lastActivity) {
      response.summary.lastActivity = new Date(response.summary.lastActivity);
    }
    
    if (response.projectsHealth) {
      response.projectsHealth = response.projectsHealth.map(project => ({
        ...project,
        created_at: new Date(project.created_at),
        updated_at: new Date(project.updated_at),
        lastActivity: project.lastActivity ? new Date(project.lastActivity) : undefined
      }));
    }
    
    return response;
  }

  async batchHealthCheck(projectIds: number[], days: number = 7): Promise<BatchHealthCheckResponse> {
    const response = await this.makeRequest<BatchHealthCheckResponse>('/api/projects/health/batch', {
      method: 'POST',
      body: JSON.stringify({
        projectIds,
        days
      }),
    });
    
    // Convert date strings to Date objects in the response
    Object.keys(response.projects).forEach(projectId => {
      const project = response.projects[parseInt(projectId)];
      if (project.lastActivity) {
        project.lastActivity = new Date(project.lastActivity);
      }
    });
    
    return response;
  }
}

// Create a singleton instance
const defaultApiClient = new ReviAPIClient();

export { ReviAPIClient };
export default defaultApiClient;