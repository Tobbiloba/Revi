'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useProjectContext } from '@/lib/contexts/ProjectContext';

export type NavigationContext = 'global' | 'project';

export function useNavigationContext() {
  const pathname = usePathname();
  const { currentProjectId, isProjectRoute } = useProjectContext();
  
  const context = useMemo((): NavigationContext => {
    // Always treat these as global pages regardless of project selection
    const globalPages = [
      '/dashboard',
      '/dashboard/projects', 
      '/dashboard/projects/create',
      '/dashboard/settings'
    ];
    
    if (globalPages.includes(pathname)) {
      return 'global';
    }
    
    // Check if we're in a project-specific route
    if (pathname.startsWith('/dashboard/project/') || 
        pathname.match(/^\/dashboard\/projects\/\d+/) ||
        pathname.startsWith('/dashboard/errors') ||
        pathname.startsWith('/dashboard/sessions') ||
        isProjectRoute) {
      return 'project';
    }
    
    return 'global';
  }, [pathname, isProjectRoute]);

  return {
    context,
    isGlobalContext: context === 'global',
    isProjectContext: context === 'project',
    currentProjectId,
  };
}