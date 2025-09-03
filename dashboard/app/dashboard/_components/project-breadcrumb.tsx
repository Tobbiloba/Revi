'use client';

import { usePathname } from 'next/navigation';
import { useProjects } from '@/lib/hooks/useReviData';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigationContext } from '@/lib/hooks/useNavigationContext';

export function ProjectBreadcrumb() {
  const pathname = usePathname();
  const { isProjectContext, currentProjectId } = useNavigationContext();
  const { data: projectsResponse, isLoading } = useProjects();
  
  if (!isProjectContext || !currentProjectId) {
    return null;
  }

  const projects = projectsResponse?.projects || [];
  const currentProject = projects.find(p => p.id === currentProjectId);

  // Parse current page from pathname
  const getPageName = () => {
    if (pathname.includes('/dashboard')) return 'Overview';
    if (pathname.includes('/errors')) return 'Errors';
    if (pathname.includes('/sessions')) return 'Sessions';
    if (pathname.includes('/settings')) return 'Settings';
    return 'Overview';
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-20" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-16" />
      </div>
    );
  }

  return (
    <div className="mb-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/projects">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">
              {currentProject?.name || `Project ${currentProjectId}`}
            </BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-muted-foreground">
              {getPageName()}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}