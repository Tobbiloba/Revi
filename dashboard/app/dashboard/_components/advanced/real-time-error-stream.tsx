'use client';

import React, { useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconAlertCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
  IconWifi,
  IconWifiOff,
  IconVolume,
  IconVolumeOff,
  IconFilter,
  IconRefresh
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useRealTimeErrors } from '@/lib/hooks/useRealTimeErrors';
import { RealTimeError, ErrorStreamFilters } from '@/lib/websocket/error-stream-client';
import { Label } from "@/components/ui/label";

interface RealTimeErrorStreamProps {
  projectId?: number;
  className?: string;
  maxHeight?: number;
  enableSound?: boolean;
  enableFilters?: boolean;
  onErrorClick?: (error: RealTimeError) => void;
}

const ErrorSeverityBadge: React.FC<{ severity?: string; className?: string }> = ({ 
  severity, 
  className 
}) => {
  const severityConfig = {
    critical: { variant: 'destructive' as const, label: 'CRITICAL', bg: 'bg-red-500' },
    high: { variant: 'destructive' as const, label: 'HIGH', bg: 'bg-orange-500' },
    medium: { variant: 'secondary' as const, label: 'MED', bg: 'bg-yellow-500' },
    low: { variant: 'outline' as const, label: 'LOW', bg: 'bg-blue-500' }
  };

  const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.medium;

  return (
    <Badge variant={config.variant} className={cn("text-xs font-medium", className)}>
      {config.label}
    </Badge>
  );
};

const ConnectionIndicator: React.FC<{ isConnected: boolean; isReconnecting: boolean }> = ({ 
  isConnected, 
  isReconnecting 
}) => (
  <div className="flex items-center gap-2">
    {isConnected ? (
      <>
        <IconWifi className="size-4 text-green-500" />
        <span className="text-sm text-green-600 font-medium">Live</span>
      </>
    ) : isReconnecting ? (
      <>
        <IconRefresh className="size-4 text-yellow-500 animate-spin" />
        <span className="text-sm text-yellow-600">Reconnecting...</span>
      </>
    ) : (
      <>
        <IconWifiOff className="size-4 text-red-500" />
        <span className="text-sm text-red-600">Disconnected</span>
      </>
    )}
  </div>
);

const ErrorItem: React.FC<{
  error: RealTimeError;
  onErrorClick?: (error: RealTimeError) => void;
  onMarkAsRead: (errorId: number) => void;
}> = ({ error, onErrorClick, onMarkAsRead }) => {
  const handleClick = useCallback(() => {
    onErrorClick?.(error);
    if (error.isNew) {
      onMarkAsRead(error.id);
    }
  }, [error, onErrorClick, onMarkAsRead]);

  return (
    <div className="px-4 py-2">
      <div
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
          "hover:bg-muted/50",
          error.isNew && "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
        )}
        onClick={handleClick}
      >
        <div className="flex-shrink-0 mt-1">
          <ErrorSeverityBadge severity={error.severity} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {error.isNew && (
              <div className="size-2 bg-blue-500 rounded-full animate-pulse" />
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}
            </span>
            {error.url && (
              <Badge variant="outline" className="text-xs font-mono">
                {error.url.split('/').pop() || error.url}
              </Badge>
            )}
          </div>
          
          <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">
            {error.message}
          </p>
          
          {error.session_user_id && (
            <p className="text-xs text-muted-foreground">
              User: {error.session_user_id}
            </p>
          )}
        </div>
        
        <div className="flex-shrink-0">
          <IconAlertCircle className="size-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};

const FilterPanel: React.FC<{
  filters: ErrorStreamFilters;
  onFiltersChange: (filters: ErrorStreamFilters) => void;
  onClose: () => void;
}> = ({ filters, onFiltersChange, onClose }) => {
  const handleSeverityChange = (severity: string) => {
    const currentSeverities = filters.severity || [];
    const newSeverities = currentSeverities.includes(severity)
      ? currentSeverities.filter(s => s !== severity)
      : [...currentSeverities, severity];
    
    onFiltersChange({ ...filters, severity: newSeverities });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs font-medium">Severity Levels</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {['critical', 'high', 'medium', 'low'].map(severity => (
              <Button
                key={severity}
                variant={filters.severity?.includes(severity) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSeverityChange(severity)}
                className="text-xs"
              >
                {severity.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        
        <div>
          <Label className="text-xs font-medium">Time Range</Label>
          <Select
            value={filters.timeRange?.toString() || 'all'}
            onValueChange={(value) => 
              onFiltersChange({
                ...filters,
                timeRange: value === 'all' ? undefined : parseInt(value)
              })
            }
          >
            <SelectTrigger className="w-full h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="5">Last 5 minutes</SelectItem>
              <SelectItem value="15">Last 15 minutes</SelectItem>
              <SelectItem value="60">Last hour</SelectItem>
              <SelectItem value="360">Last 6 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export const RealTimeErrorStream: React.FC<RealTimeErrorStreamProps> = ({
  projectId,
  className,
  maxHeight = 600,
  enableSound = true,
  enableFilters = true,
  onErrorClick
}) => {
  const [filters, setFilters] = useState<ErrorStreamFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(enableSound);

  const {
    errors,
    totalCount,
    isPaused,
    newErrorsCount,
    isConnected,
    connectionStatus,
    pauseStream,
    resumeStream,
    clearErrors,
    updateFilters,
    markErrorAsRead
  } = useRealTimeErrors({
    projectId,
    maxErrors: 1000,
    filters,
    enableNotifications: true,
    onNewError: (error) => {
      if (soundEnabled && error.severity === 'critical') {
        // Play notification sound for critical errors
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {}); // Ignore errors if sound can't play
      }
    }
  });

  const handleFiltersChange = useCallback((newFilters: ErrorStreamFilters) => {
    setFilters(newFilters);
    updateFilters(newFilters);
  }, [updateFilters]);

  return (
    <div className={cn("flex flex-col", className)}>
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-xl font-normal">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <IconAlertCircle className="size-6 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-gray-800 dark:text-gray-200">Real-time Error Stream</span>
                {newErrorsCount > 0 && !isPaused && (
                  <Badge variant="secondary" className="ml-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-0 font-light">
                    +{newErrorsCount}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="flex items-center gap-4 mt-2 text-gray-600 dark:text-gray-400 text-base font-light">
                <span>{totalCount} total errors</span>
                <ConnectionIndicator 
                  isConnected={isConnected} 
                  isReconnecting={connectionStatus.reconnecting} 
                />
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {enableFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors font-normal",
                    showFilters && "bg-emerald-100 dark:bg-emerald-900/30"
                  )}
                >
                  <IconFilter className="size-4 text-gray-600 dark:text-gray-400" />
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={cn(
                  "bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-normal",
                  !soundEnabled && "text-gray-400 dark:text-gray-500"
                )}
              >
                {soundEnabled ? (
                  <IconVolume className="size-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <IconVolumeOff className="size-4" />
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={isPaused ? resumeStream : pauseStream}
                className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 transition-colors font-normal"
              >
                {isPaused ? (
                  <IconPlayerPlay className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <IconPlayerPause className="size-4 text-yellow-600 dark:text-yellow-400" />
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={clearErrors}
                disabled={errors.length === 0}
                className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors font-normal disabled:opacity-50"
              >
                <IconTrash className="size-4 text-red-600 dark:text-red-400" />
              </Button>
            </div>
          </div>
          
          {isPaused && newErrorsCount > 0 && (
            <div className="flex items-center justify-between mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {newErrorsCount} new error{newErrorsCount > 1 ? 's' : ''} received
              </span>
              <Button size="sm" onClick={resumeStream}>
                Show New Errors
              </Button>
            </div>
          )}
        </CardHeader>
        
        {showFilters && enableFilters && (
          <CardContent className="pt-0">
            <FilterPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClose={() => setShowFilters(false)}
            />
          </CardContent>
        )}
        
        <CardContent className="pt-0">
          <div className="border rounded-lg overflow-hidden" style={{ height: maxHeight }}>
            {errors.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <IconAlertCircle className="size-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No errors detected</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {isConnected 
                    ? "Your application is running smoothly. New errors will appear here in real-time."
                    : "Connect to start monitoring errors in real-time."
                  }
                </p>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="space-y-1">
                  {errors.map((error) => (
                    <ErrorItem
                      key={error.id}
                      error={error}
                      onErrorClick={onErrorClick}
                      onMarkAsRead={markErrorAsRead}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};