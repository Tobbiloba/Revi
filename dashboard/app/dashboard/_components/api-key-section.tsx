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
    <div className="px-3 py-4 border-t border-white/30 bg-gradient-to-r from-white/5 via-transparent to-cyan-500/5 backdrop-blur-sm rounded-sm mb-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <IconKey className="h-4 w-4 text-emerald-400" />
          <Label className="text-xs font-light text-gray-300 uppercase tracking-wide">
            API Key
          </Label>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs font-light bg-white/10 text-gray-200 border-white/20">
              {currentProject.name}
            </Badge>
            <div className="flex items-center gap-1">
              {health?.hasRecentActivity ? (
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50" title="Active - receiving data" />
              ) : (
                <div className="w-2 h-2 bg-gray-500 rounded-full" title="No recent activity" />
              )}
              <Badge variant="outline" className="text-xs font-light bg-transparent border-gray-500 text-gray-400">
                ID: {currentProject.id}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Input
              value={currentProject.api_key}
              readOnly
              className="font-mono text-xs h-9 pr-16 bg-black/40 border-white/20 text-gray-200 focus:border-emerald-500/50 transition-colors duration-300"
              type={showApiKey ? "text" : "password"}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleApiKeyVisibility}
                className="h-9 w-9 p-0 hover:bg-white/10 transition-colors duration-300 text-gray-400 hover:text-emerald-400"
              >
                {showApiKey ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyApiKey}
                className="h-9 w-9 p-0 hover:bg-emerald-500/10 transition-colors duration-300 text-gray-400 hover:text-emerald-400"
              >
                {copiedApiKey ? (
                  <IconCheck className="h-4 w-4 text-emerald-500" />
                ) : (
                  <IconCopy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-gray-400 font-light">
            Use this key to configure the Revi SDK
          </p>
        </div>
      </div>
    </div>
  );
}