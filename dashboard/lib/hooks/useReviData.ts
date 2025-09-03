'use client';

import { useQuery, useMutation, UseQueryOptions, useQueryClient } from '@tanstack/react-query';
import apiClient, { 
  ListErrorsParams, 
  ListErrorsResponse, 
  GetSessionEventsResponse, 
  ProjectStats, 
  ErrorWithSession,
  CreateProjectRequest,
  ListProjectsResponse,
  GetProjectResponse,
  ListSessionsParams,
  ListSessionsResponse,
  UpdateErrorStatusRequest
} from '../revi-api';

// Query keys for consistent caching
export const queryKeys = {
  errors: (params: ListErrorsParams) => ['errors', params] as const,
  sessions: (params: ListSessionsParams) => ['sessions', params] as const,
  sessionEvents: (sessionId: string) => ['sessionEvents', sessionId] as const,
  projectStats: (projectId?: number, days: number = 7) => ['projectStats', projectId, days] as const,
  errorById: (errorId: number) => ['error', errorId] as const,
  health: () => ['health'] as const,
  projects: () => ['projects'] as const,
  project: (id: number) => ['project', id] as const,
};

// Hook for fetching errors with pagination and filtering
export function useErrors(
  params: ListErrorsParams = {},
  options?: Partial<UseQueryOptions<ListErrorsResponse, Error>>
) {
  return useQuery({
    queryKey: queryKeys.errors(params),
    queryFn: () => apiClient.getErrors(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false, // Prevent unnecessary refetches on mount
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    ...options,
  });
}

// Hook for fetching session events and timeline
export function useSessionEvents(
  sessionId: string,
  options?: Partial<UseQueryOptions<GetSessionEventsResponse, Error>>
) {
  return useQuery({
    queryKey: queryKeys.sessionEvents(sessionId),
    queryFn: () => apiClient.getSessionEvents(sessionId),
    enabled: !!sessionId, // Only fetch if sessionId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes (session data doesn't change often)
    ...options,
  });
}

// Hook for fetching project statistics and dashboard metrics
export function useProjectStats(
  projectId?: number,
  days: number = 7,
  options?: Partial<UseQueryOptions<ProjectStats, Error>>
) {
  return useQuery({
    queryKey: queryKeys.projectStats(projectId, days),
    queryFn: () => apiClient.getProjectStats(projectId || apiClient.getProjectId(), days),
    enabled: !!projectId || !!apiClient.getProjectId(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false, // Prevent unnecessary refetches on mount
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    ...options,
  });
}

// Hook for fetching a specific error by ID
export function useError(
  errorId: number,
  options?: Partial<UseQueryOptions<ErrorWithSession | null, Error>>
) {
  return useQuery({
    queryKey: queryKeys.errorById(errorId),
    queryFn: () => apiClient.getErrorById(errorId),
    enabled: !!errorId && errorId > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes (individual errors don't change)
    ...options,
  });
}

// Hook for API health check
export function useHealth(
  options?: Partial<UseQueryOptions<{ status: string; timestamp: string }, Error>>
) {
  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => apiClient.healthCheck(),
    staleTime: 60 * 1000, // 1 minute
    retry: 3,
    retryDelay: 1000,
    ...options,
  });
}

// Removed real-time hooks - these were causing infinite API calls
// Components should use the base hooks (useErrors, useProjectStats) directly

// Hook for fetching all projects
export function useProjects(
  options?: Partial<UseQueryOptions<ListProjectsResponse, Error>>
) {
  return useQuery({
    queryKey: queryKeys.projects(),
    queryFn: () => apiClient.listProjects(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

// Hook for fetching project health stats
export function useProjectHealth(projectId: number) {
  return useQuery({
    queryKey: ['projectHealth', projectId],
    queryFn: async () => {
      const [errorsResponse, statsResponse] = await Promise.all([
        apiClient.getErrors({ limit: 1 }),
        apiClient.getProjectStats(projectId, 7)
      ]);
      
      return {
        totalErrors: errorsResponse.total,
        hasRecentActivity: errorsResponse.errors.length > 0,
        lastActivity: errorsResponse.errors[0]?.timestamp,
        errorRate: statsResponse.errorRate || 0,
        activeSessions: statsResponse.activeSessions || 0,
      };
    },
    enabled: !!projectId && projectId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - health data doesn't change frequently
  });
}

// Hook for fetching a specific project
export function useProject(
  id: number,
  options?: Partial<UseQueryOptions<GetProjectResponse, Error>>
) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => apiClient.getProject(id),
    enabled: !!id && id > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

// Hook for creating a new project
export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateProjectRequest) => apiClient.createProject(data),
    onSuccess: () => {
      // Invalidate projects list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
  });
}

// Hook for updating error status
export function useUpdateErrorStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ errorId, data }: { errorId: number; data: UpdateErrorStatusRequest }) => 
      apiClient.updateErrorStatus(errorId, data),
    onSuccess: () => {
      // Invalidate errors list to refetch
      queryClient.invalidateQueries({ queryKey: ['errors'] });
      queryClient.invalidateQueries({ queryKey: ['projectStats'] });
    },
  });
}

// Hook for bulk updating error status
export function useBulkUpdateErrorStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ errorIds, data }: { errorIds: number[]; data: UpdateErrorStatusRequest }) => 
      apiClient.bulkUpdateErrorStatus(errorIds, data),
    onSuccess: () => {
      // Invalidate errors list to refetch
      queryClient.invalidateQueries({ queryKey: ['errors'] });
      queryClient.invalidateQueries({ queryKey: ['projectStats'] });
    },
  });
}

// Hook for fetching sessions with pagination and filtering
export function useSessions(
  params: ListSessionsParams = {},
  options?: Partial<UseQueryOptions<ListSessionsResponse, Error>>
) {
  return useQuery({
    queryKey: queryKeys.sessions(params),
    queryFn: () => apiClient.getSessions(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

// Removed real-time session monitoring - use useSessions directly instead

// Utility hook for invalidating queries
export function useReviQueryClient() {
  const queryClient = useQueryClient();
  
  return {
    invalidateErrors: () => queryClient.invalidateQueries({ queryKey: ['errors'] }),
    invalidateSessions: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
    invalidateProjectStats: (projectId?: number) => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['projectStats', projectId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['projectStats'] });
      }
    },
    invalidateSessionEvents: (sessionId?: string) => 
      queryClient.invalidateQueries({ 
        queryKey: sessionId ? queryKeys.sessionEvents(sessionId) : ['sessionEvents'] 
      }),
    invalidateProjects: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}