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
      <FolderOpen className="h-5 w-5 text-emerald-400" strokeWidth={1.5}/>
      <Select value={currentProjectId?.toString() || ""} onValueChange={handleProjectChange}>
        <SelectTrigger className="w-full h-12 bg-white/10 backdrop-blur-sm border border-white/20 hover:border-emerald-500/50 hover:bg-white/15 transition-all duration-300 font-light text-white rounded-lg">
          <div className="flex items-center justify-between w-full">
            <SelectValue>
              <div className="flex items-center gap-2 text-white font-light">
                <span className="truncate">
                  {currentProject?.name || 'Select Project'}
                </span>
                {currentProject && (
                  <Badge variant="secondary" className="text-xs font-light bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    {currentProject.id}
                  </Badge>
                )}
              </div>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className='bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl'>
          {projects.map((project) => (
            <SelectItem 
              className='w-full border-none font-light text-gray-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer' 
              key={project.id} 
              value={project.id.toString()}
            >
              <div className="flex items-center justify-between w-40">
                <span className="truncate pr-2 font-light">{project.name}</span>
                <Badge variant="outline" className="text-xs font-light bg-transparent border-gray-500 text-gray-400">
                  {project.id}
                </Badge>
              </div>
            </SelectItem>
          ))}
          
          {projects.length > 0 && (
            <>
              <Separator className="my-1 bg-white/20" />
              <SelectItem value="create-new" className="w-full font-light hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 cursor-pointer">
                <div className="flex items-center gap-2 text-emerald-400 font-light">
                  <Plus className="h-4 w-4" />
                  <span className="font-light">Create New Project</span>
                </div>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}