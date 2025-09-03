'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import apiClient from '@/lib/revi-api';

interface ProjectContextType {
  currentProjectId: number | null;
  setCurrentProjectId: (projectId: number | null) => void;
  isProjectRoute: boolean;
  extractedProjectId: number | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const pathname = usePathname();
  const [currentProjectId, setCurrentProjectIdState] = useState<number | null>(() => {
    // Initialize from apiClient
    const stored = apiClient.getProjectId();
    return stored || null;
  });

  // Extract project ID from URL if we're on a project-specific route
  const extractedProjectId = (() => {
    const projectRouteMatch = pathname.match(/^\/dashboard\/projects\/(\d+)/);
    if (projectRouteMatch) {
      return parseInt(projectRouteMatch[1], 10);
    }
    return null;
  })();

  // Check if we're on a project-specific route
  const isProjectRoute = extractedProjectId !== null;

  // Sync extracted project ID with global state when on project routes
  useEffect(() => {
    if (isProjectRoute && extractedProjectId && extractedProjectId !== currentProjectId) {
      // Auto-set project ID when navigating to project-specific routes
      setCurrentProjectIdState(extractedProjectId);
      apiClient.setProjectId(extractedProjectId);
    }
  }, [isProjectRoute, extractedProjectId, currentProjectId]);

  // Function to manually set project ID (used by ProjectSelector)
  const setCurrentProjectId = (projectId: number | null) => {
    setCurrentProjectIdState(projectId);
    if (projectId) {
      apiClient.setProjectId(projectId);
    }
  };

  // Sync apiClient when currentProjectId changes
  useEffect(() => {
    if (currentProjectId) {
      apiClient.setProjectId(currentProjectId);
    }
  }, [currentProjectId]);

  const contextValue: ProjectContextType = {
    currentProjectId,
    setCurrentProjectId,
    isProjectRoute,
    extractedProjectId,
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}