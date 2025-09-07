'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  AlertTriangle, 
  Target,
  BarChart3,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorImpactData {
  id: number;
  message: string;
  occurrences: number;
  affectedUsers: number;
  revenueImpact: number;
  userDropoffRate: number;
  criticalityScore: number;
  businessPriority: 'critical' | 'high' | 'medium' | 'low';
  estimatedFixTime: number;
  categoryImpact: {
    category: string;
    impact: number;
    trend: 'up' | 'down' | 'stable';
  }[];
}

interface ImpactAssessmentDashboardProps {
  errors: ErrorImpactData[];
  selectedTimeRange: string;
  onTimeRangeChange: (range: string) => void;
  className?: string;
}

export function ImpactAssessmentDashboard({ 
  errors, 
  selectedTimeRange, 
  onTimeRangeChange, 
  className 
}: ImpactAssessmentDashboardProps) {
  const [selectedError, setSelectedError] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  const impactMetrics = useMemo(() => {
    const totalRevenueLoss = errors.reduce((sum, error) => sum + error.revenueImpact, 0);
    const totalAffectedUsers = new Set(errors.flatMap(error => 
      Array.from({ length: error.affectedUsers }, (_, i) => `${error.id}-${i}`)
    )).size;
    const averageDropoffRate = errors.reduce((sum, error) => sum + error.userDropoffRate, 0) / errors.length;
    const criticalErrors = errors.filter(error => error.businessPriority === 'critical').length;

    return {
      totalRevenueLoss,
      totalAffectedUsers,
      averageDropoffRate,
      criticalErrors,
    };
  }, [errors]);

  const prioritizedErrors = useMemo(() => {
    return [...errors].sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityWeight[a.businessPriority];
      const bPriority = priorityWeight[b.businessPriority];
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.criticalityScore - a.criticalityScore;
    });
  }, [errors]);

  const getImpactColor = (impact: number) => {
    if (impact >= 80) return 'text-red-600 bg-red-50';
    if (impact >= 60) return 'text-orange-600 bg-orange-50';
    if (impact >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="size-6 text-purple-600" />
            Impact Assessment Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            Business impact analysis and error prioritization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedTimeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={viewMode} onValueChange={(value: 'overview' | 'detailed') => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Impact Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Revenue Impact</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(impactMetrics.totalRevenueLoss)}
                </p>
              </div>
              <DollarSign className="size-8 text-red-500 opacity-80" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="size-4 text-red-500 mr-1" />
              <span className="text-red-600">12% increase from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Affected Users</p>
                <p className="text-2xl font-bold">
                  {impactMetrics.totalAffectedUsers.toLocaleString()}
                </p>
              </div>
              <Users className="size-8 text-blue-500 opacity-80" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingDown className="size-4 text-green-500 mr-1" />
              <span className="text-green-600">5% decrease from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Dropoff Rate</p>
                <p className="text-2xl font-bold text-orange-600">
                  {impactMetrics.averageDropoffRate.toFixed(1)}%
                </p>
              </div>
              <TrendingDown className="size-8 text-orange-500 opacity-80" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="size-4 text-orange-500 mr-1" />
              <span className="text-orange-600">2.3% increase from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Errors</p>
                <p className="text-2xl font-bold text-red-600">
                  {impactMetrics.criticalErrors}
                </p>
              </div>
              <AlertTriangle className="size-8 text-red-500 opacity-80" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <Shield className="size-4 text-blue-500 mr-1" />
              <span className="text-blue-600">{errors.length - impactMetrics.criticalErrors} non-critical</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Priority Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            Error Priority Matrix
          </CardTitle>
          <CardDescription>
            Errors ranked by business impact and fix complexity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {prioritizedErrors.slice(0, viewMode === 'detailed' ? prioritizedErrors.length : 8).map((error) => (
              <div
                key={error.id}
                className={cn(
                  "p-4 rounded-lg border transition-colors cursor-pointer",
                  selectedError === error.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                )}
                onClick={() => setSelectedError(selectedError === error.id ? null : error.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={getPriorityBadgeColor(error.businessPriority)}>
                        {error.businessPriority.toUpperCase()}
                      </Badge>
                      <span className="font-medium text-sm">
                        Score: {error.criticalityScore}/100
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm mb-1">{error.message}</h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>📊 {error.occurrences} occurrences</span>
                      <span>👥 {error.affectedUsers} users affected</span>
                      <span>💰 {formatCurrency(error.revenueImpact)} impact</span>
                      <span>📉 {error.userDropoffRate}% dropoff</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium",
                      getImpactColor(error.criticalityScore)
                    )}>
                      {error.criticalityScore}% Impact
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {formatTime(error.estimatedFixTime)} to fix
                    </div>
                  </div>
                </div>

                {selectedError === error.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <h5 className="font-medium text-sm mb-2">Category Impact Breakdown</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {error.categoryImpact.map((category) => (
                          <div key={category.category} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium">{category.category}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-sm">{category.impact}%</span>
                              {category.trend === 'up' && <TrendingUp className="size-3 text-red-500" />}
                              {category.trend === 'down' && <TrendingDown className="size-3 text-green-500" />}
                              {category.trend === 'stable' && <div className="size-3 bg-gray-400 rounded-full" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="default">
                        <Zap className="size-3 mr-1" />
                        Prioritize Fix
                      </Button>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                      <Button size="sm" variant="outline">
                        Assign Team
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Business Impact Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Impact Analysis</CardTitle>
            <CardDescription>How errors affect your bottom line</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium text-red-800">Direct Revenue Loss</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(impactMetrics.totalRevenueLoss)}
                  </p>
                </div>
                <DollarSign className="size-8 text-red-500" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Failed Transactions</span>
                  <span className="font-medium">{formatCurrency(impactMetrics.totalRevenueLoss * 0.6)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>User Churn Impact</span>
                  <span className="font-medium">{formatCurrency(impactMetrics.totalRevenueLoss * 0.25)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Support Costs</span>
                  <span className="font-medium">{formatCurrency(impactMetrics.totalRevenueLoss * 0.15)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Experience Impact</CardTitle>
            <CardDescription>How errors affect user satisfaction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div>
                  <p className="font-medium text-orange-800">User Satisfaction Score</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {Math.round(100 - impactMetrics.averageDropoffRate)}/100
                  </p>
                </div>
                <Users className="size-8 text-orange-500" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Session Abandonment</span>
                  <span className="font-medium">{impactMetrics.averageDropoffRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Frustrated Users</span>
                  <span className="font-medium">{Math.round(impactMetrics.totalAffectedUsers * 0.7).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Support Tickets</span>
                  <span className="font-medium">{Math.round(impactMetrics.totalAffectedUsers * 0.15).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}