'use client';

import { useRouter } from 'next/navigation';
import { useProjects } from '@/lib/hooks/useReviData';
import { useProjectContext } from '@/lib/contexts/ProjectContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, Plus } from "lucide-react";

export function ProjectSelector() {
  const { data: projectsResponse, isLoading, error } = useProjects();
  const { currentProjectId, setCurrentProjectId } = useProjectContext();
  const router = useRouter();

  const projects = projectsResponse?.projects || [];

  const handleProjectChange = (value: string) => {
    // Handle create new project option
    if (value === 'create-new') {
      router.push('/dashboard/projects/create');
      return;
    }

    const projectId = parseInt(value);
    setCurrentProjectId(projectId);
    
    // Navigate to the project dashboard
    router.push(`/dashboard/projects/${projectId}/dashboard`);
  };

  const currentProject = projects.find(p => p.id === currentProjectId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  if (error || projects.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FolderOpen className="h-4 w-4" />
        <span>No Projects</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 w-full">
      {/* <FolderOpen className="h-5 w-5 text-lime-500" strokeWidth={1}/> */}
      <Select value={currentProjectId?.toString() || ""} onValueChange={handleProjectChange}>
        <SelectTrigger style={{
          background: "rgba(255, 255, 255, 0.2)",
          boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          height: "48px"
        }} className="w-full h-16 outline-none">
          <div className="flex items-center justify-between w-full">
            <SelectValue className=''>
              <div className="flex items-center gap-2 text-white font-[300]">
                <span className="truncate">
                  {currentProject?.name || 'Select Project'}
                </span>
                {currentProject && (
                  <Badge variant="secondary" className="text-xs font-[300]">
                    {currentProject.id}
                  </Badge>
                )}
              </div>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent style={{
          background: "rgba(255, 255, 255, 0.2)",
          boxShadow: "0 4px 30px rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
        }}>
          {projects.map((project) => (
            <SelectItem className='w-full' key={project.id} value={project.id.toString()}>
              <div className="flex items-center justify-between border w-40">
                <span className="truncate pr-2">{project.name}</span>
                <Badge variant="outline" className="text-xs">
                  {project.id}
                </Badge>
              </div>
            </SelectItem>
          ))}
          
          {projects.length > 0 && (
            <>
              <Separator className="my-1" />
              <SelectItem value="create-new" className="w-full">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                  <Plus className="h-4 w-4" />
                  <span>Create New Project</span>
                </div>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}