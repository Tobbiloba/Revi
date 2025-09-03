'use client';

import { useState } from 'react';
import { useProjects, useProjectHealth } from '@/lib/hooks/useReviData';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { IconKey, IconCopy, IconCheck, IconEye, IconEyeOff } from "@tabler/icons-react";
import { toast } from "sonner";
import apiClient from '@/lib/revi-api';

export function ApiKeySection() {
  const { data: projectsResponse, isLoading } = useProjects();
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const projects = projectsResponse?.projects || [];
  const currentProjectId = apiClient.getProjectId();
  const currentProject = projects.find(p => p.id === currentProjectId);
  const { data: health } = useProjectHealth(currentProjectId);

  const copyApiKey = async () => {
    if (!currentProject?.api_key) return;
    
    try {
      await navigator.clipboard.writeText(currentProject.api_key);
      setCopiedApiKey(true);
      toast.success('API key copied to clipboard');
      
      setTimeout(() => setCopiedApiKey(false), 2000);
    } catch {
      toast.error('Failed to copy API key');
    }
  };

  const toggleApiKeyVisibility = () => {
    setShowApiKey(!showApiKey);
  };

  if (isLoading) {
    return (
      <div className="px-3 py-4 border-t border-lime-500/20">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return null;
  }

  return (
    <div className="px-3 py-4 border-t border-lime-500/20">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <IconKey className="h-4 w-4 text-lime-500" />
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            API Key
          </Label>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              {currentProject.name}
            </Badge>
            <div className="flex items-center gap-1">
              {health?.hasRecentActivity ? (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Active - receiving data" />
              ) : (
                <div className="w-2 h-2 bg-gray-400 rounded-full" title="No recent activity" />
              )}
              <Badge variant="outline" className="text-xs">
                ID: {currentProject.id}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Input
              value={currentProject.api_key}
              readOnly
              className="font-mono text-xs h-8 pr-16"
              type={showApiKey ? "text" : "password"}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleApiKeyVisibility}
                className="h-8 w-8 p-0"
              >
                {showApiKey ? (
                  <IconEyeOff className="h-3 w-3" />
                ) : (
                  <IconEye className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyApiKey}
                className="h-8 w-8 p-0"
              >
                {copiedApiKey ? (
                  <IconCheck className="h-3 w-3 text-green-500" />
                ) : (
                  <IconCopy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Use this key to configure the Revi SDK
          </p>
        </div>
      </div>
    </div>
  );
}