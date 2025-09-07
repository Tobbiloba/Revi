'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Brain,
  AlertTriangle,
  TrendingUp,
  Settings,
  GitMerge,
  Split,
  Eye,
  EyeOff,
  Target,
  Network,
  Users,
  Clock,
  ChevronDown,
  ChevronRight,
  Hash,
  Link
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ErrorWithSession } from '@/lib/revi-api';
import { cn } from '@/lib/utils';

interface ErrorGroup {
  id: string;
  fingerprint: string;
  pattern_hash: string;
  title: string;
  message_template: string;
  stack_pattern: string;
  url_pattern: string;
  first_seen: Date;
  last_seen: Date;
  total_occurrences: number;
  unique_users: number;
  status: 'open' | 'resolved' | 'ignored' | 'investigating';
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  errors: ErrorWithSession[];
  similarity_score?: number;
}

interface ErrorGroupingViewProps {
  errors: ErrorWithSession[];
  onGroupMerge?: (groupIds: string[]) => void;
  className?: string;
}

export function ErrorGroupingView({ 
  errors, 
  onGroupMerge, 
  className 
}: ErrorGroupingViewProps) {
  const [groupingThreshold, setGroupingThreshold] = useState<number>(0.8);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'frequency' | 'recent' | 'severity' | 'users'>('frequency');
  const [showSimilar, setShowSimilar] = useState(true);
  const [similarityFilter] = useState<number>(0.7);

  // Generate error groups based on similarity patterns
  const errorGroups = useMemo((): ErrorGroup[] => {
    const groups = new Map<string, ErrorGroup>();

    errors.forEach(error => {
      // Create a simplified fingerprint based on error message and stack trace
      const messagePattern = error.message
        .replace(/\d+/g, 'N')
        .replace(/['"]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      
      const stackPattern = error.stack_trace
        ? error.stack_trace
            .split('\n')[0] // Take first line of stack trace
            .replace(/:\d+:\d+/g, ':N:N') // Replace line:column numbers
            .replace(/\/[^/]+\//g, '/') // Simplify paths
        : '';

      const urlPattern = error.url 
        ? error.url.replace(/\d+/g, 'N').replace(/[?#].*/, '') 
        : '';

      const fingerprint = `${messagePattern}|${stackPattern}|${urlPattern}`;
      const patternHash = fingerprint.slice(0, 16);

      if (groups.has(fingerprint)) {
        const group = groups.get(fingerprint)!;
        group.errors.push(error);
        group.total_occurrences++;
        group.last_seen = new Date(Math.max(group.last_seen.getTime(), new Date(error.timestamp).getTime()));
        
        // Update unique users count
        const userIds = new Set(group.errors.map(e => e.session_user_id).filter(Boolean));
        group.unique_users = userIds.size;
      } else {
        const severity = getErrorSeverity(error);
        groups.set(fingerprint, {
          id: `group_${groups.size + 1}`,
          fingerprint,
          pattern_hash: patternHash,
          title: generateGroupTitle(messagePattern),
          message_template: messagePattern,
          stack_pattern: stackPattern,
          url_pattern: urlPattern,
          first_seen: new Date(error.timestamp),
          last_seen: new Date(error.timestamp),
          total_occurrences: 1,
          unique_users: error.session_user_id ? 1 : 0,
          status: 'open',
          priority: severity,
          tags: [],
          errors: [error]
        });
      }
    });

    return Array.from(groups.values());
  }, [errors]);

  // Sort groups based on selected criteria
  const sortedGroups = useMemo(() => {
    return [...errorGroups].sort((a, b) => {
      switch (sortBy) {
        case 'frequency':
          return b.total_occurrences - a.total_occurrences;
        case 'recent':
          return b.last_seen.getTime() - a.last_seen.getTime();
        case 'severity':
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.priority] - severityOrder[a.priority];
        case 'users':
          return b.unique_users - a.unique_users;
        default:
          return 0;
      }
    });
  }, [errorGroups, sortBy]);

  const calculateSimilarity = useCallback((group1: ErrorGroup, group2: ErrorGroup): number => {
    // Simple similarity calculation based on message and stack patterns
    const messageSim = stringSimilarity(group1.message_template, group2.message_template);
    const stackSim = stringSimilarity(group1.stack_pattern, group2.stack_pattern);
    const urlSim = stringSimilarity(group1.url_pattern, group2.url_pattern);
    
    return (messageSim * 0.5 + stackSim * 0.3 + urlSim * 0.2);
  }, []);

  // Find similar groups based on similarity threshold
  const similarGroups = useMemo(() => {
    const pairs: Array<{ group1: ErrorGroup; group2: ErrorGroup; similarity: number }> = [];
    
    for (let i = 0; i < sortedGroups.length; i++) {
      for (let j = i + 1; j < sortedGroups.length; j++) {
        const similarity = calculateSimilarity(sortedGroups[i], sortedGroups[j]);
        if (similarity >= similarityFilter) {
          pairs.push({
            group1: sortedGroups[i],
            group2: sortedGroups[j],
            similarity
          });
        }
      }
    }

    return pairs.sort((a, b) => b.similarity - a.similarity);
  }, [sortedGroups, similarityFilter, calculateSimilarity]);

  // Helper functions
  const getErrorSeverity = (error: ErrorWithSession): 'critical' | 'high' | 'medium' | 'low' => {
    const metadata = error.metadata || {};
    if (metadata.severity) return metadata.severity as 'critical' | 'high' | 'medium' | 'low';
    
    const message = error.message.toLowerCase();
    if (message.includes('uncaught') || message.includes('fatal') || message.includes('crash')) {
      return 'critical';
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('failed')) {
      return 'high';
    }
    if (message.includes('warning') || message.includes('deprecated')) {
      return 'medium';
    }
    return 'low';
  };

  const generateGroupTitle = (messagePattern: string): string => {
    // Extract meaningful title from message pattern
    return messagePattern
      .replace(/^(error:|uncaught|reference|type|syntax)\s*/i, '')
      .replace(/\s+at\s+.*/, '')
      .split(' ')
      .slice(0, 6)
      .join(' ')
      .trim() || 'Generic Error';
  };


  const stringSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const getEditDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const toggleGroupSelection = useCallback((groupId: string) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  const toggleGroupExpansion = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.9) return 'text-red-600 bg-red-50';
    if (similarity >= 0.8) return 'text-orange-600 bg-orange-50';
    if (similarity >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-blue-600 bg-blue-50';
  };

  return (
    <div className={cn("flex flex-col space-y-6", className)}>
      {/* Header Controls */}
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl font-normal">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Brain className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-gray-800 dark:text-gray-200">Smart Error Grouping</span>
              <Badge variant="secondary" className="ml-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-0 font-light">
                {sortedGroups.length} groups from {errors.length} errors
              </Badge>
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showSimilar ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowSimilar(!showSimilar)}
                      className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors font-normal"
                    >
                      {showSimilar ? <Eye className="size-4 text-purple-600 dark:text-purple-400" /> : <EyeOff className="size-4 text-gray-600 dark:text-gray-400" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showSimilar ? 'Hide similarity suggestions' : 'Show similarity suggestions'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Controls Row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-normal text-gray-700 dark:text-gray-300">Sort by:</label>
              <Select value={sortBy} onValueChange={(value: 'severity' | 'frequency' | 'recent' | 'users') => setSortBy(value)}>
                <SelectTrigger className="w-32 h-8 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frequency">
                    <div className="flex items-center gap-2 font-light">
                      <TrendingUp className="size-4" />
                      Frequency
                    </div>
                  </SelectItem>
                  <SelectItem value="recent">
                    <div className="flex items-center gap-2 font-light">
                      <Clock className="size-4" />
                      Recent
                    </div>
                  </SelectItem>
                  <SelectItem value="severity">
                    <div className="flex items-center gap-2 font-light">
                      <AlertTriangle className="size-4" />
                      Severity
                    </div>
                  </SelectItem>
                  <SelectItem value="users">
                    <div className="flex items-center gap-2 font-light">
                      <Users className="size-4" />
                      Users Affected
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-2">
              <label className="text-sm font-normal text-gray-700 dark:text-gray-300">Grouping threshold:</label>
              <div className="flex items-center gap-2">
                <Input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={groupingThreshold}
                  onChange={(e) => setGroupingThreshold(parseFloat(e.target.value))}
                  className="w-20 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700"
                />
                <Badge variant="outline" className="w-12 text-xs bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">
                  {Math.round(groupingThreshold * 100)}%
                </Badge>
              </div>
            </div>

            {selectedGroups.size > 1 && (
              <>
                <Separator orientation="vertical" className="h-6" />
                <Button 
                  size="sm" 
                  onClick={() => onGroupMerge?.(Array.from(selectedGroups))}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white border-0 font-normal"
                >
                  <GitMerge className="size-4" />
                  Merge {selectedGroups.size} Groups
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Similar Groups Suggestions */}
      {showSimilar && similarGroups.length > 0 && (
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 backdrop-blur-sm shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="size-4 text-blue-600 dark:text-blue-400" />
              <span className="text-gray-800 dark:text-gray-200 font-normal">Similarity Suggestions</span>
              <Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50 text-blue-700 dark:text-blue-300 border-0 font-light">
                {similarGroups.length} potential merges
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {similarGroups.slice(0, 3).map((pair, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border-0 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Badge className={`${getSimilarityColor(pair.similarity)} px-2 py-1 text-xs font-light border-0`}>
                      {Math.round(pair.similarity * 100)}% similar
                    </Badge>
                    <div className="text-sm">
                      <span className="font-light text-gray-800 dark:text-gray-200">{pair.group1.title}</span>
                      <span className="text-gray-500 dark:text-gray-400 mx-2">←→</span>
                      <span className="font-light text-gray-800 dark:text-gray-200">{pair.group2.title}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-normal">
                    <GitMerge className="size-4 mr-2 text-blue-600 dark:text-blue-400" />
                    Merge
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Groups List */}
      <div className="space-y-4">
        {sortedGroups.map((group) => {
          const isSelected = selectedGroups.has(group.id);
          const isExpanded = expandedGroups.has(group.id);
          
          return (
            <Card 
              key={group.id}
              className={cn(
                "bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg transition-all duration-200",
                isSelected && "ring-2 ring-purple-500 bg-purple-50/30 dark:bg-purple-950/20"
              )}
            >
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-white/20 dark:hover:bg-gray-700/20 pb-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupExpansion(group.id);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                        
                        <div className={`w-3 h-3 rounded-full ${getPriorityColor(group.priority)}`} />
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-normal text-sm mb-1 truncate text-gray-800 dark:text-gray-200">
                            {group.title}
                          </h3>
                          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1 font-light">
                              <Hash className="size-3" />
                              {group.total_occurrences} occurrences
                            </span>
                            <span className="flex items-center gap-1 font-light">
                              <Users className="size-3" />
                              {group.unique_users} users
                            </span>
                            <span className="flex items-center gap-1 font-light">
                              <Clock className="size-3" />
                              Last: {new Date(group.last_seen).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs capitalize border-0 font-light ${
                            group.priority === 'critical' ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300' :
                            group.priority === 'high' ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300' :
                            group.priority === 'medium' ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-300'
                          }`}
                        >
                          {group.priority}
                        </Badge>
                        
                        <Button
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupSelection(group.id);
                          }}
                          className={isSelected ? 
                            "bg-purple-600 hover:bg-purple-700 text-white border-0 font-normal" : 
                            "bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors font-normal"
                          }
                        >
                          <Target className="size-4 mr-1" />
                          Select
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Pattern Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-white/20 dark:bg-gray-700/20 rounded-lg">
                        <div>
                          <label className="text-xs font-light text-gray-600 dark:text-gray-400 uppercase tracking-wider">MESSAGE PATTERN</label>
                          <p className="text-sm font-mono mt-1 break-all text-gray-800 dark:text-gray-200">{group.message_template}</p>
                        </div>
                        <div>
                          <label className="text-xs font-light text-gray-600 dark:text-gray-400 uppercase tracking-wider">URL PATTERN</label>
                          <p className="text-sm font-mono mt-1 break-all text-gray-800 dark:text-gray-200">{group.url_pattern || 'No URL pattern'}</p>
                        </div>
                      </div>
                      
                      {/* Individual Errors */}
                      <div className="space-y-2">
                        <label className="text-xs font-light text-gray-600 dark:text-gray-400 uppercase tracking-wider">RECENT OCCURRENCES</label>
                        {group.errors.slice(0, 5).map((error) => (
                          <div key={error.id} className="flex items-center justify-between p-2 bg-white/30 dark:bg-gray-800/30 border-0 rounded text-xs shadow-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-gray-500 dark:text-gray-400">#{error.id}</span>
                              <span className="text-gray-700 dark:text-gray-300 font-light">{new Date(error.timestamp).toLocaleString()}</span>
                              {error.session_user_id && (
                                <Badge variant="outline" className="text-xs bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">
                                  User: {error.session_user_id}
                                </Badge>
                              )}
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 hover:bg-gray-100 dark:hover:bg-gray-700/20">
                              <Link className="size-3 text-gray-600 dark:text-gray-400" />
                            </Button>
                          </div>
                        ))}
                        
                        {group.errors.length > 5 && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-light text-center py-2">
                            ... and {group.errors.length - 5} more occurrences
                          </p>
                        )}
                      </div>
                      
                      {/* Group Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                        <Button size="sm" variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors font-normal">
                          <Split className="size-4 mr-2 text-red-600 dark:text-red-400" />
                          Split Group
                        </Button>
                        <Button size="sm" variant="outline" className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-normal">
                          <Settings className="size-4 mr-2 text-blue-600 dark:text-blue-400" />
                          Edit Pattern
                        </Button>
                        <div className="flex-1" />
                        <Badge variant="outline" className="text-xs bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border-0 font-light">
                          Fingerprint: {group.fingerprint.slice(0, 8)}...
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {sortedGroups.length === 0 && (
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="py-12 text-center">
            <Brain className="size-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-normal mb-2 text-gray-800 dark:text-gray-200">No Error Groups Found</h3>
            <p className="text-gray-600 dark:text-gray-400 font-light">
              No errors available for grouping analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}