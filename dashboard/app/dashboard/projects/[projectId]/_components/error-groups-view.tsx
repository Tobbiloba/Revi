'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  IconAlertCircle, 
  IconTrendingUp, 
  IconTrendingDown, 
  IconMinus,
  IconUsers,
  IconClock,
  IconChevronRight,
  IconSearch
} from "@tabler/icons-react";
import Link from 'next/link';

interface ErrorGroup {
  id: number;
  title: string;
  message_template: string;
  total_occurrences: number;
  unique_users: number;
  last_seen: Date;
  first_seen: Date;
  status: 'open' | 'resolved' | 'ignored' | 'investigating';
  priority: 'critical' | 'high' | 'medium' | 'low';
  trend: 'up' | 'down' | 'stable';
  error_rate_change: number;
  impact_score: number;
  tags: string[];
}

interface ErrorGroupsViewProps {
  projectId: string;
}

// Mock data for demonstration
const mockErrorGroups: ErrorGroup[] = [
  {
    id: 1,
    title: "TypeError: Cannot read property 'map' of undefined",
    message_template: "Cannot read property 'map' of undefined",
    total_occurrences: 1247,
    unique_users: 89,
    last_seen: new Date('2024-12-19T10:30:00Z'),
    first_seen: new Date('2024-12-18T14:20:00Z'),
    status: 'open',
    priority: 'critical',
    trend: 'up',
    error_rate_change: 34.5,
    impact_score: 92,
    tags: ['frontend', 'react']
  },
  {
    id: 2,
    title: "ReferenceError: fetch is not defined",
    message_template: "fetch is not defined",
    total_occurrences: 856,
    unique_users: 43,
    last_seen: new Date('2024-12-19T09:45:00Z'),
    first_seen: new Date('2024-12-17T11:15:00Z'),
    status: 'investigating',
    priority: 'high',
    trend: 'down',
    error_rate_change: -12.3,
    impact_score: 76,
    tags: ['api', 'network']
  },
  {
    id: 3,
    title: "ChunkLoadError: Loading chunk failed",
    message_template: "Loading chunk <num> failed",
    total_occurrences: 423,
    unique_users: 67,
    last_seen: new Date('2024-12-19T08:15:00Z'),
    first_seen: new Date('2024-12-16T16:30:00Z'),
    status: 'open',
    priority: 'medium',
    trend: 'stable',
    error_rate_change: 2.1,
    impact_score: 58,
    tags: ['webpack', 'loading']
  }
];

export function ErrorGroupsView({ projectId }: ErrorGroupsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('last_seen');

  const filteredGroups = useMemo(() => {
    return mockErrorGroups
      .filter(group => {
        const matchesSearch = group.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             group.message_template.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || group.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || group.priority === priorityFilter;
        
        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'occurrences':
            return b.total_occurrences - a.total_occurrences;
          case 'users':
            return b.unique_users - a.unique_users;
          case 'impact':
            return b.impact_score - a.impact_score;
          case 'last_seen':
          default:
            return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
        }
      });
  }, [searchQuery, statusFilter, priorityFilter, sortBy]);

  const getStatusBadge = (status: string) => {
    const variants = {
      open: 'destructive',
      investigating: 'secondary',
      resolved: 'default',
      ignored: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'} className="text-xs">
        {status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    };

    return (
      <Badge variant="secondary" className={colors[priority as keyof typeof colors]}>
        {priority}
      </Badge>
    );
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') {
      return <IconTrendingUp className="size-4 text-red-500" />;
    } else if (trend === 'down') {
      return <IconTrendingDown className="size-4 text-green-500" />;
    }
    return <IconMinus className="size-4 text-gray-400" />;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Error Groups</h2>
          <p className="text-muted-foreground">
            Intelligently grouped errors with impact analysis and trends
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              placeholder="Search error groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_seen">Last Seen</SelectItem>
                <SelectItem value="occurrences">Occurrences</SelectItem>
                <SelectItem value="users">Users Affected</SelectItem>
                <SelectItem value="impact">Impact Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error Groups List */}
      <div className="grid gap-4">
        {filteredGroups.map((group) => (
          <Card key={group.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <IconAlertCircle className="size-4 text-destructive flex-shrink-0" />
                    {getStatusBadge(group.status)}
                    {getPriorityBadge(group.priority)}
                    <Badge variant="outline" className="text-xs">
                      Impact: {group.impact_score}/100
                    </Badge>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-sm leading-tight mb-1 break-words">
                      {group.title}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {group.message_template.length > 100 
                        ? group.message_template.substring(0, 100) + '...' 
                        : group.message_template}
                    </p>
                  </div>

                  {/* Tags */}
                  {group.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {group.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  href={`/dashboard/projects/${projectId}/error-groups/${group.id}`}
                  className="ml-4 flex-shrink-0"
                >
                  <Button variant="ghost" size="sm">
                    <IconChevronRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <IconAlertCircle className="size-3 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{group.total_occurrences.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">occurrences</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <IconUsers className="size-3 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{group.unique_users}</div>
                    <div className="text-xs text-muted-foreground">users affected</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <IconClock className="size-3 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{formatTimeAgo(group.last_seen)}</div>
                    <div className="text-xs text-muted-foreground">last seen</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getTrendIcon(group.trend)}
                  <div>
                    <div className="font-medium">
                      {group.error_rate_change > 0 ? '+' : ''}{group.error_rate_change.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">24h change</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredGroups.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <IconAlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No error groups found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your filters to see more results.'
                  : 'Great news! No error groups match your criteria.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}